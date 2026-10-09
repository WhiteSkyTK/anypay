import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { rowsOf } from '../testing/test-database'
import { type DatabaseHandle, migrate, openDatabase } from './database'
import { MIGRATIONS } from './migrations'

describe('migrate', () => {
  let handle: DatabaseHandle

  beforeAll(async () => {
    handle = await openDatabase()
  })
  afterAll(() => handle.close())

  it('creates every table on a fresh database', async () => {
    expect(await migrate(handle.db)).toEqual(MIGRATIONS.map((migration) => migration.name))
    const tables = await handle.db.execute(
      sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
    )
    expect(rowsOf<{ table_name: string }>(tables).map((row) => row.table_name)).toEqual([
      'idempotency_keys',
      'payments',
      'schema_migrations',
      'shops',
    ])
  })

  it('is safe to run again: nothing is applied twice', async () => {
    expect(await migrate(handle.db)).toEqual([])
  })

  it('applies only new migrations', async () => {
    const next = { name: '0002_test', statements: ['CREATE TABLE extra (id int)'] }
    expect(await migrate(handle.db, [next])).toEqual(['0002_test'])
  })

  it('rolls back a migration that fails half-way', async () => {
    const broken = {
      name: '0003_broken',
      statements: ['CREATE TABLE half (id int)', 'THIS IS NOT SQL'],
    }
    await expect(migrate(handle.db, [broken])).rejects.toThrow()
    const half = await handle.db.execute(
      sql`SELECT 1 FROM information_schema.tables WHERE table_name = 'half'`,
    )
    expect(rowsOf(half)).toHaveLength(0)
  })
})
