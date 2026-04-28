import { defineConfig } from 'drizzle-kit'

/**
 * Generates SQL migrations into ./server/db/migrations from the schema in
 * ./server/db/schema.ts. Run with `pnpm --filter @nzila/nzila-hq db:generate`.
 *
 * The HQ DB is a *read-and-aggregate* surface — it owns its own narrow set
 * of tables (`hq_*` prefix) so it never collides with peer apps that may
 * share the same Postgres instance.
 */
export default defineConfig({
  schema: './server/db/schema.ts',
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgresql://nzila:nzila_dev@localhost:5433/nzila_automation',
  },
  strict: true,
  verbose: true,
})
