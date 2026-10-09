// Reports gzipped JS+CSS against the CLAUDE.md low-data budget and fails the build if the
// first load is over it. Runs after every `vite build`; in CI it also writes the job summary.
//
// "First load" of a page = what index.html loads up front plus that page's route chunk and its
// static imports, read from Vite's build manifest. Chunks loaded later on purpose (the quote sheet
// after "Continue", the QR encoder on the poster, other languages) are not part of it.
import { appendFile, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const BUDGET_KB = 200
const dist = fileURLToPath(new URL('../dist/', import.meta.url))

/** @type {Record<string, { file: string, src?: string, isEntry?: boolean, imports?: string[], css?: string[] }>} */
const manifest = JSON.parse(await readFile(join(dist, '.vite', 'manifest.json'), 'utf8'))

const gzipKb = async (file) =>
  gzipSync(await readFile(join(dist, file)), { level: 9 }).length / 1024
const kb = (value) => `${value.toFixed(1)} KB`

/** Every file a manifest entry needs before it can run: itself, its CSS and its static imports. */
function filesFor(key, files = new Set()) {
  const chunk = manifest[key]
  if (!chunk || files.has(chunk.file)) return files
  files.add(chunk.file)
  for (const css of chunk.css ?? []) files.add(css)
  for (const imported of chunk.imports ?? []) filesFor(imported, files)
  return files
}

const sizeOf = async (files) => {
  const sizes = await Promise.all([...files].map(gzipKb))
  return sizes.reduce((total, size) => total + size, 0)
}

const entryFiles = filesFor('index.html')
const pages = Object.keys(manifest).filter((key) => /^src\/pages\/\w+\.tsx$/.test(key))
const pageLoads = await Promise.all(
  pages.map(async (key) => ({
    page: key.replace(/^src\/pages\/|\.tsx$/g, ''),
    size: await sizeOf(filesFor(key, new Set(entryFiles))),
  })),
)
const worst = pageLoads.reduce((max, load) => (load.size > max.size ? load : max), {
  page: 'index.html',
  size: await sizeOf(entryFiles),
})
const allFiles = new Set(
  Object.values(manifest).flatMap((chunk) => [chunk.file, ...(chunk.css ?? [])]),
)
const totalKb = await sizeOf([...allFiles].filter((file) => /\.(js|css)$/.test(file)))

const withinBudget = worst.size <= BUDGET_KB
const report = [
  '### Web bundle size (gzipped)',
  '',
  '| Measure | Size |',
  '| --- | --- |',
  `| App shell (index.html) | ${kb(await sizeOf(entryFiles))} |`,
  `| Heaviest first load (${worst.page}) | ${kb(worst.size)} |`,
  `| All JS + CSS (cached by the service worker) | ${kb(totalKb)} |`,
  `| Budget for first load | ${BUDGET_KB} KB ${withinBudget ? '✅' : '❌'} |`,
  '',
].join('\n')

console.log(`\n${report}`)
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, report)
if (!withinBudget) {
  console.error(
    `First load of ${worst.page} (${kb(worst.size)}) is over the ${BUDGET_KB} KB budget.`,
  )
  process.exitCode = 1
}
