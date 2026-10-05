import { NotImplementedError } from '../lib/errors'

/**
 * Requests, continues and rotates Open Payments grants via the OpenPaymentsGateway.
 * Access tokens and continue/manage URIs are stored encrypted at rest (AES-256-GCM, key from
 * TOKEN_ENCRYPTION_KEY), because a leaked tab grant could spend a customer's weekly cap.
 *
 * Phase 1: implement on top of the gateway.
 */
export class GrantService {
  /** Non-interactive (incoming-payment, quote) or interactive (outgoing-payment) grant request. */
  async requestGrant(): Promise<never> {
    throw new NotImplementedError('GrantService.requestGrant')
  }

  /** Finishes an interactive grant after the customer approves it in their own wallet. */
  async continueGrant(): Promise<never> {
    throw new NotImplementedError('GrantService.continueGrant')
  }

  /** Swaps an expired access token for a new one (`token.rotate`), e.g. for a long-lived tab. */
  async rotateToken(): Promise<never> {
    throw new NotImplementedError('GrantService.rotateToken')
  }
}
