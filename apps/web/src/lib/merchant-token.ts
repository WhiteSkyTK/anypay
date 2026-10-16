import { randomBase64url } from '@anypay/shared'
import { api, ApiRequestError } from './api'
import { type MerchantSession, setMerchantSession } from './merchant-session'

/** The link that signs another phone in to this shop (MerchantConnectPage reads it). */
export function signInLink(session: MerchantSession, origin = window.location.origin): string {
  const params = new URLSearchParams({ shop: session.shopId, token: session.token })
  // In the fragment: browsers never send it to a server, so the token stays out of every log.
  return `${origin}/merchant/connect#${params.toString()}`
}

/**
 * "Sign out other phones": switches the shop to a new token that only this phone knows. The phone
 * picks the token and saves it before asking, so it is never left without a working one: if the
 * answer is lost (or the app closes), the next attempt finds the old token refused and confirms
 * the change with the new one. Throws an ApiRequestError if it can't be done now.
 */
export async function signOutOtherPhones(session: MerchantSession): Promise<MerchantSession> {
  const next = session.nextToken ?? randomBase64url(32)
  // Only when new: re-saving would hand every screen a "changed" session, and the live feed
  // reacts to a changed session by trying again, which would land here again.
  if (session.nextToken !== next) setMerchantSession({ ...session, nextToken: next })
  try {
    await api.replaceMerchantToken(session.shopId, session.token, next)
  } catch (error) {
    if (!(error instanceof ApiRequestError && error.status === 401)) throw error
    // Either the change already went through, or another phone signed this one out (then this
    // is refused too, and the phone shows it is signed out).
    await api.replaceMerchantToken(session.shopId, next, next)
  }
  const signedIn = { ...session, token: next, nextToken: undefined }
  setMerchantSession(signedIn)
  return signedIn
}
