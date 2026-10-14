import {
  isFresh,
  type Money,
  type OpenTabRequest,
  type OpenTabResponse,
  type ShopTab,
  type TabFailure,
  type TabSummary,
  toMinorUnits,
  verifyVoucher,
  type VoucherRejection,
  type VoucherStatus,
  type VoucherSubmission,
} from '@anypay/shared'
import { randomBytes, randomUUID } from 'node:crypto'
import { AppError } from '../lib/errors'
import type { Logger } from '../lib/logger'
import { isOpenPaymentsError, type OpenPaymentsErrorCode } from '../open-payments/errors'
import type { ShopRecord } from '../repositories/shop-repository'
import type { TabRecord, TabRepository, TabSession } from '../repositories/tab-repository'
import type { VoucherRecord, VoucherRepository } from '../repositories/voucher-repository'
import type { GrantService } from './grant-service'
import type { PaymentOrchestrator } from './payment-orchestrator'
import type { PaymentService } from './payment-service'
import type { PaymentSession } from './payment-session'
import type { ShopService } from './shop-service'
import type { WalletAddressResolver } from './wallet-address-resolver'

export interface TabServiceDeps {
  shops: Pick<ShopService, 'getShop'>
  tabs: TabRepository
  vouchers: VoucherRepository
  wallets: Pick<WalletAddressResolver, 'resolve'>
  grants: Pick<GrantService, 'requestPaymentConsent' | 'completeConsent' | 'rotate'>
  orchestrator: Pick<
    PaymentOrchestrator,
    'prepareSettlement' | 'sendPreAuthorised' | 'quoteFixedSend'
  >
  payments: Pick<PaymentService, 'trackPreAuthorised'>
  logger: Logger
  publicApiUrl: string
  webOrigin: string
  now?: () => Date
}

export interface TabCallbackQuery {
  interact_ref?: string
  hash?: string
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

const FAILURE_BY_ERROR: Partial<Record<OpenPaymentsErrorCode, TabFailure>> = {
  consent_declined: 'consent_declined',
  consent_invalid: 'consent_invalid',
  consent_pending: 'consent_timeout',
}

/** The week (by the grant's interval) a moment falls in: the window one cap applies to. */
export function weekOf(intervalStart: Date, at: Date): { from: Date; to: Date } {
  const weeks = Math.max(0, Math.floor((at.getTime() - intervalStart.getTime()) / WEEK_MS))
  const from = new Date(intervalStart.getTime() + weeks * WEEK_MS)
  return { from, to: new Date(from.getTime() + WEEK_MS) }
}

/** Whole seconds: the interval goes to the customer's wallet as ISO 8601 ('…T10:00:00Z'). */
const toTheSecond = (date: Date) => new Date(Math.floor(date.getTime() / 1000) * 1000)

/** A voucher counts against the cap unless it was rejected or its payment failed. */
const counts = (voucher: VoucherRecord) =>
  voucher.status === 'settling' && voucher.paymentStatus !== 'failed'

/** The status both phones see: derived from the voucher and the payment that settles it. */
export function toVoucherStatus(voucher: VoucherRecord): VoucherStatus {
  const base = {
    nonce: voucher.nonce,
    tabId: voucher.tabId,
    amount: voucher.amount,
    paymentId: voucher.paymentId,
  }
  if (voucher.status === 'rejected') return { ...base, status: 'rejected', reason: voucher.reason }
  if (voucher.paymentStatus === 'completed') return { ...base, status: 'settled' }
  if (voucher.paymentStatus === 'failed') {
    const failure = voucher.paymentFailure
    const reason: VoucherRejection =
      failure === 'insufficient_funds' || failure === 'grant_limit' || failure === 'timeout'
        ? failure
        : 'payment_failed'
    return { ...base, status: 'rejected', reason }
  }
  return { ...base, status: 'settling' }
}

/**
 * Offline Digital Tab (Feature 4). A tab is a weekly-capped outgoing-payment grant the customer
 * approves once in their own wallet, plus their phone's public key. Sales are then vouchers the
 * phone signs offline; on sync each is verified (signature, single use, age, cap) and settled
 * once with the stored grant, with no customer interaction.
 */
export class TabService {
  readonly #deps: TabServiceDeps
  readonly #now: () => Date
  /** Callbacks being handled right now: a double-tapped redirect must not continue a grant twice. */
  readonly #finishing = new Set<string>()

  constructor(deps: TabServiceDeps) {
    this.#deps = deps
    this.#now = deps.now ?? (() => new Date())
  }

