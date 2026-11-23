import type { Config } from 'drizzle-kit'
import { getDatabaseUrl } from './lib/env'

export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: getDatabaseUrl(),
  },
  verbose: true,
  strict: true,
} satisfies Config
