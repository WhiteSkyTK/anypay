import { resolve } from 'node:path'
import { createApp } from './app'
import { EnvError, parseEnv } from './config/env'
import { PrivateKeyError } from './config/private-key'
import { findRepoRoot, loadDotEnv } from './config/repo-root'
import { createContainer } from './container'
import { DataDirLockedError } from './db/data-dir-lock'
import { migrate, openDatabase } from './db/database'
import { checkPublicUrl } from './lib/public-url-check'

const DAY_MS = 24 * 60 * 60 * 1000

async function main(): Promise<void> {
  const root = findRepoRoot()
  loadDotEnv(root)
  const env = parseEnv(process.env)
  const database = await openDatabase({
    url: env.DATABASE_URL,
    // resolve, not join: DATA_DIR may also be an absolute path (a mounted disk, a temp folder).
    dataDir: resolve(root, env.DATA_DIR, 'pglite'),
  })
  await migrate(database.db)
  const container = createContainer(env, database.db)
  const { logger } = container

  const server = createApp(container).listen(env.PORT, (error) => {
    if (error) throw error
    logger.info(
      { port: env.PORT, demoMode: env.DEMO_MODE, database: database.kind },
      'AnyPay API listening',
    )
  })
  const resumed = await container.paymentService.resumeWatching()
  if (resumed > 0) logger.info({ resumed }, 'Resumed watching payments in flight')
  const purged = await container.idempotency.purgeOlderThan(new Date(Date.now() - DAY_MS))
  if (purged > 0) logger.info({ purged }, 'Removed old idempotency records')
  if (env.NODE_ENV === 'production') void checkPublicUrl(env.PUBLIC_API_URL, logger)

  const shutdown = () => {
    server.close(() => void database.close().finally(() => process.exit(0)))
    // Live feeds (SSE) never end by themselves; without this, close() would wait for them forever
    // and the local database would never be closed cleanly.
    server.closeAllConnections()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

main().catch((error: unknown) => {
  const expected = [EnvError, PrivateKeyError, DataDirLockedError]
  if (!(error instanceof Error) || !expected.some((type) => error instanceof type)) throw error
  console.error(error.message)
  process.exit(1)
})