  /** Asks the customer's wallet for a weekly-capped grant; returns the approval link. */
  async openTab(shopId: string, request: OpenTabRequest): Promise<OpenTabResponse> {
    const shop = await this.#deps.shops.getShop(shopId)
    const customer = await this.#deps.wallets.resolve(request.customerWallet)
    const cap: Money = {
      value: toMinorUnits(request.weeklyCap, customer.assetScale),
      assetCode: customer.assetCode,
      assetScale: customer.assetScale,
    }
    if (cap.value === '0')
      throw new AppError('invalid_amount', 'The weekly cap must be more than zero')
    const id = randomBytes(9).toString('base64url')
    const intervalStart = toTheSecond(this.#now())
    const consent = await this.#deps.grants.requestPaymentConsent(customer, {
      debitAmount: cap,
      // The cap resets every 7 days from now: an ISO 8601 repeating interval.
      interval: `R/${intervalStart.toISOString().replace('.000Z', 'Z')}/P1W`,
      finishUri: `${this.#deps.publicApiUrl}/api/tabs/${id}/callback`,
    })
    const tab = {
      id,
      shopId,
      label: request.label,
      cap,
      intervalStart,
      publicKey: request.publicKey,
    }
    await this.#deps.tabs.insert(tab, { customer, consent })
    const record: TabRecord = { ...tab, status: 'awaiting-consent', createdAt: this.#now() }
    return { tab: await this.#summary(record, shop), consentUrl: consent.redirectUrl }
  }

  /**
   * The customer's wallet redirects here after the approval screen. Verifies the callback and
   * activates the tab (at most once); returns where to send the browser.
   */
  async handleCallback(tabId: string, query: TabCallbackQuery): Promise<string> {
    const tabUrl = `${this.#deps.webOrigin}/tab/${tabId}`
    const stored = await this.#deps.tabs.find(tabId)
    if (!stored) throw new AppError('tab_not_found', 'No such tab', 404)
    const { record, session } = stored
    if (record.status !== 'awaiting-consent' || this.#finishing.has(tabId)) return tabUrl

    this.#finishing.add(tabId)
    try {
      const { interact_ref: interactRef, hash } = query
      if (!interactRef || !hash || !session.consent) {
        await this.#deps.tabs.update(tabId, { status: 'failed', failure: 'consent_declined' })
        return tabUrl
      }
      const access = await this.#deps.grants.completeConsent(session.consent, { interactRef, hash })
      const active: TabSession = { customer: session.customer, access }
      const shopCap = await this.#measureCap(record, active)
      await this.#deps.tabs.update(tabId, { status: 'active', session: active, shopCap })
      return tabUrl
    } catch (error) {
      const failure = isOpenPaymentsError(error) ? FAILURE_BY_ERROR[error.code] : undefined
      if (!failure) throw error
      await this.#deps.tabs.update(tabId, { status: 'failed', failure })
      return `${tabUrl}?error=callback`
    } finally {
      this.#finishing.delete(tabId)
    }
  }

  /** A tab as its customer sees it, including what is left this week. */
  async getTab(tabId: string): Promise<TabSummary> {
    const stored = await this.#deps.tabs.find(tabId)
    if (!stored) throw new AppError('tab_not_found', 'No such tab', 404)
    const shop = await this.#deps.shops.getShop(stored.record.shopId)
    return this.#summary(stored.record, shop)
  }

  /** The shop's active tabs, with what the shop's phone needs to check vouchers offline. */
  async listForShop(shop: ShopRecord): Promise<ShopTab[]> {
    const records = await this.#deps.tabs.listActiveForShop(shop.id)
    const tabs: ShopTab[] = []
    for (const record of records) {
      const shopCap = record.shopCap ?? (await this.#fillMissingCap(record))
      if (!shopCap) continue // not usable offline until its cap is known
      tabs.push({
        id: record.id,
        label: record.label,
        publicKey: record.publicKey as ShopTab['publicKey'],
        shopCap,
        remaining: await this.#remaining({ ...record, shopCap }, this.#now()),
        weekStartedAt: weekOf(record.intervalStart, this.#now()).from.toISOString(),
      })
    }
    return tabs
  }

  /**
   * Either phone sends a voucher when it has signal. Checks it (signature, single use, age,
   * weekly cap) and settles it once, with the tab's grant. Sending it again, from either phone,
   * returns the same status.
   */
  async submitVoucher(tabId: string, submission: VoucherSubmission): Promise<VoucherStatus> {
    const stored = await this.#deps.tabs.find(tabId)
    if (!stored) throw new AppError('tab_not_found', 'No such tab', 404)
    const { record } = stored
    const voucher = { ...submission, tabId }
    // The signature binds tab, shop, amount, nonce and time: change any of them and it fails.
    const genuine =
      submission.shopId === record.shopId && (await verifyVoucher(record.publicKey, voucher))
    if (!genuine)
      throw new AppError('voucher_invalid', 'This voucher was not signed by this tab', 400)

    const seen = await this.#deps.vouchers.find(submission.nonce)
    if (seen) return toVoucherStatus(seen)

    const signedAt = new Date(submission.ts * 1000)
    const rejection = await this.#check(record, submission.amount, signedAt)
    const { claimed, voucher: claim } = await this.#deps.vouchers.claim(
      {
        nonce: submission.nonce,
        tabId,
        amount: submission.amount,
        signedAt,
        signature: submission.signature,
      },
      rejection,
    )
    // Lost the race to the other phone, or refused: report what is stored.
    if (!claimed || rejection) return toVoucherStatus(claim)

    try {
      await this.#settle(stored, claim)
    } catch (error) {
      this.#deps.logger.error({ err: error, tabId }, 'Settling a voucher failed')
      await this.#deps.vouchers.reject(claim.nonce, 'payment_failed')
    }
    const settled = await this.#deps.vouchers.find(claim.nonce)
    return toVoucherStatus(settled ?? claim)
  }

  async getVoucher(nonce: string): Promise<VoucherStatus> {
    const voucher = await this.#deps.vouchers.find(nonce)
    if (!voucher) throw new AppError('voucher_not_found', 'No such voucher', 404)
    return toVoucherStatus(voucher)
  }

  /** Why a genuine voucher can't be paid, if it can't. */
  async #check(
    record: TabRecord,
    amount: string,
    signedAt: Date,
  ): Promise<VoucherRejection | undefined> {
    if (record.status !== 'active' || !record.shopCap) return 'tab_inactive'
    if (!isFresh(signedAt.getTime() / 1000, this.#now().getTime())) return 'expired'
    const remaining = await this.#remaining({ ...record, shopCap: record.shopCap }, signedAt)
    // Two vouchers settling at the same moment could both pass this; the grant's own weekly
    // limit in the customer's wallet is the hard stop (the payment then fails as grant_limit).
    return BigInt(amount) > BigInt(remaining.value) ? 'cap_reached' : undefined
  }

  async #settle(stored: { record: TabRecord; session: TabSession }, voucher: VoucherRecord) {
    const { record, session } = stored
    if (!session.access) throw new AppError('tab_inactive', 'The tab has no grant yet', 409)
    const shop = await this.#deps.shops.getShop(record.shopId)
    const merchant = await this.#deps.wallets.resolve(shop.walletAddress)
    let payment = await this.#deps.orchestrator.prepareSettlement({
      id: randomUUID(),
      customer: session.customer,
      merchant,
      amount: voucher.amount,
      description: `AnyPay tab: ${shop.name}`,
    })
    if (payment.step === 'quoted') payment = await this.#send(record.id, session, payment)
    await this.#deps.payments.trackPreAuthorised(shop, payment, record.id)
    await this.#deps.vouchers.attachPayment(voucher.nonce, payment.id)
  }

  /** Pays with the tab's grant; a token that expired since is rotated (and stored) once. */
  async #send(tabId: string, session: TabSession, payment: PaymentSession) {
    const access = session.access
    if (!access) throw new AppError('tab_inactive', 'The tab has no grant yet', 409)
    try {
      return await this.#deps.orchestrator.sendPreAuthorised(payment, access)
    } catch (error) {
      if (!isOpenPaymentsError(error, 'token_expired')) throw error
      const rotated = { ...access, accessToken: await this.#deps.grants.rotate(access.accessToken) }
      await this.#deps.tabs.update(tabId, { session: { ...session, access: rotated } })
      return this.#deps.orchestrator.sendPreAuthorised(payment, rotated)
    }
  }

  /** The weekly cap in the shop's currency (fees and exchange included). Best effort. */
  async #measureCap(record: TabRecord, session: TabSession): Promise<Money | undefined> {
    try {
      const shop = await this.#deps.shops.getShop(record.shopId)
      const merchant = await this.#deps.wallets.resolve(shop.walletAddress)
      return await this.#deps.orchestrator.quoteFixedSend(session.customer, merchant, record.cap)
    } catch (error) {
      // The tab still works online; the shop's phone just can't check it offline until it's known.
      this.#deps.logger.warn({ err: error, tabId: record.id }, 'Could not measure a tab cap')
      return undefined
    }
  }

