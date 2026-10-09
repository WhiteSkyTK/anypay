// npm run seed [-- --name "Demo Spaza"]   (with `npm run dev` running)
//
// Creates a demo shop on the shop wallet from DEMO_MERCHANT_WALLET and prints the two links a
// demo needs: one to open on the shop's phone (live feed) and one for the customer (pay screen).
// It goes through the running API, so it works the same with PGlite or a hosted Postgres.
import { CreateShopResponseSchema } from '@anypay/shared'
import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'
import { parseEnv } from '../config/env'
import { loadDotEnv } from '../config/repo-root'

async function main(): Promise<void> {
  loadDotEnv()
  const env = parseEnv(process.env)
  const { values } = parseArgs({ options: { name: { type: 'string', default: 'Demo Spaza' } } })
  const walletAddress = env.DEMO_MERCHANT_WALLET
  if (!walletAddress) throw new Error('Set DEMO_MERCHANT_WALLET in .env first')

  const api = `http://localhost:${env.PORT}`
  const res = await fetch(`${api}/api/shops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ name: values.name, walletAddress }),
  }).catch(() => {
    throw new Error(`Could not reach the API at ${api}. Start it with: npm run dev`)
  })
  if (!res.ok) throw new Error(`The API refused the demo shop (${res.status}): ${await res.text()}`)
  const { shop, merchantToken } = CreateShopResponseSchema.parse(await res.json())

  const web = env.WEB_ORIGIN[0] ?? 'http://localhost:5173'
  // The token travels in the URL fragment, which browsers never send to a server or log.
  const merchantLink = `${web}/merchant/connect#shop=${shop.id}&token=${merchantToken}`
  console.log(
    `Demo shop "${shop.name}" (${shop.id}) receives ${shop.assetCode} at ${shop.walletAddress}`,
  )
  console.log()
  console.log('Shop phone (live feed). Keep this link private, it signs the phone in to the shop:')
  console.log(`  ${merchantLink}`)
  console.log()
  console.log('Customer phone (pay screen), or print the poster from the shop phone:')
  console.log(`  ${web}/shop/${shop.id}/pay`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
