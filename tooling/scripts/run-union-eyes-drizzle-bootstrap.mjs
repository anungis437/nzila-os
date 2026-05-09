#!/usr/bin/env node
/**
 * Union Eyes — DB Bootstrap Orchestrator
 *
 * Canonical entrypoint to materialize a Union Eyes database from scratch
 * in a governance-legitimate way.
 *
 * Per docs/architecture/orm-governance/migration-execution-governance.md
 * and docs/architecture/orm-governance/fresh-database-bootstrap-reference-implementation.md,
 * this script is the ONLY supported way to prepare a fresh Union Eyes DB.
 *
 * It performs, in order:
 *
 *   1. Connectivity check.
 *   2. Refusal-to-replay assertion against the frozen historical Drizzle
 *      lineage at apps/union-eyes/db/migrations/ (sentinel: .lineage-frozen).
 *   3. Required PostgreSQL extension installation.
 *   4. Optional canonical snapshot restore (Django-owned operational
 *      schema). Controlled by UE_DB_RESTORE_SNAPSHOT_URL.
 *   5. Scoped Drizzle migration application from
 *      apps/union-eyes/db/migrations-cache/ (cache/runtime support only).
 *   6. Bootstrap attestation written to drizzle.bootstrap_attestations.
 *
 * It does NOT:
 *   - replay legacy migrations under db/migrations/
 *   - mutate Django-owned tables
 *   - install secrets, configure environments, or modify networking
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
const appRoot = path.join(repoRoot, 'apps', 'union-eyes');

const LEGACY_MIGRATIONS_DIR = path.join(appRoot, 'db', 'migrations');
const LEGACY_FREEZE_SENTINEL = path.join(LEGACY_MIGRATIONS_DIR, '.lineage-frozen');
const SCOPED_MIGRATIONS_DIR = path.join(appRoot, 'db', 'migrations-cache');
const SCOPED_JOURNAL = path.join(SCOPED_MIGRATIONS_DIR, 'meta', '_journal.json');

const REQUIRED_EXTENSIONS = [
  'uuid-ossp',
  'pgcrypto',
  'pg_trgm',
  'btree_gin',
  'vector',
];

const OPTIONAL_EXTENSIONS = new Set(['vector']);

loadEnv({ path: path.join(appRoot, '.env.local') });
if (!process.env.DATABASE_URL) {
  loadEnv({ path: path.join(appRoot, '.env') });
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  fail('DATABASE_URL is not set. Refusing to bootstrap.');
}

const restoreSnapshotUrl = process.env.UE_DB_RESTORE_SNAPSHOT_URL || '';
const replayOverride = process.env.UE_LINEAGE_REPLAY_OVERRIDE === '1';
const replayReason = process.env.UE_LINEAGE_REPLAY_REASON || '';

function fail(msg) {
  process.stderr.write(`[bootstrap] ${msg}\n`);
  process.exit(1);
}

function info(msg) {
  process.stdout.write(`[bootstrap] ${msg}\n`);
}

async function assertReplayRefusal() {
  if (!fs.existsSync(LEGACY_FREEZE_SENTINEL)) {
    fail(
      'Legacy lineage freeze sentinel missing at ' +
        LEGACY_FREEZE_SENTINEL +
        '. Refusing to proceed — governance contract is broken. See ' +
        'docs/architecture/orm-governance/historical-migration-lineage-governance.md',
    );
  }
  if (replayOverride) {
    if (!replayReason || replayReason.trim().length < 8) {
      fail(
        'UE_LINEAGE_REPLAY_OVERRIDE=1 requires UE_LINEAGE_REPLAY_REASON to be set to a non-trivial reason. Refusing.',
      );
    }
    info(
      `WARNING: lineage replay override ENABLED. Reason: "${replayReason}". This is forensic-only and must never appear in CI/CD or production.`,
    );
  } else {
    info('Legacy lineage freeze respected. Skipping any replay of db/migrations/.');
  }
}

async function ensureExtensions(client) {
  for (const ext of REQUIRED_EXTENSIONS) {
    try {
      await client.query(`CREATE EXTENSION IF NOT EXISTS "${ext}"`);
      info(`extension OK: ${ext}`);
    } catch (err) {
      if (OPTIONAL_EXTENSIONS.has(ext)) {
        info(`extension optional/unavailable: ${ext} (${err.message})`);
        continue;
      }
      fail(`Failed to create extension ${ext}: ${err.message}`);
    }
  }
}

async function maybeRestoreSnapshot() {
  if (!restoreSnapshotUrl) {
    info(
      'UE_DB_RESTORE_SNAPSHOT_URL not set — skipping canonical snapshot restore. ' +
        'In demo/pilot environments this MUST be set per ' +
        'docs/architecture/orm-governance/environment-bootstrap-strategy.md.',
    );
    return { restored: false, snapshotDigest: null };
  }
  info(`Snapshot restore requested: ${restoreSnapshotUrl}`);
  // The actual pg_restore is delegated to a sibling script so this
  // orchestrator does not invoke shell tooling directly. The restore
  // contract is documented in
  // docs/architecture/orm-governance/fresh-database-bootstrap-reference-implementation.md.
  const restoreScript = path.join(
    repoRoot,
    'tooling',
    'scripts',
    'restore-union-eyes-snapshot.mjs',
  );
  const { spawnSync } = await import('node:child_process');
  const result = spawnSync(process.execPath, [restoreScript], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl, UE_DB_RESTORE_SNAPSHOT_URL: restoreSnapshotUrl },
  });
  if (result.status !== 0) {
    fail(`Snapshot restore failed (exit ${result.status}).`);
  }
  return {
    restored: true,
    snapshotDigest: crypto
      .createHash('sha256')
      .update(restoreSnapshotUrl)
      .digest('hex'),
  };
}

async function applyScopedMigrations(client) {
  if (!fs.existsSync(SCOPED_JOURNAL)) {
    fail(
      `Scoped Drizzle journal missing at ${SCOPED_JOURNAL}. Refusing to proceed.`,
    );
  }
  const journal = JSON.parse(fs.readFileSync(SCOPED_JOURNAL, 'utf8'));
  const entries = journal.entries ?? [];

  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  if (entries.length === 0) {
    info('Scoped Drizzle root has zero entries — nothing to migrate. (This is expected immediately after reconciliation.)');
    return { applied: 0 };
  }

  const applied = await client.query(
    'SELECT hash FROM drizzle.__drizzle_migrations ORDER BY id',
  );
  const appliedHashes = new Set(applied.rows.map((r) => r.hash));

  let count = 0;
  for (const entry of entries) {
    const sqlPath = path.join(SCOPED_MIGRATIONS_DIR, `${entry.tag}.sql`);
    if (!fs.existsSync(sqlPath)) {
      fail(`Scoped migration file missing: ${sqlPath}`);
    }
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const hash = crypto.createHash('sha256').update(sql).digest('hex');
    if (appliedHashes.has(hash)) {
      info(`scoped migration already applied: ${entry.tag}`);
      continue;
    }
    info(`applying scoped migration: ${entry.tag}`);
    await client.query('BEGIN');
    try {
      const statements = sql.split('--> statement-breakpoint').map((s) => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        await client.query(stmt);
      }
      await client.query(
        'INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)',
        [hash, entry.when ?? Date.now()],
      );
      await client.query('COMMIT');
      count += 1;
    } catch (err) {
      await client.query('ROLLBACK');
      fail(`Scoped migration ${entry.tag} failed: ${err.message}`);
    }
  }
  return { applied: count };
}

async function writeBootstrapAttestation(client, summary) {
  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.bootstrap_attestations (
      id SERIAL PRIMARY KEY,
      attested_at timestamptz NOT NULL DEFAULT now(),
      git_sha text,
      release_id text,
      environment text,
      snapshot_digest text,
      scoped_migrations_applied integer,
      legacy_replay_override boolean,
      legacy_replay_reason text,
      payload jsonb
    )
  `);
  await client.query(
    `INSERT INTO drizzle.bootstrap_attestations
       (git_sha, release_id, environment, snapshot_digest,
        scoped_migrations_applied, legacy_replay_override,
        legacy_replay_reason, payload)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      process.env.GIT_SHA ?? null,
      process.env.RELEASE_ID ?? null,
      process.env.UE_ENVIRONMENT ?? process.env.NZILA_MODE ?? null,
      summary.snapshotDigest,
      summary.scopedMigrationsApplied,
      replayOverride,
      replayOverride ? replayReason : null,
      JSON.stringify(summary),
    ],
  );
  info('Bootstrap attestation recorded.');
}

async function main() {
  await assertReplayRefusal();

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    info('Ensuring required extensions...');
    await ensureExtensions(client);

    const restoreSummary = await maybeRestoreSnapshot();

    info('Applying scoped Drizzle migrations from db/migrations-cache/ ...');
    const migrateSummary = await applyScopedMigrations(client);

    await writeBootstrapAttestation(client, {
      snapshotDigest: restoreSummary.snapshotDigest,
      restored: restoreSummary.restored,
      scopedMigrationsApplied: migrateSummary.applied,
      timestamp: new Date().toISOString(),
    });

    info('Bootstrap complete.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  process.stderr.write(`[bootstrap] FATAL: ${err.stack || err.message}\n`);
  process.exit(1);
});
