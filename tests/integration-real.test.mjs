import test from 'node:test'
import assert from 'node:assert/strict'
import { Pool } from 'pg'

/**
 * Read-only integration checks against a dedicated Neon CI branch.
 * The only write is a temporary table inside a transaction that is rolled back.
 * DATABASE_URL_TEST must never point to staging or production.
 */

const testDbUrl = process.env.DATABASE_URL_TEST?.trim()
const appDbUrl = process.env.DATABASE_URL?.trim()

if (!testDbUrl) {
  test('real PostgreSQL integration tests require DATABASE_URL_TEST', {
    skip: 'Configure the isolated CI test database to enable live integration checks.',
  }, () => {})
} else {
  let parsedTestUrl
  try {
    parsedTestUrl = new URL(testDbUrl)
  } catch {
    throw new Error('DATABASE_URL_TEST must be a valid PostgreSQL connection URL.')
  }

  if (parsedTestUrl.protocol !== 'postgres:' && parsedTestUrl.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL_TEST must use the postgres:// or postgresql:// protocol.')
  }

  if (appDbUrl) {
    const appHost = new URL(appDbUrl).hostname.toLowerCase()
    const testHost = parsedTestUrl.hostname.toLowerCase()
    if (appHost === testHost) {
      throw new Error('DATABASE_URL_TEST must use a separate Neon branch from DATABASE_URL.')
    }
  }

  const pool = new Pool({
    connectionString: testDbUrl,
    max: 2,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 10_000,
  })

  test('real PostgreSQL connection reaches the isolated CI database', async () => {
    const { rows: [row] } = await pool.query(
      'SELECT current_database() AS database_name, current_schema() AS schema_name, current_user AS role_name',
    )
    assert.equal(row.database_name, 'neondb')
    assert.equal(row.schema_name, 'public')
    assert.ok(row.role_name)
  })

  test('real PostgreSQL database contains the required application tables', async () => {
    const requiredTables = [
      'user',
      'session',
      'verification',
      'businesses',
      'business_memberships',
      'customers',
      'invoices',
      'payments',
      'receipts',
      'audit_logs',
      'expenses',
      'items',
      'stock_levels',
    ]

    const { rows } = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = $1
         AND table_type = $2
         AND table_name = ANY($3::text[])`,
      ['public', 'BASE TABLE', requiredTables],
    )

    const existing = new Set(rows.map((row) => row.table_name))
    const missing = requiredTables.filter((tableName) => !existing.has(tableName))
    assert.deepEqual(missing, [], `Missing required application tables: ${missing.join(', ')}`)
  })

  test('PostgreSQL transactions support rollback without persistent test data', async () => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('CREATE TEMP TABLE jithub_rollback_probe (id integer PRIMARY KEY)')
      await client.query('INSERT INTO jithub_rollback_probe (id) VALUES (1)')
      await client.query('ROLLBACK')

      const { rows: [row] } = await client.query(
        "SELECT to_regclass('pg_temp.jithub_rollback_probe') AS table_name",
      )
      assert.equal(row.table_name, null)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  })

  test.after(async () => {
    await pool.end()
  })
}
