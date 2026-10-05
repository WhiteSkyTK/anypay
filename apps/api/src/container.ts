import pkg from '../package.json' with { type: 'json' }
import type { Env } from './config/env'
import { OpenPaymentsGateway } from './gateways/open-payments-gateway'
import { createLogger, type Logger } from './lib/logger'
import { GrantService } from './services/grant-service'
import { PaymentOrchestrator } from './services/payment-orchestrator'
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

/**
 * The composition root: the one place that knows how the classes fit together. Everything else
 * receives its collaborators through its constructor, so tests can pass in fakes.
 *
 * Dependency graph as of Phase 1 (constructors gain these parameters as each class is built):
 *   WalletAddressResolver ← ALLOWED_WALLET_HOSTS
 *   GrantService          ← OpenPaymentsGateway, TOKEN_ENCRYPTION_KEY
 *   PaymentOrchestrator   ← OpenPaymentsGateway, GrantService, WalletAddressResolver
 *   PaymentWatcher        ← OpenPaymentsGateway
 *   TabService            ← OpenPaymentsGateway, GrantService
 */
export function createContainer(env: Env): Container {
  return {
    env,
    logger: createLogger(env),
    version: pkg.version,
    openPayments: new OpenPaymentsGateway(),
    walletAddressResolver: new WalletAddressResolver(),
    grantService: new GrantService(),
    paymentOrchestrator: new PaymentOrchestrator(),
    paymentWatcher: new PaymentWatcher(),
    tabService: new TabService(),
  }
}
