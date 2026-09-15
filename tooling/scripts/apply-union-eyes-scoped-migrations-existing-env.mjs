#!/usr/bin/env node
/**
 * apply-union-eyes-scoped-migrations-existing-env.mjs — governed,
 * fail-closed CLI for applying the full Union Eyes scoped Drizzle
 * migration chain (apps/union-eyes/db/migrations-cache/) to an existing
 * environment, without going through the broader fresh-bootstrap
 * orchestrator (run-union-eyes-drizzle-bootstrap.mjs).
 *
 * Unlike apply-icra-capability-rollout.mjs (which targets ONLY
 * 0005_add_icra_assessment_capability_token via onlyTags), this CLI
 * applies every pending journal entry in order — it is the narrow,
 * already-reviewed alternative to db:bootstrap for existing environments
 * whose scoped-migration ledger is behind the frozen journal.
 *
 * This script contains NO path that installs extensions, restores a
 * snapshot, materializes a QA/CI baseline, writes a bootstrap
 * attestation, or replays the frozen historical Drizzle lineage that
 * predates the scoped migrations-cache directory — it operates
 * exclusively on apps/union-eyes/db/migrations-cache/ through the shared
 * executor at lib/union-eyes-scoped-migrations.mjs, which it does not
 * duplicate.
 *
 * Modes (exactly one required):
 *
 *   --check   Strictly read-only. Reports every scoped journal entry's
 *             tag/hash/applied status plus a total/applied/pending
 *             summary. Never creates the ledger table/schema — if the
 *             ledger is absent, every entry is reported pending without
 *             mutating the database.
 *
 *   --apply   Applies all pending journal entries in order via the
 *             shared executor's applyScopedMigrations(), with onlyTags
 *             NOT set (full ordered application). Re-verifies via the
 *             same read-only check logic afterward and fails (non-zero
 *             exit) if any journal entry remains pending.
 *
 * Supplying both --check and --apply is treated as an ambiguous command
 * and fails closed (non-zero exit, before any DB connection is opened).
 *
 * Required env: RLS_MIGRATION_ADMIN_DATABASE_URL (or ADMIN_DATABASE_URL),
 * which must already be present in the process environment — this CLI
 * never reads any local credential file of its own. Fails closed
 * (non-zero exit, no DB connection attempted) if neither is set. Never
 * prints the connection string or any credential value. Does not
 * retrieve Key Vault credentials itself — credential acquisition is the
 * responsibility of the separately authorized execution environment.
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import {
  applyScopedMigrations,
  computeMigrationHash,
  readJournalEntries,
} from './lib/union-eyes-scoped-migrations.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const appRoot = path.join(repoRoot, 'apps', 'union-eyes');

const JOURNAL_PATH = path.join(appRoot, 'db', 'migrations-cache', 'meta', '_journal.json');
const MIGRATIONS_DIR = path.join(appRoot, 'db', 'migrations-cache');

async function ledgerTableExists(client) {
  const result = await client.query("SELECT to_regclass('drizzle.__drizzle_migrations') AS regclass");
  return Boolean(result.rows?.[0]?.regclass);
}

/**
 * Strictly read-only. Never calls the shared executor's
 * ensureLedgerTable() (which would CREATE SCHEMA/TABLE IF NOT EXISTS) —
 * a missing ledger is reported as "all entries pending" instead.
 */
export async function runCheck(client, { journalPath = JOURNAL_PATH, migrationsDir = MIGRATIONS_DIR } = {}) {
  const entries = readJournalEntries(journalPath);
  const ledgerExists = await ledgerTableExists(client);

  let appliedHashes = new Set();
  if (ledgerExists) {
    const result = await client.query('SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id');
    appliedHashes = new Set(result.rows.map((r) => r.hash));
  }

  const statuses = entries.map((entry) => {
    const { hash } = computeMigrationHash(migrationsDir, entry.tag);
    return { tag: entry.tag, hash, applied: appliedHashes.has(hash) };
  });
  const applied = statuses.filter((s) => s.applied).length;
  const pending = statuses.length - applied;

  return { ledgerExists, statuses, total: statuses.length, applied, pending };
}

/**
 * Applies every pending journal entry, in order, via the shared
 * executor (onlyTags intentionally NOT set — full ordered application).
 * Re-verifies via runCheck() afterward; throws if anything is still
 * pending post-apply.
 */
export async function runApply(client, { journalPath = JOURNAL_PATH, migrationsDir = MIGRATIONS_DIR, log = () => {} } = {}) {
  const preflight = await runCheck(client, { journalPath, migrationsDir });
  log(
    `preflight: total=${preflight.total} applied=${preflight.applied} pending=${preflight.pending}`,
  );
  log(`ordered journal tags: ${preflight.statuses.map((s) => s.tag).join(', ')}`);

  const result = await applyScopedMigrations(client, { journalPath, migrationsDir, log });

  const postcheck = await runCheck(client, { journalPath, migrationsDir });
  if (postcheck.pending > 0) {
    throw new Error(
      `Post-apply verification failed: ${postcheck.pending} journal migration(s) still pending after apply.`,
    );
  }

  return {
    appliedCount: result.applied,
    appliedTags: result.appliedTags,
    finalApplied: postcheck.applied,
    finalPending: postcheck.pending,
  };
}

function printUsage() {
  console.error(
    '[scoped-migrate-existing-env] Usage: apply-union-eyes-scoped-migrations-existing-env.mjs --check | --apply (exactly one)',
  );
}

async function main() {
  const wantsCheck = process.argv.includes('--check');
  const wantsApply = process.argv.includes('--apply');

  if (wantsCheck && wantsApply) {
    console.error(
      '[scoped-migrate-existing-env] Conflicting flags: --check and --apply both supplied. Refusing (fail closed).',
    );
    process.exit(1);
    return;
  }

  const mode = wantsApply ? 'apply' : wantsCheck ? 'check' : null;
  if (!mode) {
    printUsage();
    process.exit(1);
    return;
  }

  const adminUrl = process.env.RLS_MIGRATION_ADMIN_DATABASE_URL || process.env.ADMIN_DATABASE_URL;
  if (!adminUrl) {
    console.error(
      '[scoped-migrate-existing-env] Missing RLS_MIGRATION_ADMIN_DATABASE_URL / ADMIN_DATABASE_URL. Refusing (fail closed).',
    );
    process.exit(1);
    return;
  }

  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    if (mode === 'check') {
      const result = await runCheck(client);
      for (const s of result.statuses) {
        console.log(`[scoped-migrate-existing-env] tag=${s.tag} hash=${s.hash} applied=${s.applied}`);
      }
      console.log(
        `[scoped-migrate-existing-env] ledger_exists=${result.ledgerExists} total=${result.total} applied=${result.applied} pending=${result.pending}`,
      );
      process.exit(0);
    } else {
      const result = await runApply(client, { log: (m) => console.log(`[scoped-migrate-existing-env] ${m}`) });
      console.log(`[scoped-migrate-existing-env] applied_count=${result.appliedCount}`);
      console.log(`[scoped-migrate-existing-env] applied_tags=${JSON.stringify(result.appliedTags)}`);
      console.log(
        `[scoped-migrate-existing-env] final_applied=${result.finalApplied} final_pending=${result.finalPending}`,
      );
      process.exit(result.finalPending === 0 ? 0 : 1);
    }
  } catch (err) {
    console.error(`[scoped-migrate-existing-env] FAIL: ${err.message}`);
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
