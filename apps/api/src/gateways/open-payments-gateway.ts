import { NotImplementedError } from '../lib/errors'

/**
 * The only module that imports `@interledger/open-payments`. It holds the authenticated client
 * (CLIENT_WALLET_ADDRESS + KEY_ID + private key), so nothing else touches the SDK and tests can
 * swap in a fake gateway.
 *
 * Phase 1: read the SDK types and openpayments.dev first, then add one method per call we make
 * (wallet address, grants, incoming payment, quote, outgoing payment).
 */
export class OpenPaymentsGateway {
  /** CLAUDE.md step 1: auth server, resource server, asset code and scale of a wallet address. */
  async getWalletAddress(): Promise<never> {
    throw new NotImplementedError('OpenPaymentsGateway.getWalletAddress')
  }
}
