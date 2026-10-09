/**
 * The wallet provider most people here use. Its addresses all look like `$<host>/<name>`, so the
 * wallet field asks only for the name. Other providers still work: the field switches to a full
 * address (interoperability is the point of Open Payments).
 */
export const DEFAULT_WALLET_HOST: string =
  import.meta.env.VITE_WALLET_HOST || 'ilp.interledger-test.dev'

const escapeRegExp = (text: string) => text.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)

const onHost = (host: string) => new RegExp(`^(?:\\$|https?://)?${escapeRegExp(host)}/(.+)$`, 'i')

/** The name part of an address on `host` ('' when empty), or null for another provider. */
export function walletName(address: string, host = DEFAULT_WALLET_HOST): string | null {
  const trimmed = address.trim()
  if (trimmed === '') return ''
  const name = onHost(host).exec(trimmed)?.[1]
  return name !== undefined && /^(?:\$|https:\/\/)/.test(trimmed) ? name : null
}

/** The full address for a name on `host`; empty stays empty, so "required" errors still show. */
export const walletAddress = (name: string, host = DEFAULT_WALLET_HOST): string =>
  name === '' ? '' : `$${host}/${name}`

export type NameInput = { name: string } | { address: string }

/**
 * Reads what was typed or pasted into the name field. A full address on `host` is cut down to its
 * name; any other address (another provider) comes back whole, so the field can switch to it.
 */
export function readNameInput(input: string, host = DEFAULT_WALLET_HOST): NameInput {
  const compact = input.replaceAll(/\s+/g, '') // wallet names never contain spaces
  const name = onHost(host).exec(compact)?.[1]
  if (name !== undefined) return { name }
  if (/^(?:\$|https?:\/\/)/.test(compact)) return { address: compact }
  if (compact.includes('/')) return { address: `$${compact}` }
  return { name: compact }
}
