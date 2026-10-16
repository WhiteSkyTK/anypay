import { resolve } from 'node:path'
import { createApp } from './app'
import { EnvError, parseEnv } from './config/env'
import { PrivateKeyError } from './config/private-key'
import { findRepoRoot, loadDotEnv } from './config/repo-root'
import { createContainer } from './container'
import { DataDirLockedError } from './db/data-dir-lock'
import { migrate, openDatabase } from './db/database'
import { checkPublicUrl, strandedPhonesWarning } from './lib/public-url-check'

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
  // Background work (watching payments, settling vouchers) runs outside any request. A rejection
  // there is logged; crashing would drop every shop's live feed and payments in flight.
  process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled rejection'))

  const server = createApp(container).listen(env.PORT, (error) => {
    if (error) throw error
    logger.info(
      { port: env.PORT, demoMode: env.DEMO_MODE, database: database.kind },
      'AnyPay API listening',
    )
  })
  const resumed = await container.paymentService.resumeWatching()
  if (resumed > 0) logger.info({ resumed }, 'Resumed watching payments in flight')
  // Retry records are only needed for a day (the privacy page promises this), and a paid server
  // may run for weeks without a restart: purge at start and every few hours.
  const purgeIdempotency = async () => {
    const purged = await container.idempotency.purgeOlderThan(new Date(Date.now() - DAY_MS))
    if (purged > 0) logger.info({ purged }, 'Removed old idempotency records')
  }
  await purgeIdempotency()
  setInterval(() => {
    purgeIdempotency().catch((error: unknown) => logger.error({ err: error }, 'Purge failed'))
  }, DAY_MS / 4).unref()
  if (env.NODE_ENV === 'production') void checkPublicUrl(env.PUBLIC_API_URL, logger)
  const stranded = strandedPhonesWarning(
    env.WEB_ORIGIN[0] ?? env.PUBLIC_API_URL,
    env.PUBLIC_API_URL,
  )
  if (stranded) logger.warn(stranded)

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
