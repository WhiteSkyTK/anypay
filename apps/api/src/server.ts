import { createApp } from './app'
import { EnvError, parseEnv } from './config/env'
import { PrivateKeyError } from './config/private-key'
import { loadDotEnv } from './config/repo-root'
import { createContainer } from './container'

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
  if (!(error instanceof EnvError || error instanceof PrivateKeyError)) throw error
  console.error(error.message)
  process.exit(1)
}
