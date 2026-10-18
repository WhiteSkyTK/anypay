// base64url without padding, the same in browsers and Node: used for nonces, signatures and the
// merchant token a phone picks when it signs out its shop's other phones.

export function toBase64url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (byte) => String.fromCodePoint(byte)).join('')
  const base64 = btoa(binary)
  const padding = base64.indexOf('=') // base64url has no padding
  return (padding === -1 ? base64 : base64.slice(0, padding))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
}

export function fromBase64url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'))
  return Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0)
}

/** `byteLength` cryptographically random bytes as base64url (32 bytes: 43 characters). */
export function randomBase64url(byteLength: number): string {
  return toBase64url(crypto.getRandomValues(new Uint8Array(byteLength)))
}
