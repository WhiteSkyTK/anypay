import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

function isWorkspaceRoot(dir: string): boolean {
  const manifest = join(dir, 'package.json')
  if (!existsSync(manifest)) return false
  return 'workspaces' in (JSON.parse(readFileSync(manifest, 'utf8')) as object)
}

/**
 * The monorepo root: the nearest folder upwards whose package.json declares workspaces. Found by
 * walking up, so it is the same from src/ (dev), dist/ (bundled build) and the CLI.
 */
export function findRepoRoot(from: string = dirname(fileURLToPath(import.meta.url))): string {
  for (let dir = from; ; dir = dirname(dir)) {
    if (isWorkspaceRoot(dir)) return dir
    if (dirname(dir) === dir) return process.cwd()
  }
}

/** One .env at the repo root serves both apps. Hosting sets real env vars, so no file is fine. */
export function loadDotEnv(root: string = findRepoRoot()): void {
  try {
    process.loadEnvFile(join(root, '.env'))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
}
