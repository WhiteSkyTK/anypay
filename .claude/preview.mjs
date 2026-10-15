// Claude's own preview of the app, next to the team's `npm run dev`: web on 5199 (dev) or 4199
// (`build`: the production build, for Lighthouse), API on 3199, local data in .data/claude and
// never the hosted database. Started via .claude/launch.json.
import { spawn } from 'node:child_process'

const api = {
  ...process.env,
  DATABASE_URL: '', // empty counts as unset: embedded PGlite, never production data
  DATA_DIR: '.data/claude',
  PORT: '3199',
  WEB_ORIGIN: 'http://localhost:5199',
  PUBLIC_API_URL: 'http://localhost:5199', // the web dev server forwards /api
}
const web = { ...process.env, API_PROXY_TARGET: 'http://localhost:3199' }

// One command string (no separate args): with a shell, Node would only join them anyway.
const run = (command, env) =>
  spawn(command, { stdio: ['ignore', 'inherit', 'inherit'], shell: true, env })

const children = [
  run('npm run dev -w @anypay/api', api),
  process.argv[2] === 'build'
    ? run('npm run preview -w @anypay/web -- --port 4199 --strictPort', web)
    : run('npm run dev -w @anypay/web -- --port 5199 --strictPort', web),
]
const stop = () => children.forEach((child) => child.kill())
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
children.forEach((child) => child.on('exit', stop))
