// Reports gzipped JS+CSS against the CLAUDE.md low-data budget and fails the build if the
// first load is over it. Runs after every `vite build`; in CI it also writes the job summary.
import { appendFile, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const BUDGET_KB = 200
const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const assetsDir = join(dist, 'assets')

const gzipKb = async (file) =>
  gzipSync(await readFile(join(assetsDir, file)), { level: 9 }).length / 1024
const kb = (value) => `${value.toFixed(1)} KB`

const files = (await readdir(assetsDir)).filter((file) => /\.(js|css)$/.test(file))
const sizes = new Map(await Promise.all(files.map(async (file) => [file, await gzipKb(file)])))

// Everything index.html loads up front, plus the biggest lazy route chunk as the worst case
// for whichever page a visitor lands on first.
const html = await readFile(join(dist, 'index.html'), 'utf8')
const entryFiles = new Set([...html.matchAll(/\/assets\/([^"]+\.(?:js|css))"/g)].map((m) => m[1]))
const sum = (list) => list.reduce((total, file) => total + (sizes.get(file) ?? 0), 0)
const entryKb = sum([...entryFiles])
const largestLazyKb = Math.max(
  0,
  ...files.filter((f) => !entryFiles.has(f)).map((f) => sizes.get(f)),
)
const firstLoadKb = entryKb + largestLazyKb
const totalKb = sum(files)

const withinBudget = firstLoadKb <= BUDGET_KB
const report = [
  '### Web bundle size (gzipped)',
  '',
  '| Measure | Size |',
  '| --- | --- |',
  `| Entry (index.html) | ${kb(entryKb)} |`,
  `| Worst-case first load (entry + largest route) | ${kb(firstLoadKb)} |`,
  `| All JS + CSS (cached by the service worker) | ${kb(totalKb)} |`,
  `| Budget for first load | ${BUDGET_KB} KB ${withinBudget ? '✅' : '❌'} |`,
  '',
].join('\n')

console.log(`\n${report}`)
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report)
if (!withinBudget) {
  console.error(`First load ${kb(firstLoadKb)} is over the ${BUDGET_KB} KB budget.`)
  process.exitCode = 1
}
