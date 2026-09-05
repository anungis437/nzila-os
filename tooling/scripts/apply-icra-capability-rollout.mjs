#!/usr/bin/env node
/**
 * apply-icra-capability-rollout.mjs — the deterministic, idempotent
 * existing-environment gate for
 * db/migrations-cache/0005_add_icra_assessment_capability_token.sql.
 *
 * This exists because "the migration is tracked in the scoped Drizzle
 * journal" does not by itself prove "an existing environment's database
 * has these columns before capability-dependent application code is
 * deployed to it" — that requires an executable gate, not operator
 * memory. See docs/union-eyes/reality-remediation/
 * 28_RLS_PRIVILEGED_CALLER_AND_ORG_CONTEXT_AUDIT.md, "Migration
 * governance for the capability columns".
 *
 * Two modes:
 *
 *   --check   Read-only. Reports the scoped-migration ledger status for
 *             every journal entry and whether icra_assessments has the
 *             two capability columns. Exits 0 only if the target tag
 *             (0005_add_icra_assessment_capability_token) is applied AND
 *             both columns exist. Never mutates. Safe to run against a
 *             shared/staging environment at any time.
 *
 *   --apply   Applies ONLY the target tag, via the SAME shared executor
 *             used by fresh bootstrap (lib/union-eyes-scoped-migrations.mjs)
 *             — no hand-written copy of the DDL. Refuses if any journal
 *             entry preceding the target tag (0000-0004) is not already
 *             recorded as applied, so this can never silently replay or
 *             skip ahead of an environment whose scoped-migration ledger
 *             does not yet reflect reality. Re-verifies via --check logic
 *             after applying. Idempotent — safe to re-run.
 *
 * Required env: RLS_MIGRATION_ADMIN_DATABASE_URL (or ADMIN_DATABASE_URL),
 * matching apply-rls-foundation-migration.ts's authority model. Never
 * prints the connection string.
 *
 * Required rollout ordering (existing environments):
 *   1. apply-icra-capability-rollout.mjs --apply   (this script)
 *   2. apply-rls-foundation-migration.ts            (0108)
 *   3. provision-runtime-db-roles.ts
 *   4. Key Vault credential update
 *   5. enable RLS enforcement
 *   6. deploy application code
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';
import {
  getScopedMigrationStatus,
  applyScopedMigrations,
} from './lib/union-eyes-scoped-migrations.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const appRoot = path.join(repoRoot, 'apps', 'union-eyes');

export const TARGET_TAG = '0005_add_icra_assessment_capability_token';
const JOURNAL_PATH = path.join(appRoot, 'db', 'migrations-cache', 'meta', '_journal.json');
const MIGRATIONS_DIR = path.join(appRoot, 'db', 'migrations-cache');
const REQUIRED_COLUMNS = ['capability_token_hash', 'capability_token_expires_at'];

async function getCapabilityColumnStatus(client) {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'icra_assessments'
       AND column_name = ANY($1)`,
    [REQUIRED_COLUMNS],
  );
  const present = new Set(result.rows.map((r) => r.column_name));
  return REQUIRED_COLUMNS.reduce((acc, col) => ({ ...acc, [col]: present.has(col) }), {});
}

/** Read-only. Never mutates. */
export async function runCheck(client, { journalPath = JOURNAL_PATH, migrationsDir = MIGRATIONS_DIR } = {}) {
  const status = await getScopedMigrationStatus(client, { journalPath, migrationsDir });
  const targetEntry = status.find((s) => s.tag === TARGET_TAG);
  if (!targetEntry) {
    throw new Error(`Target tag ${TARGET_TAG} not found in journal at ${journalPath}.`);
  }
  const columns = await getCapabilityColumnStatus(client);
  const columnsPresent = Object.values(columns).every(Boolean);
  const verdict = targetEntry.applied && columnsPresent ? 'GO' : 'NO_GO';
  return { status, targetEntry, columns, verdict };
}

/** Idempotent. Applies only TARGET_TAG; refuses if preceding entries are unrecorded. */
export async function runApply(client, { journalPath = JOURNAL_PATH, migrationsDir = MIGRATIONS_DIR, log = () => {} } = {}) {
  const result = await applyScopedMigrations(client, {
    journalPath,
    migrationsDir,
    onlyTags: [TARGET_TAG],
    log,
  });
  const verification = await runCheck(client, { journalPath, migrationsDir });
  if (verification.verdict !== 'GO') {
    throw new Error(
      `Post-apply verification failed for ${TARGET_TAG}: ${JSON.stringify(verification)}`,
    );
  }
  return { ...result, verification };
}

async function main() {
  const mode = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--check') ? 'check' : null;
  if (!mode) {
    console.error('[icra-capability-rollout] Usage: apply-icra-capability-rollout.mjs --check | --apply');
    process.exit(1);
  }

  loadEnv({ path: path.join(appRoot, '.env.local') });
  const adminUrl = process.env.RLS_MIGRATION_ADMIN_DATABASE_URL || process.env.ADMIN_DATABASE_URL;
  if (!adminUrl) {
    console.error('[icra-capability-rollout] Missing RLS_MIGRATION_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL.');
    process.exit(1);
  }

  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    if (mode === 'check') {
      const result = await runCheck(client);
      console.log(`[icra-capability-rollout] tag=${TARGET_TAG} hash=${result.targetEntry.hash}`);
      console.log(`[icra-capability-rollout] applied=${result.targetEntry.applied} columns=${JSON.stringify(result.columns)}`);
      console.log(`[icra-capability-rollout] verdict=${result.verdict}`);
      process.exit(result.verdict === 'GO' ? 0 : 1);
    } else {
      const result = await runApply(client, { log: (m) => console.log(`[icra-capability-rollout] ${m}`) });
      console.log(`[icra-capability-rollout] applied=${JSON.stringify(result.appliedTags)}`);
      console.log(`[icra-capability-rollout] verdict=${result.verification.verdict}`);
      process.exit(result.verification.verdict === 'GO' ? 0 : 1);
    }
  } catch (err) {
    console.error(`[icra-capability-rollout] FAIL: ${err.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
