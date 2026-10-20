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
 * It performs, in order (tooling/scripts/lib/union-eyes-bootstrap-stages.mjs):
 *
 *   1. Connectivity check.
 *   2. Refusal-to-replay assertion against the frozen historical Drizzle
 *      lineage at apps/union-eyes/db/migrations/ (sentinel: .lineage-frozen).
 *   3. Required PostgreSQL extension installation.
 *   4. Optional canonical snapshot restore, or the QA baseline when the
 *      canonical tables are absent in QA/CI.
 *   5. Scoped migrations through 0013 (roles, grants, RLS helpers).
 *   6. Post-freeze PLATFORM_SQL from db/migrations-platform/.
 *   7. Re-grant of the 0009 table privileges so tables created in step 6
 *      receive the same DML grants. 0009 itself is not rewritten.
 *   8. Scoped migrations after 0013, including the 0014 preflight.
 *   9. Bootstrap attestation written to drizzle.bootstrap_attestations.
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
import {
  applyScopedMigrations as applyScopedMigrationsShared,
  baselineScopedMigrations as baselineScopedMigrationsShared,
  ensureExtensions as ensureExtensionsShared,
  readJournalEntries,
} from './lib/union-eyes-scoped-migrations.mjs';
import {
  applyPlatformMigrations as applyPlatformMigrationsShared,
} from './lib/union-eyes-platform-migrations.mjs';
import {
  PRODUCTION_BOOTSTRAP_ORDER,
  SCOPED_FOUNDATION_THROUGH_TAG,
  tagsThrough,
} from './lib/union-eyes-bootstrap-stages.mjs';
import { read0014RelationNames } from './lib/union-eyes-0014-producer-graph.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');
const appRoot = path.join(repoRoot, 'apps', 'union-eyes');