  async #fillMissingCap(record: TabRecord): Promise<Money | undefined> {
    const stored = await this.#deps.tabs.find(record.id)
    if (!stored) return undefined
    const shopCap = await this.#measureCap(record, stored.session)
    if (shopCap) await this.#deps.tabs.update(record.id, { shopCap })
    return shopCap
  }

  /** What is left of the week's cap (in the shop's currency) that `at` falls in. */
  async #remaining(record: TabRecord & { shopCap: Money }, at: Date): Promise<Money> {
    const { from, to } = weekOf(record.intervalStart, at)
    const vouchers = await this.#deps.vouchers.listForTab(record.id, from, to)
    const used = vouchers.filter(counts).reduce((sum, v) => sum + BigInt(v.amount.value), 0n)
    const left = BigInt(record.shopCap.value) - used
    return { ...record.shopCap, value: (left > 0n ? left : 0n).toString() }
  }

  async #summary(record: TabRecord, shop: ShopRecord): Promise<TabSummary> {
    const now = this.#now()
    return {
      id: record.id,
      shopId: shop.id,
      shopName: shop.name,
      label: record.label,
      status: record.status,
      failure: record.failure,
      cap: record.cap,
      shopCap: record.shopCap,
      remaining: record.shopCap
        ? await this.#remaining({ ...record, shopCap: record.shopCap }, now)
        : undefined,
      weekStartedAt: weekOf(record.intervalStart, now).from.toISOString(),
    }
  }
}
