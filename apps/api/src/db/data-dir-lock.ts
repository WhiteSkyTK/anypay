import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

/** Another running API already has this local database open. */
export class DataDirLockedError extends Error {
  constructor(dataDir: string, pid: number) {
    super(
      `Another AnyPay API (process ${pid}) is using the local database in ${dataDir}.\n` +
        'Stop it first (only one `npm run dev` at a time), or give this one its own DATA_DIR.\n' +
        `If no other API is running, delete ${dataDir}.lock and start again.`,
    )
    this.name = 'DataDirLockedError'
  }
}

function isRunning(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0) // signal 0 only checks that the process exists
    return true
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM'
  }
}

function readOwner(lockFile: string): number {
  try {
    return Number(readFileSync(lockFile, 'utf8'))
  } catch {
    return 0
  }
}

/**
 * PGlite is one process per folder: two APIs on the same DATA_DIR corrupt it (it happened when
 * two `npm run dev`s restarted together). This takes `<dataDir>.lock` for the current process,
 * waiting briefly for an owner that is still shutting down, and taking over from one that died
 * without cleaning up. Returns the function that releases it.
 */
export async function lockDataDir(dataDir: string, waitMs = 5000): Promise<() => void> {
  const lockFile = `${dataDir}.lock`
  const deadline = Date.now() + waitMs
  for (;;) {
    try {
      writeFileSync(lockFile, String(process.pid), { flag: 'wx' })
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
    const owner = readOwner(lockFile)
    if (!isRunning(owner)) {
      rmSync(lockFile, { force: true }) // stale: its process is gone
      continue
    }
    if (Date.now() >= deadline) throw new DataDirLockedError(dataDir, owner)
    await sleep(250)
  }
  return () => {
    if (readOwner(lockFile) === process.pid) rmSync(lockFile, { force: true })
  }
}
