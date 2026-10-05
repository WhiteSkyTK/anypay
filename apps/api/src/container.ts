import pkg from '../package.json' with { type: 'json' }
import type { Env } from './config/env'
import { loadPrivateKey } from './config/private-key'
import { findRepoRoot } from './config/repo-root'
import {
  type OpenPaymentsClientConfig,
  OpenPaymentsGateway,
} from './gateways/open-payments-gateway'
import { createLogger, type Logger } from './lib/logger'
import { GrantService } from './services/grant-service'
import { PaymentOrchestrator } from './services/payment-orchestrator'
import type { PaymentSession } from './services/payment-session'
import { PaymentWatcher } from './services/payment-watcher'
import { TabService } from './services/tab-service'
import { WalletAddressResolver } from './services/wallet-address-resolver'

export interface Container {
  env: Env
  logger: Logger
  version: string
  openPayments: OpenPaymentsGateway
  walletAddressResolver: WalletAddressResolver
  grantService: GrantService
  paymentOrchestrator: PaymentOrchestrator
  paymentWatcher: PaymentWatcher
  tabService: TabService
}

export interface ContainerOptions {
  /** Progress hook for each payment step (the demo CLI prints them; Phase 2 streams them). */
  onPaymentStep?: (session: PaymentSession) => void
}

function clientConfig(env: Env): OpenPaymentsClientConfig | undefined {
  const privateKey = loadPrivateKey(env, findRepoRoot())
  if (!env.CLIENT_WALLET_ADDRESS || !env.KEY_ID || !privateKey) return undefined
  return { walletAddressUrl: env.CLIENT_WALLET_ADDRESS, keyId: env.KEY_ID, privateKey }
}

/**
 * The composition root: the one place that knows how the classes fit together. Everything else
 * receives its collaborators through its constructor, so tests can pass in fakes.
 */
export function createContainer(env: Env, options: ContainerOptions = {}): Container {
  const openPayments = new OpenPaymentsGateway(clientConfig(env))
  const walletAddressResolver = new WalletAddressResolver(openPayments, env.ALLOWED_WALLET_HOSTS)
  const grantService = new GrantService(openPayments)
  return {
    env,
    logger: createLogger(env),
    version: pkg.version,
    openPayments,
    walletAddressResolver,
    grantService,
    paymentOrchestrator: new PaymentOrchestrator({
      openPayments,
      grants: grantService,
      wallets: walletAddressResolver,
      onStep: options.onPaymentStep,
    }),
    paymentWatcher: new PaymentWatcher(openPayments),
    tabService: new TabService(),
  }
}
