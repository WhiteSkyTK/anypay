import type {
  AccessToken,
  ContinueResult,
  CreateIncomingPaymentArgs,
  CreateOutgoingPaymentArgs,
  CreateQuoteArgs,
  GrantAccessRequest,
  GrantContinuation,
  GrantResult,
  IncomingPaymentInfo,
  OutgoingPaymentInfo,
  QuoteInfo,
  WalletAddressInfo,
} from './types'

/**
 * Every Open Payments call AnyPay makes. OpenPaymentsGateway implements it with the SDK; tests
 * use a fake. Calls that touch protected resources take the access token from a grant.
 */
export interface OpenPaymentsPort {
  getWalletAddress(url: string): Promise<WalletAddressInfo>
  requestGrant(authServer: string, request: GrantAccessRequest): Promise<GrantResult>
  continueGrant(continuation: GrantContinuation, interactRef?: string): Promise<ContinueResult>
  rotateToken(token: AccessToken): Promise<AccessToken>
  createIncomingPayment(
    resourceServer: string,
    accessToken: string,
    args: CreateIncomingPaymentArgs,
  ): Promise<IncomingPaymentInfo>
  getIncomingPayment(url: string, accessToken: string): Promise<IncomingPaymentInfo>
  createQuote(
    resourceServer: string,
    accessToken: string,
    args: CreateQuoteArgs,
  ): Promise<QuoteInfo>
  createOutgoingPayment(
    resourceServer: string,
    accessToken: string,
    args: CreateOutgoingPaymentArgs,
  ): Promise<OutgoingPaymentInfo>
  getOutgoingPayment(url: string, accessToken: string): Promise<OutgoingPaymentInfo>
}
