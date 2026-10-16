// npm run seed [-- --name "Demo Spaza"]                  (local: with `npm run dev` running)
// npm run seed -- --target deployed [--name "Demo Spaza"] (the live app on Render)
//
// Creates a demo shop on the shop wallet from DEMO_MERCHANT_WALLET and prints the two links a
// demo needs: one to open on the shop's phone (live feed) and one for the customer (pay screen).
// It goes through the running API, so it works the same with PGlite or a hosted Postgres.
import { CreateShopResponseSchema } from '@anypay/shared'
import { randomUUID } from 'node:crypto'
import { parseArgs } from 'node:util'
import { type Env, parseEnv } from '../config/env'
import { loadDotEnv } from '../config/repo-root'

interface Target {
  api: string
  web: string
}

// Where the seed may send its request: a fixed list, never an address from the command line,
// so the script can't be pointed at an arbitrary server (server-side request forgery).
const TARGETS: Record<string, (env: Env) => Target> = {
  local: (env) => ({
    api: `http://localhost:${env.PORT}`,
    web: env.WEB_ORIGIN[0] ?? 'http://localhost:5173',
  }),
  deployed: () => ({
    api: 'https://anypay-api.onrender.com',
    web: 'https://anypay-web.onrender.com',
  }),
}

function targetFor(name: string, env: Env): Target {
  const target = Object.hasOwn(TARGETS, name) ? TARGETS[name] : undefined
  if (!target) throw new Error(`--target must be one of: ${Object.keys(TARGETS).join(', ')}`)
  return target(env)
}

async function main(): Promise<void> {
  loadDotEnv()
  const env = parseEnv(process.env)
  const { values } = parseArgs({
    options: {
      name: { type: 'string', default: 'Demo Spaza' },
      target: { type: 'string', default: 'local' },
    },
  })
  const walletAddress = env.DEMO_MERCHANT_WALLET
  if (!walletAddress) throw new Error('Set DEMO_MERCHANT_WALLET in .env first')

  const { api, web } = targetFor(values.target, env)
  const res = await fetch(`${api}/api/shops`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
    body: JSON.stringify({ name: values.name, walletAddress }),
  }).catch(() => {
    throw new Error(`Could not reach the API at ${api}. Is it running? (Locally: npm run dev)`)
  })
  if (!res.ok) throw new Error(`The API refused the demo shop (${res.status}): ${await res.text()}`)
  const { shop, merchantToken } = CreateShopResponseSchema.parse(await res.json())

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
  console.log(`  ${web}/s/${shop.id}`)
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