const LEGACY_MIGRATIONS_DIR = path.join(appRoot, 'db', 'migrations');
const LEGACY_FREEZE_SENTINEL = path.join(LEGACY_MIGRATIONS_DIR, '.lineage-frozen');
const SCOPED_MIGRATIONS_DIR = path.join(appRoot, 'db', 'migrations-cache');
const SCOPED_JOURNAL = path.join(SCOPED_MIGRATIONS_DIR, 'meta', '_journal.json');
const PLATFORM_MIGRATIONS_DIR = path.join(appRoot, 'db', 'migrations-platform');
const PLATFORM_JOURNAL = path.join(PLATFORM_MIGRATIONS_DIR, 'meta', '_journal.json');
const QA_BASELINE_SQL = path.join(repoRoot, 'tooling', 'sql', 'union-eyes-qa-baseline.sql');

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
const isQaOrCiBootstrap =
  process.env.QA_TEST_ENV === 'true' ||
  process.env.UE_QA_GATE === 'true' ||
  process.env.CI === 'true';

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
  try {
    await ensureExtensionsShared(client, { log: info });
  } catch (err) {
    fail(err.message);
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

async function applyScopedMigrations(client, boundary) {
  try {
    return await applyScopedMigrationsShared(client, {
      journalPath: SCOPED_JOURNAL,
      migrationsDir: SCOPED_MIGRATIONS_DIR,
      log: info,
      ...boundary,
    });
  } catch (err) {
    fail(err.message);
  }
}

async function applyPlatformMigrations(client) {
  if (!fs.existsSync(PLATFORM_JOURNAL)) {
    info('No post-freeze PLATFORM_SQL journal found; skipping.');
    return { applied: 0, appliedTags: [] };
  }
  try {
    return await applyPlatformMigrationsShared(client, {
      journalPath: PLATFORM_JOURNAL,
      migrationsDir: PLATFORM_MIGRATIONS_DIR,
      log: info,
    });
  } catch (err) {
    fail(err.message);
  }
}

async function applySqlFile(client, sqlFilePath, label) {
  if (!fs.existsSync(sqlFilePath)) {
    fail(`Required baseline SQL missing: ${sqlFilePath}`);
  }
  const sql = fs.readFileSync(sqlFilePath, 'utf8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean);

  if (statements.length === 0) {
    info(`${label}: no statements found, skipping.`);
    return;
  }

  info(`${label}: applying ${statements.length} statements`);
  await client.query('BEGIN');
  try {
    for (const stmt of statements) {
      await client.query(stmt);
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    fail(`${label} failed: ${err.message}`);
  }
}


async function baselineMigrationsAfterSnapshot(client) {
  // Foundation scoped migrations often CREATE objects already present in the
  // canonical snapshot. Stamp only those hashes. 0014 and 0015 are security
  // closures: their hashes stay unstamped so they execute after platform DDL.
  //
  // Do NOT baseline PLATFORM_SQL here. Platform migrations are additive and
  // idempotent (CREATE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS) and exist
  // specifically to close runtime gaps on reconstituted snapshots (e.g. 0005
  // organization_members.deleted_at / tenant_id). Baselining them skips DDL
  // and leaves getUserRole / seed broken (everyone falls back to member).
  const throughTags = tagsThrough(readJournalEntries(SCOPED_JOURNAL), SCOPED_FOUNDATION_THROUGH_TAG);
  info(
    `Snapshot restored — baselining scoped foundation hashes through ${SCOPED_FOUNDATION_THROUGH_TAG}. ` +
      '0014 and later stay unstamped.',
  );
  const scoped = await baselineScopedMigrationsShared(client, {
    journalPath: SCOPED_JOURNAL,
    migrationsDir: SCOPED_MIGRATIONS_DIR,
    throughTags,
    log: info,
  });
  return { scoped, platform: { stamped: 0, stampedTags: [] } };
}

async function regrantRuntimeTablePrivileges(client) {
  const roles = await client.query(
    `SELECT rolname FROM pg_roles WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system')`,
  );
  const present = new Set(roles.rows.map((row) => row.rolname));
  if (!present.has('union_eyes_runtime') || !present.has('union_eyes_system')) {
    info('Runtime roles are absent; skipping the post-platform table re-grant.');
    return { applied: false };
  }
  info('Re-granting 0009 table and sequence privileges after platform DDL. The 0009 file is unchanged.');
  await client.query('BEGIN');
  try {
    await client.query('GRANT USAGE ON SCHEMA public TO union_eyes_runtime, union_eyes_system');
    await client.query(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO union_eyes_runtime, union_eyes_system',
    );
    await client.query(
      'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO union_eyes_runtime, union_eyes_system',
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    fail(`Post-platform runtime re-grant failed: ${err.message}`);
  }
  return { applied: true };
}

async function report0014PhysicalPresence(client) {
  const { targets, parents } = read0014RelationNames(repoRoot);
  const missing = [];
  for (const table of [...new Set([...targets, ...parents])]) {
    const result = await client.query(`SELECT to_regclass(format('public.%I', $1::text)) AS regclass`, [table]);
    if (!result.rows[0]?.regclass) missing.push(table);
  }
  if (missing.length === 0) {
    info(`0014 physical preflight: all ${targets.length} targets and ${parents.length} parents exist.`);
    return { missing };
  }
  info(
    `0014 physical preflight: ${missing.length} relation(s) absent before the security migration: ${missing.join(',')}`,
  );
  return { missing };
}

async function applyCiBaselineIfNeeded(client, scopedEntriesCount) {
  if (restoreSnapshotUrl) {
    return { applied: false };
  }

  const authUsersRegclass = await client.query(
    `select to_regclass('user_management.users') as regclass`,
  );
  const organizationsRegclass = await client.query(
    `select to_regclass('public.organizations') as regclass`,
  );
  const hasUserManagement = Boolean(authUsersRegclass.rows?.[0]?.regclass);
  const hasOrganizations = Boolean(organizationsRegclass.rows?.[0]?.regclass);
  const hasCanonicalBaseline = hasUserManagement || hasOrganizations;

  // Scoped migrations cover ICRA/workbook surface only. The QA/CI baseline
  // materialises the canonical user_management schema (auth, sessions,
  // organizations) that seed:test-env and E2E flows require. When scoped
  // migrations applied but user_management is still missing, we must still
  // run the (idempotent) baseline — otherwise E2E seed blows up with
  // "relation user_management.user_sessions does not exist".
  if (scopedEntriesCount > 0 && hasUserManagement) {
    return { applied: false };
  }

  if (scopedEntriesCount === 0 && hasCanonicalBaseline) {
    info('Snapshot/migrations absent but canonical baseline tables already exist; skipping QA baseline SQL set.');
    return { applied: false };
  }

  if (!isQaOrCiBootstrap) {
    if (scopedEntriesCount === 0) {
      fail(
        'Fresh bootstrap has neither UE_DB_RESTORE_SNAPSHOT_URL nor scoped migrations. ' +
          'Refusing to materialize an empty database outside QA/CI mode.',
      );
    }
    // Non-CI mode with scoped migrations but no user_management — let
    // operator decide; do not force baseline.
    return { applied: false };
  }

  info(
    scopedEntriesCount > 0
      ? 'Scoped migrations applied but user_management schema is missing in QA/CI mode; applying canonical QA baseline SQL (idempotent).'
      : 'No snapshot and zero scoped migrations in QA/CI mode; applying canonical QA baseline SQL to prevent missing-table bootstraps.',
  );
  await applySqlFile(client, QA_BASELINE_SQL, 'qa-baseline');
  return { applied: true };
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
    const stageIds = PRODUCTION_BOOTSTRAP_ORDER.map((stage) => stage.id);
    info(`Production bootstrap order: ${stageIds.join(' -> ')}`);

    info('Ensuring required extensions...');
    await ensureExtensions(client);

    const restoreSummary = await maybeRestoreSnapshot();

    if (restoreSummary.restored) {
      await baselineMigrationsAfterSnapshot(client);
    }

    const scopedEntries = readJournalEntries(SCOPED_JOURNAL);
    const baselineSummary = await applyCiBaselineIfNeeded(client, scopedEntries.length);

    info(`Applying scoped foundation migrations through ${SCOPED_FOUNDATION_THROUGH_TAG} ...`);
    const foundationSummary = await applyScopedMigrations(client, { throughTag: SCOPED_FOUNDATION_THROUGH_TAG });

    info('Applying post-freeze PLATFORM_SQL migrations from db/migrations-platform/ ...');
    const platformSummary = await applyPlatformMigrations(client);

    const regrantSummary = await regrantRuntimeTablePrivileges(client);
    const physicalSummary = await report0014PhysicalPresence(client);

    info(`Applying scoped RLS closures after ${SCOPED_FOUNDATION_THROUGH_TAG} ...`);
    const closureSummary = await applyScopedMigrations(client, { afterTag: SCOPED_FOUNDATION_THROUGH_TAG });

    await writeBootstrapAttestation(client, {
      snapshotDigest: restoreSummary.snapshotDigest,
      restored: restoreSummary.restored,
      qaBaselineApplied: baselineSummary.applied,
      productionBootstrapOrder: stageIds,
      scopedFoundationApplied: foundationSummary.applied,
      scopedClosureApplied: closureSummary.applied,
      scopedMigrationsApplied: foundationSummary.applied + closureSummary.applied,
      platformMigrationsApplied: platformSummary.applied,
      runtimeRoleRegrantApplied: regrantSummary.applied,
      relationsAbsentBefore0014: physicalSummary.missing,
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
