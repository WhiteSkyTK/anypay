import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const fromHere = (path) => fileURLToPath(new URL(path, import.meta.url))
const pkg = JSON.parse(await readFile(fromHere('../package.json'), 'utf8'))

// Workspace packages ship TypeScript source, so they are bundled in. npm dependencies stay
// external and load from node_modules at runtime, which keeps the output small and debuggable.
const external = Object.keys(pkg.dependencies ?? {})
  .filter((name) => !name.startsWith('@anypay/'))
  .flatMap((name) => [name, `${name}/*`])

await build({
  entryPoints: [fromHere('../src/server.ts')],
  outfile: fromHere('../dist/server.js'),
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external,
  logLevel: 'info',
})
