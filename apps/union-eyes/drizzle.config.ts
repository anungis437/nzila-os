/**
 * Drizzle ORM — UnionEyes runtime support / cache schema (scoped).
 *
 * SCOPE GOVERNANCE
 * ----------------
 * Per docs/architecture/orm-governance/orm-authority-governance.md, this
 * Drizzle configuration is restricted to:
 *
 *   - cache schemas
 *   - governance runtime schemas
 *   - continuity observability schemas
 *   - attestation / evidence support schemas
 *   - operational projection schemas (read-models)
 *
 * Drizzle MUST NOT declare or migrate canonical operational business
 * entities (organizations, users, unions, grievances, claims, bargaining,
 * billing, compliance, etc.). Those are owned by Django and live under
 * apps/union-eyes/backend/<app>/migrations/.
 *
 * MIGRATION OUTPUT
 * ----------------
 * `out` points at the scoped migration root ./db/migrations-cache/.
 * The historical lineage at ./db/migrations/ is FROZEN and must not be
 * replayed against fresh databases. See:
 *   - docs/architecture/orm-governance/historical-migration-lineage-governance.md
 *   - apps/union-eyes/db/migrations/LINEAGE-FROZEN.md
 *
 * SCHEMA INPUT
 * ------------
 * Only the explicitly scoped barrel `./db/schema-cache/cache.ts` is fed
 * to drizzle-kit. Adding new tables here is a governance event — see
 * docs/architecture/orm-governance/drizzle-scope-reconstruction.md.
 */
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });

export default defineConfig({
  schema: "./db/schema-cache/cache.ts",
  out: "./db/migrations-cache",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
