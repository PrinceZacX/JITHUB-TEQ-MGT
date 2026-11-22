// Drizzle Kit configuration.
// migrations are authored manually in lib/db/migrations/ and reviewed
// before application. DATABASE_URL is read at runtime from the environment.
export default {
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  driver: 'pg',
}
