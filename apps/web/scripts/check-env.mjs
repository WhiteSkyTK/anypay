// Fails a deploy build early when VITE_API_URL can't be right. It is baked into the app, so a typo
// (https://anypay-api.onrender, missing .com) only showed up as "No connection" on every phone.
// Runs before `vite build`; without VITE_API_URL (local dev, CI) there is nothing to check.
import { lookup } from 'node:dns/promises'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'

const envDir = fileURLToPath(new URL('../../../', import.meta.url))
const apiUrl = loadEnv('production', envDir, 'VITE_').VITE_API_URL ?? ''

function fail(message) {
  console.error(`VITE_API_URL: ${message}`)
  process.exit(1)
}

if (apiUrl) {
  let url
  try {
    url = new URL(apiUrl)
  } catch {
    fail(`"${apiUrl}" is not a URL. Use the API's address, e.g. https://anypay-api.onrender.com`)
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !local) fail('use https:// (phones block plain http requests)')
  if (url.pathname !== '/' || url.search)
    fail(`use only the address, without a path: ${url.origin}`)
  try {
    await lookup(url.hostname)
  } catch {
    fail(`the host ${url.hostname} doesn't exist. Check for typos, e.g. a missing .com`)
  }
  console.log(`VITE_API_URL: ${url.origin}`)
}
