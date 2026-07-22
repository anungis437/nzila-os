#!/usr/bin/env node
/**
 * Platform migration runner.
 *
 * Applies every SQL file in `packages/db/drizzle/*.sql` (sorted lexicographically
 * by the leading 4-digit prefix) to the database identified by DATABASE_URL,
 * skipping files whose SHA-256 content hash is already recorded in
 * `drizzle.__drizzle_migrations`.
 *
 * Why this exists
 * ---------------
 *   * `drizzle-kit migrate` reads only files journaled in
 *     `packages/db/drizzle/meta/_journal.json`. The journal in this repository
 *     covers only 5 of 34 platform migration files; the remaining 29 files were
 *     added by hand as raw SQL. Running `drizzle-kit migrate` against a fresh
 *     database therefore silently omits them.
 *   * The Union Eyes bootstrap
 *     (`tooling/scripts/run-union-eyes-drizzle-bootstrap.mjs`) applies a
 *     different, Union-Eyes-scoped cache. It does not touch
 *     `packages/db/drizzle/`.
 *   * Every previous run assumed maintainers would apply platform migrations
 *     by hand with `psql -f`. Drift was silent by default.
 *
 * Contract
 * --------
 *   * All SQL files under `packages/db/drizzle/` matching `[0-9]{4}_*.sql` are
 *     applied in ascending order of their 4-digit prefix.
 *   * Each file is executed in its own transaction. On error, the transaction
 *     is rolled back and the runner exits non-zero.
 *   * A row (`filename`, `hash`, `created_at`) is inserted into
 *     `drizzle.__platform_migrations` after a successful application. `hash`
 *     is the SHA-256 of the raw file bytes. This tracking table is deliberately
 *     separate from `drizzle.__drizzle_migrations`, which is owned by
 *     drizzle-kit and by the Union Eyes scoped bootstrap.
 *   * Files whose hash is already in `drizzle.__platform_migrations` are
 *     skipped (idempotent).
 *   * `--check` runs a dry-run: it reports the pending set without applying.
 *   * `--verify` fails if there is any pending migration. Intended for CI and
 *     for the `db:migration:safety` gate.
 *   * `--baseline` records every discovered file into
 *     `drizzle.__platform_migrations` as already-applied, without executing
 *     any SQL. This is the one-time transition path for databases whose
 *     platform migrations were previously applied by hand.
 *
 * Non-goals
 * ---------
 *   * Does not modify historical migration files.
 *   * Does not touch `drizzle.__drizzle_migrations`.
 *   * Does not touch the Union Eyes scoped cache.
 *
 * Usage
 * -----
 *   node tooling/scripts/apply-platform-migrations.mjs             # apply pending
 *   node tooling/scripts/apply-platform-migrations.mjs --check     # dry run
 *   node tooling/scripts/apply-platform-migrations.mjs --verify    # fail if pending
 *   node tooling/scripts/apply-platform-migrations.mjs --baseline  # mark all as applied
 *
 *   DATABASE_URL must be set. .env.local at repo root and at
 *   apps/union-eyes/.env.local are consulted in that order for a fallback.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const migrationsDir = path.join(repoRoot, 'packages', 'db', 'drizzle');

const MIGRATION_FILE_RE = /^(\d{4})_[^/\\]+\.sql$/;

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  loadEnv({ path: path.join(repoRoot, '.env.local') });
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  loadEnv({ path: path.join(repoRoot, 'apps', 'union-eyes', '.env.local') });
  return process.env.DATABASE_URL;
}

function listMigrationFiles() {
  const files = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((e) => e.isFile() && MIGRATION_FILE_RE.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => {
      const ai = Number(a.match(MIGRATION_FILE_RE)[1]);
      const bi = Number(b.match(MIGRATION_FILE_RE)[1]);
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b);
    });
  return files.map((name) => {
    const full = path.join(migrationsDir, name);
    const sql = fs.readFileSync(full, 'utf8');
    const hash = crypto.createHash('sha256').update(sql).digest('hex');
    return { name, full, sql, hash };
  });
}

async function ensureTrackingTable(client) {
  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__platform_migrations (
      id SERIAL PRIMARY KEY,
      filename text NOT NULL,
      hash text NOT NULL UNIQUE,
      created_at bigint NOT NULL
    )
  `);
}

async function loadAppliedHashes(client) {
  const res = await client.query('SELECT hash FROM drizzle.__platform_migrations');
  return new Set(res.rows.map((r) => r.hash));
}

function log(msg) {
  process.stdout.write(`[migrate] ${msg}\n`);
}

function warn(msg) {
  process.stderr.write(`[migrate:warn] ${msg}\n`);
}

function fail(msg, code = 1) {
  process.stderr.write(`[migrate:fail] ${msg}\n`);
  process.exit(code);
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has('--check');
  const verify = args.has('--verify');
  const baseline = args.has('--baseline');

  const conflicting = [dryRun, verify, baseline].filter(Boolean).length;
  if (conflicting > 1) {
    fail('--check, --verify, and --baseline are mutually exclusive.');
  }

  const databaseUrl = loadDatabaseUrl();
  if (!databaseUrl) {
    fail('DATABASE_URL is not set. Set it in the shell or in .env.local.');
  }

  const files = listMigrationFiles();
  if (files.length === 0) {
    log('No migration files found under packages/db/drizzle/. Nothing to do.');
    return;
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await ensureTrackingTable(client);
    const applied = await loadAppliedHashes(client);

    const pending = files.filter((f) => !applied.has(f.hash));
    log(`discovered ${files.length} SQL files; ${applied.size} hashes already recorded; ${pending.length} pending.`);

    if (baseline) {
      if (applied.size > 0) {
        log('Baseline requested but tracking table is non-empty. Only new files will be recorded.');
      }
      let recorded = 0;
      for (const p of pending) {
        await client.query(
          'INSERT INTO drizzle.__platform_migrations (filename, hash, created_at) VALUES ($1, $2, $3) ON CONFLICT (hash) DO NOTHING',
          [p.name, p.hash, Date.now()],
        );
        recorded += 1;
      }
      log(`baselined ${recorded} file(s) without executing any SQL.`);
      return;
    }

    if (pending.length === 0) {
      log('All migrations already applied.');
      return;
    }

    if (verify) {
      const list = pending.map((p) => p.name).join(', ');
      fail(`verify failed: ${pending.length} pending migration(s): ${list}`, 2);
    }

    if (dryRun) {
      log('Dry run. The following files would be applied in order:');
      for (const p of pending) log(`  - ${p.name}  (sha256=${p.hash.slice(0, 12)}…)`);
      return;
    }

    for (const p of pending) {
      log(`applying ${p.name}`);
      try {
        await client.query('BEGIN');
        await client.query(p.sql);
        await client.query(
          'INSERT INTO drizzle.__platform_migrations (filename, hash, created_at) VALUES ($1, $2, $3)',
          [p.name, p.hash, Date.now()],
        );
        await client.query('COMMIT');
        log(`  applied ${p.name}`);
      } catch (err) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // ignore
        }
        fail(`failure applying ${p.name}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    log(`Done. Applied ${pending.length} migration(s).`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.stack || err.message : String(err));
});
