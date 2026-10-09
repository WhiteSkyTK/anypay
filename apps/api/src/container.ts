import pkg from '../package.json' with { type: 'json' }
import type { Env } from './config/env'
import { loadPrivateKey } from './config/private-key'
import { findRepoRoot } from './config/repo-root'
import type { Database } from './db/database'
import { OpenPaymentsGateway } from './gateways/open-payments-gateway'
import { createLogger, type Logger } from './lib/logger'
import { TokenCipher } from './lib/token-cipher'
import type { OpenPaymentsPort } from './open-payments/port'
import { IdempotencyRepository } from './repositories/idempotency-repository'
import { PaymentRepository } from './repositories/payment-repository'
import { ShopRepository } from './repositories/shop-repository'
import { GrantService } from './services/grant-service'
import { PaymentEvents } from './services/payment-events'
import { PaymentOrchestrator } from './services/payment-orchestrator'
import { PaymentService } from './services/payment-service'
import type { PaymentSession } from './services/payment-session'
import { PaymentWatcher } from './services/payment-watcher'
import { ShopService } from './services/shop-service'
import { TabService } from './services/tab-service'
import { WalletAddressResolver } from './services/wallet-address-resolver'
import { randomBytes } from 'node:crypto'

export interface CoreOptions {
  /** Progress hook for each payment step (the demo CLI prints them). */
  onPaymentStep?: (session: PaymentSession) => void
  /** Replaces the real Open Payments gateway (tests use a fake wallet). */
  openPayments?: OpenPaymentsPort
}

/** The Open Payments core: everything the payment flow needs, no database (used by the CLI). */
export interface Core {
  env: Env
  logger: Logger
  version: string
  openPayments: OpenPaymentsPort
  /** False until CLIENT_WALLET_ADDRESS, KEY_ID and a private key are set. */
  openPaymentsConfigured: boolean
  walletAddressResolver: WalletAddressResolver
  grantService: GrantService
  paymentOrchestrator: PaymentOrchestrator
  paymentWatcher: PaymentWatcher
}

export interface Container extends Core {
  shopService: ShopService
  paymentService: PaymentService
  paymentEvents: PaymentEvents
  idempotency: IdempotencyRepository
  tabService: TabService
}

function createGateway(env: Env): OpenPaymentsGateway {
  const privateKey = loadPrivateKey(env, findRepoRoot())
  const configured = env.CLIENT_WALLET_ADDRESS && env.KEY_ID && privateKey
  return new OpenPaymentsGateway(
    configured
      ? {
          walletAddressUrl: env.CLIENT_WALLET_ADDRESS!,
          keyId: env.KEY_ID!,
          privateKey: privateKey!,
        }
      : undefined,
  )
}

/**
 * The composition root: the one place that knows how the classes fit together. Everything else
 * receives its collaborators through its constructor, so tests can pass in fakes.
 */
export function createCore(env: Env, options: CoreOptions = {}): Core {
  const gateway = options.openPayments ? undefined : createGateway(env)
  const openPayments = options.openPayments ?? (gateway as OpenPaymentsGateway)
  const walletAddressResolver = new WalletAddressResolver(openPayments, env.ALLOWED_WALLET_HOSTS)
  const grantService = new GrantService(openPayments)
  return {
    env,
    logger: createLogger(env),
    version: pkg.version,
    openPayments,
    openPaymentsConfigured: gateway ? gateway.isConfigured : true,
    walletAddressResolver,
    grantService,
    paymentOrchestrator: new PaymentOrchestrator({
      openPayments,
      grants: grantService,
      wallets: walletAddressResolver,
      onStep: options.onPaymentStep,
    }),
    paymentWatcher: new PaymentWatcher(openPayments),
  }
}

function createCipher(env: Env, logger: Logger): TokenCipher {
  if (env.TOKEN_ENCRYPTION_KEY) return TokenCipher.fromBase64(env.TOKEN_ENCRYPTION_KEY)
  // Production refuses to start without a key (env rules). In development a throwaway key keeps
  // things working, but payments in progress can't be read after a restart.
  logger.warn('TOKEN_ENCRYPTION_KEY is not set: using a temporary key for this run')
  return new TokenCipher(randomBytes(32))
}

/** The full API: the core plus storage, services and the live event bus. */
export function createContainer(env: Env, db: Database, options: CoreOptions = {}): Container {
  const core = createCore(env, options)
  const shopService = new ShopService(new ShopRepository(db), core.walletAddressResolver)
  const paymentEvents = new PaymentEvents()
  const paymentService = new PaymentService({
    shops: shopService,
    payments: new PaymentRepository(db, createCipher(env, core.logger)),
    orchestrator: core.paymentOrchestrator,
    watcher: core.paymentWatcher,
    events: paymentEvents,
    logger: core.logger,
    publicApiUrl: env.PUBLIC_API_URL,
    webOrigin: env.WEB_ORIGIN[0] ?? 'http://localhost:5173',
  })
  return {
    ...core,
    shopService,
    paymentService,
    paymentEvents,
    idempotency: new IdempotencyRepository(db),
    tabService: new TabService(),
  }
}
