import { fileURLToPath } from 'node:url'
import { createApp } from './app'
import { EnvError, parseEnv } from './config/env'
import { createContainer } from './container'

/**
 * One .env at the repo root serves both apps. Hosting platforms set real environment variables
 * instead, so a missing file is fine. Same relative path from src/ (dev) and dist/ (build).
 */
function loadDotEnv(): void {
  try {
    process.loadEnvFile(fileURLToPath(new URL('../../../.env', import.meta.url)))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}

function main(): void {
  loadDotEnv()
  const env = parseEnv(process.env)
  const container = createContainer(env)
  const { logger } = container

  const server = createApp(container).listen(env.PORT, (error) => {
    if (error) throw error
    logger.info({ port: env.PORT, demoMode: env.DEMO_MODE }, 'AnyPay API listening')
  })

  const shutdown = () => server.close(() => process.exit(0))
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

try {
  main()
} catch (error) {
  if (!(error instanceof EnvError)) throw error
  console.error(error.message)
  process.exit(1)
}
