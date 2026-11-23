import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { getDatabaseUrl } from '../env'
import * as schema from './schema'

// Fail closed when DATABASE_URL is missing or malformed. Passing undefined to
// pg.Pool silently selects localhost, which hides configuration mistakes.
export const pool = new Pool({
  connectionString: getDatabaseUrl(),
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
})

pool.on('error', (error: NodeJS.ErrnoException) => {
  // Do not log connection strings, credentials, or full driver error details.
  console.error('[db] Unexpected idle PostgreSQL client error', {
    code: error.code ?? 'UNKNOWN',
  })
})

export const db = drizzle(pool, { schema })
