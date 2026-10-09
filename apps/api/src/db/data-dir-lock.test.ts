import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { DataDirLockedError, lockDataDir } from './data-dir-lock'

describe('lockDataDir', () => {
  let root: string
  let dataDir: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'anypay-lock-'))
    dataDir = join(root, 'pglite')
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('takes the lock for this process and releases it', async () => {
    const release = await lockDataDir(dataDir)
    expect(readFileSync(`${dataDir}.lock`, 'utf8')).toBe(String(process.pid))
    release()
    expect(existsSync(`${dataDir}.lock`)).toBe(false)
  })

  it('takes over a lock left by a process that died without cleaning up', async () => {
    writeFileSync(`${dataDir}.lock`, '999999999')
    const release = await lockDataDir(dataDir)
    expect(readFileSync(`${dataDir}.lock`, 'utf8')).toBe(String(process.pid))
    release()
  })

  it('refuses while another running process holds it', async () => {
    // Our own parent process stands in for "another API that is still running".
    writeFileSync(`${dataDir}.lock`, String(process.ppid))
    await expect(lockDataDir(dataDir, 300)).rejects.toBeInstanceOf(DataDirLockedError)
    expect(readFileSync(`${dataDir}.lock`, 'utf8')).toBe(String(process.ppid))
  })

  it('does not remove a lock that another process has taken since', async () => {
    const release = await lockDataDir(dataDir)
    writeFileSync(`${dataDir}.lock`, String(process.ppid))
    release()
    expect(existsSync(`${dataDir}.lock`)).toBe(true)
  })
})
