// npm run demo:pay -- --amount 25.00 [--from <customer wallet>] [--to <shop wallet>] [--no-callback]
//
// Runs the whole online payment flow against real Open Payments wallets (the Interledger test
// wallet), logging each step and waiting while you approve the payment in the customer's wallet.
import { formatMoney, type Money } from '@anypay/shared'
import { createServer } from 'node:http'
import { createInterface } from 'node:readline/promises'
import { parseArgs } from 'node:util'
import { parseEnv } from '../config/env'
import { loadDotEnv } from '../config/repo-root'
import { createContainer } from '../container'
import type { ConsentCallback } from '../services/grant-service'
import type { PaymentFailure, PaymentSession } from '../services/payment-session'

const CALLBACK_TIMEOUT_MS = 5 * 60 * 1000

const FAILURE_MESSAGES: Record<PaymentFailure, string> = {
  consent_declined: 'The customer declined the payment in their wallet.',
  consent_invalid: 'The approval callback could not be verified (hash mismatch).',
  consent_timeout: 'The payment was not approved in time.',
  quote_expired: 'The quote expired before the payment was approved. Run it again.',
  insufficient_funds: "The customer's wallet does not have enough money.",
  grant_limit: 'The payment is more than the customer approved.',
  payment_failed: 'The payment failed after it started.',
  timeout: 'The money did not arrive in time. Check both wallets.',
}

// Add the code only when the symbol hides it (R 0,13 → R 0,13 ZAR; COP 25,00 already says COP).
const money = (amount: Money) => {
  const text = formatMoney(amount)
  return text.includes(amount.assetCode) ? text : `${text} ${amount.assetCode}`
}
const print = (line = '') => console.log(line)

function printStep(session: PaymentSession): void {
  const { incomingPayment, quote } = session
  switch (session.step) {
    case 'incoming-payment-created':
      print(`[1/4] Shop's payment request created for ${money(session.amount)}`)
      print(`      ${incomingPayment?.id}`)
      break
    case 'quoted':
      if (!quote) return
      print(
        `[2/4] Quote: customer pays ${money(quote.debitAmount)}, shop receives ${money(quote.receiveAmount)}`,
      )
      if (quote.expiresAt)
        print(`      Valid until ${new Date(quote.expiresAt).toLocaleTimeString()}`)
      break
    case 'awaiting-consent':
      print('[3/4] Customer approval needed. Open this link and approve in the customer wallet:')
      print()
      print(`      ${session.consent?.redirectUrl}`)
      print()
      break
    case 'sending':
      print('[4/4] Approval verified, payment sent. Waiting for the shop to receive it...')
      break
    default:
      break
  }
}

interface CliArgs {
  amount: string
  from: string
  to: string
  callback: boolean
  port: number
}

function readArgs(env: ReturnType<typeof parseEnv>): CliArgs {
  const { values } = parseArgs({
    options: {
      amount: { type: 'string' },
      from: { type: 'string', default: env.DEMO_CUSTOMER_WALLET },
      to: { type: 'string', default: env.DEMO_MERCHANT_WALLET },
      'no-callback': { type: 'boolean', default: false },
      port: { type: 'string', default: '3344' },
    },
  })
  if (!values.amount || !values.from || !values.to) {
    throw new Error(
      'Usage: npm run demo:pay -- --amount 25.00 [--from <customer wallet>] [--to <shop wallet>]\n' +
        'Set DEMO_CUSTOMER_WALLET and DEMO_MERCHANT_WALLET in .env to skip --from and --to.',
    )
  }
  return {
    amount: values.amount,
    from: values.from,
    to: values.to,
    callback: !values['no-callback'],
    port: Number(values.port),
  }
}

type CallbackResult = { approved: ConsentCallback } | { declined: true }

/**
 * A one-shot local page the customer's wallet redirects to after approval. In the web app this is
 * an API route; here it proves the same hash check works against the real wallet.
 */
const callbackPage = (approved: boolean) =>
  '<!doctype html><meta name="viewport" content="width=device-width">' +
  `<body style="font-family:system-ui;padding:2rem"><h1>${approved ? 'Approved' : 'Not approved'}</h1>` +
  '<p>You can close this tab and go back to the terminal.</p></body>'

async function startCallbackServer(
  port: number,
): Promise<{ uri: string; result: Promise<CallbackResult> }> {
  const server = createServer()
  const result = new Promise<CallbackResult>((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close()
      reject(new Error('No approval within 5 minutes'))
    }, CALLBACK_TIMEOUT_MS)

    server.on('request', (req, res) => {
      const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)
      if (url.pathname !== '/callback') return void res.writeHead(404).end()
      const interactRef = url.searchParams.get('interact_ref')
      const hash = url.searchParams.get('hash')
      const approved = interactRef !== null && hash !== null
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(callbackPage(approved))
      clearTimeout(timer)
      server.close()
      resolve(approved ? { approved: { interactRef, hash } } : { declined: true })
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return { uri: `http://127.0.0.1:${port}/callback`, result }
}

async function waitForEnter(): Promise<void> {
  const readline = createInterface({ input: process.stdin, output: process.stdout })
  await readline.question('      Press Enter after you have approved the payment... ')
  readline.close()
}

async function main(): Promise<number> {
  loadDotEnv()
  const env = parseEnv({ ...process.env, LOG_LEVEL: 'silent' })
  const args = readArgs(env)
  const container = createContainer(env, { onPaymentStep: printStep })
  if (!container.openPayments.isConfigured) {
    throw new Error(
      'Open Payments is not configured: set CLIENT_WALLET_ADDRESS, KEY_ID and PRIVATE_KEY in .env',
    )
  }
  const { paymentOrchestrator: orchestrator, paymentWatcher: watcher } = container

  print('AnyPay · Open Payments demo')
  print(`  Customer  ${args.from}`)
  print(`  Shop      ${args.to}`)
  print(`  Amount    ${args.amount}`)
  print()

  const callback = args.callback ? await startCallbackServer(args.port) : undefined
  let session = await orchestrator.startPayment({
    customerWallet: args.from,
    merchantWallet: args.to,
    amount: args.amount,
    finishUri: callback?.uri,
    description: 'AnyPay demo payment',
  })

  if (session.step === 'awaiting-consent') {
    let approval: ConsentCallback | undefined
    if (callback) {
      print('      Waiting for the wallet to send you back here...')
      const result = await callback.result
      if ('declined' in result) session = orchestrator.declinePayment(session)
      else approval = result.approved
    } else {
      await waitForEnter()
    }
    if (session.step === 'awaiting-consent')
      session = await orchestrator.finishPayment(session, approval)
  }
  if (session.step === 'sending') session = await watcher.waitForCompletion(session)

  print()
  if (session.step === 'completed') {
    const received = session.incomingPayment?.receivedAmount ?? session.amount
    print(`Done. The shop received ${money(received)}. Check both balances in the test wallet.`)
    return 0
  }
  print(`Payment failed: ${session.failure ? FAILURE_MESSAGES[session.failure] : 'unknown reason'}`)
  return 1
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    // Error messages are written to be safe: no tokens or keys ever reach them.
    console.error(`\n${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  },
)
