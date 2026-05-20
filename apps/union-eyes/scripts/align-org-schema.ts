/**
 * Idempotent schema-alignment script for local development.
 *
 * Runs automatically via the `predev` npm lifecycle hook before `next dev`
 * starts. Adds any columns that exist in the Drizzle schema
 * (db/schema-organizations.ts) but are absent from the actual database.
 *
 * All statements use ADD COLUMN IF NOT EXISTS so this is safe to run
 * repeatedly and will never destructively modify data.
 *
 * This permanently addresses the recurring "column does not exist (42703)"
 * runtime failures caused by drift between the Drizzle schema and the
 * local development database.
 */

import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn('[align-org-schema] DATABASE_URL not set — skipping schema alignment');
  process.exit(0);
}

const sql = postgres(DATABASE_URL, {
  max: 1,
  ssl: DATABASE_URL.includes('sslmode=require') ? 'require' : false,
  // Suppress expected "column already exists" NOTICE messages
  onnotice: () => {},
});

const STATEMENTS: string[] = [
  // ── Core identity / relationship ──────────────────────────────────────
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS name text`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS email text`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS phone text`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS role text`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS is_primary boolean DEFAULT false`,

  // ── Employment / contact details ──────────────────────────────────────
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS department text`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS location text`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS position text`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS hire_date timestamptz`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS membership_number text`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS seniority integer`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS union_join_date timestamptz`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS preferred_contact_method text`,

  // ── Per-capita exemptions (Phase 5A) ──────────────────────────────────
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS member_category text`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS exempt_from_per_capita boolean`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS exemption_reason text`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS exemption_approved_by varchar(255)`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS exemption_approved_at timestamptz`,

  // ── Metadata / search ─────────────────────────────────────────────────
  // metadata stored as jsonb; older local DBs may have it as text — the
  // DO block below handles the type migration safely.
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS search_vector text`,

  // ── Timestamps ────────────────────────────────────────────────────────
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now()`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS joined_at timestamptz DEFAULT now()`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now()`,
  `ALTER TABLE organization_members ADD COLUMN IF NOT EXISTS deleted_at timestamptz`,
];

// Separate statement: convert metadata text → jsonb if needed
const METADATA_FIX = `
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_members'
      AND column_name = 'metadata'
      AND data_type = 'text'
  ) THEN
    ALTER TABLE organization_members
      ALTER COLUMN metadata TYPE jsonb
      USING CASE WHEN metadata IS NULL OR metadata = '' THEN NULL ELSE metadata::jsonb END;
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_members' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE organization_members ADD COLUMN metadata jsonb;
  END IF;
END $$
`;

async function run() {
  try {
    let aligned = 0;
    for (const stmt of STATEMENTS) {
      await sql.unsafe(stmt);
      aligned++;
    }
    await sql.unsafe(METADATA_FIX);

    console.log(`[align-org-schema] organization_members aligned (${aligned} statements, metadata type checked)`);
  } catch (err) {
    console.error('[align-org-schema] Failed to align schema:', err);
    // Non-fatal: let dev server start anyway; the error will surface at query time
  } finally {
    await sql.end();
  }
}

run();
