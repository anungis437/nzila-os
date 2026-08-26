#!/usr/bin/env node
/**
 * Platform migration runner.
 *
 * Two-phase lifecycle:
 *
 *   Phase 1 · BOOTSTRAP  (checked-in prerequisite baseline)
 *   ─────────────────────────────────────────────────────────
 *   Artifacts under `packages/db/bootstrap/*.sql`, each accompanied by a
 *   sibling `*.json` manifest. Each artifact materializes the minimum set
 *   of tables/enums/extensions that the numbered incremental chain assumes
 *   already exists. Bootstrap artifacts are tracked in
 *   `drizzle.__platform_bootstrap` (distinct from the incremental tracker).
 *
 *   Phase 2 · INCREMENTAL  (per-feature numbered migrations)
 *   ─────────────────────────────────────────────────────────
 *   Artifacts under `packages/db/drizzle/*.sql`, tracked in
 *   `drizzle.__platform_migrations`.
 *
 * Ordering is strict: no incremental artifact is executed until every
 * bootstrap artifact is satisfied (applied or reconciled) on the target
 * database.
 *
 * Modes
 * -----
 *   (default)              Apply any pending incremental migrations. Refuses
 *                          to proceed if bootstrap is not satisfied.
 *
 *   --check                Dry run. Reports bootstrap status and pending
 *                          incrementals without executing SQL.
 *
 *   --verify               Exits non-zero (code 2) if bootstrap is not
 *                          satisfied or any incremental is pending. Intended
 *                          for CI gates.
 *
 *   --baseline             Records every incremental file into
 *                          `drizzle.__platform_migrations` as already
 *                          applied, without executing SQL. Requires
 *                          bootstrap to be satisfied first. This is the
 *                          transition path for legacy environments whose
 *                          incrementals were previously applied out-of-band.
 *
 *   --bootstrap-check      Dry run of Phase 1 only. Reports which
 *                          bootstrap artifacts are recorded, missing, or
 *                          would need reconciliation.
 *
 *   --bootstrap-apply      Executes every unrecorded bootstrap artifact
 *                          (idempotent SQL). Only appropriate for empty or
 *                          near-empty databases. Refuses if reconciliation
 *                          detects incompatible existing objects.
 *
 *   --bootstrap-reconcile  For each bootstrap artifact whose manifest
 *                          objects already exist on the target database,
 *                          validate schema compatibility per the manifest,
 *                          and — if compatible — record the artifact as
 *                          satisfied without executing SQL. Refuses on
 *                          drift.
 *
 * Reconciliation policy (per manifest reconciliationPolicy):
 *   • Required checks: table exists; every documented column exists with
 *     the declared data_type; nullability matches when notNull=true; primary
 *     key columns match.
 *   • Tolerated: extra columns, extra FKs, extra indexes, extra uniques.
 *   • Drift → runner exits non-zero and lists every failed check.
 *
 * Non-goals
 * ---------
 *   • Never modifies historical incremental files.
 *   • Never touches `drizzle.__drizzle_migrations` (owned by drizzle-kit
 *     and by the Union Eyes scoped bootstrap).
 *   • Never uses `drizzle-kit push` as an authoritative source.
 *
 * Environment
 * -----------
 *   DATABASE_URL must be set. Falls back to `.env.local` at repo root, then
 *   `apps/union-eyes/.env.local`.
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
const bootstrapDir = path.join(repoRoot, 'packages', 'db', 'bootstrap');
const migrationsDir = path.join(repoRoot, 'packages', 'db', 'drizzle');
const knownPartialFailuresPath = path.join(migrationsDir, '.known-partial-failures.json');

const ARTIFACT_FILE_RE = /^(\d{4})_[^/\\]+\.sql$/;

/**
 * Load the checked-in allowlist of incremental migrations that are known to
 * abort partway through execution and whose partial-apply behavior is
 * intentionally relied on by a later catch-up (healer) migration.
 * Returns a Map<filename, entry>. Absent file → empty map.
 */
function loadKnownPartialFailures() {
  if (!fs.existsSync(knownPartialFailuresPath)) return new Map();
  try {
    const raw = fs.readFileSync(knownPartialFailuresPath, 'utf8');
    const data = JSON.parse(raw);
    const entries = Array.isArray(data.entries) ? data.entries : [];
    return new Map(entries.map((e) => [e.filename, e]));
  } catch (err) {
    fail(
      `failed to parse ${path.relative(repoRoot, knownPartialFailuresPath)}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return new Map(); // unreachable
  }
}

// ── env / logging ──────────────────────────────────────────────────────────

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  loadEnv({ path: path.join(repoRoot, '.env.local') });
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  loadEnv({ path: path.join(repoRoot, 'apps', 'union-eyes', '.env.local') });
  return process.env.DATABASE_URL;
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

// ── artifact discovery ────────────────────────────────────────────────────

function listSqlArtifacts(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && ARTIFACT_FILE_RE.test(e.name))
    .map((e) => e.name)
    .sort((a, b) => {
      const ai = Number(a.match(ARTIFACT_FILE_RE)[1]);
      const bi = Number(b.match(ARTIFACT_FILE_RE)[1]);
      if (ai !== bi) return ai - bi;
      return a.localeCompare(b);
    });
  return entries.map((name) => {
    const full = path.join(dir, name);
    const sql = fs.readFileSync(full, 'utf8');
    const hash = crypto.createHash('sha256').update(sql).digest('hex');
    return { name, full, sql, hash };
  });
}

function loadManifestFor(artifact) {
  const manifestName = artifact.name.replace(/^(\d{4})_/, '').replace(/\.sql$/, '.json');
  const manifestPath = path.join(bootstrapDir, manifestName);
  if (!fs.existsSync(manifestPath)) {
    fail(
      `bootstrap artifact ${artifact.name} is missing its sibling manifest at ${path.relative(repoRoot, manifestPath)}. ` +
        `Every bootstrap artifact must be paired with a manifest declaring its object contract.`,
    );
  }
  try {
    const raw = fs.readFileSync(manifestPath, 'utf8');
    return { path: manifestPath, data: JSON.parse(raw) };
  } catch (err) {
    fail(`bootstrap manifest ${manifestName} is not valid JSON: ${err instanceof Error ? err.message : String(err)}`);
    return null; // unreachable
  }
}

// ── tracking tables ───────────────────────────────────────────────────────

async function ensureTrackingTables(client) {
  await client.query('CREATE SCHEMA IF NOT EXISTS drizzle');
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__platform_bootstrap (
      id SERIAL PRIMARY KEY,
      filename text NOT NULL,
      hash text NOT NULL UNIQUE,
      mode text NOT NULL,
      recorded_at bigint NOT NULL
    )
  `);
  await client.query(`
    CREATE TABLE IF NOT EXISTS drizzle.__platform_migrations (
      id SERIAL PRIMARY KEY,
      filename text NOT NULL,
      hash text NOT NULL UNIQUE,
      created_at bigint NOT NULL
    )
  `);
  // Phase 0A.1 · additive columns capturing partial-apply metadata.
  // Older rows carry NULL for every added column and remain valid.
  await client.query(`
    ALTER TABLE drizzle.__platform_migrations
      ADD COLUMN IF NOT EXISTS partial boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS sqlstate text,
      ADD COLUMN IF NOT EXISTS error_signature text,
      ADD COLUMN IF NOT EXISTS statement_location text,
      ADD COLUMN IF NOT EXISTS healer_filename text,
      ADD COLUMN IF NOT EXISTS outcome_class text
  `);
}

async function loadRecordedBootstrapHashes(client) {
  const res = await client.query('SELECT hash FROM drizzle.__platform_bootstrap');
  return new Set(res.rows.map((r) => r.hash));
}

async function loadAppliedIncrementalHashes(client) {
  const res = await client.query('SELECT hash FROM drizzle.__platform_migrations');
  return new Set(res.rows.map((r) => r.hash));
}

// ── manifest-based reconciliation ─────────────────────────────────────────

async function fetchTableColumns(client, tableName) {
  const res = await client.query(
    `SELECT column_name, data_type, is_nullable, udt_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [tableName],
  );
  return new Map(
    res.rows.map((r) => [
      r.column_name,
      {
        dataType: r.data_type,
        nullable: r.is_nullable === 'YES',
        udtName: r.udt_name,
      },
    ]),
  );
}

async function fetchPrimaryKeyColumns(client, tableName) {
  const res = await client.query(
    `SELECT a.attname AS column_name
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
       JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(i.indkey)
      WHERE n.nspname = 'public' AND c.relname = $1 AND i.indisprimary
      ORDER BY array_position(i.indkey, a.attnum)`,
    [tableName],
  );
  return res.rows.map((r) => r.column_name);
}

async function fetchEnumValues(client, enumName) {
  const res = await client.query(
    `SELECT e.enumlabel AS value
       FROM pg_type t
       JOIN pg_enum e ON e.enumtypid = t.oid
       JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typname = $1
      ORDER BY e.enumsortorder`,
    [enumName],
  );
  return res.rows.map((r) => r.value);
}

async function reconcileManifest(client, manifest) {
  // Failures are categorized:
  //   - missingFailures: object does not exist on the target. A subsequent
  //     `--bootstrap-apply` will create it (baseline SQL is idempotent).
  //   - driftFailures: object exists but does not match the declared contract
  //     (missing column, wrong type, wrong nullability, wrong PK). This must
  //     be resolved manually — the baseline SQL cannot ALTER an existing
  //     object.
  const missingFailures = [];
  const driftFailures = [];
  const partialPresence = { present: 0, missing: 0 };

  for (const obj of manifest.data.objects) {
    if (obj.type === 'enum') {
      const values = await fetchEnumValues(client, obj.name);
      if (values.length === 0) {
        missingFailures.push(`enum ${obj.name} does not exist`);
        partialPresence.missing += 1;
        continue;
      }
      partialPresence.present += 1;
      const expected = new Set(obj.values);
      const missing = obj.values.filter((v) => !values.includes(v));
      if (missing.length > 0) {
        driftFailures.push(
          `enum ${obj.name} is missing value(s): ${missing.join(', ')} (found: ${values.join(', ')})`,
        );
      }
      const extra = values.filter((v) => !expected.has(v));
      if (extra.length > 0) {
        log(`  · enum ${obj.name} carries additive values: ${extra.join(', ')} (tolerated)`);
      }
      continue;
    }

    if (obj.type === 'table') {
      const cols = await fetchTableColumns(client, obj.name);
      if (cols.size === 0) {
        missingFailures.push(`table ${obj.name} does not exist`);
        partialPresence.missing += 1;
        continue;
      }
      partialPresence.present += 1;

      for (const expectedCol of obj.columns) {
        const actual = cols.get(expectedCol.name);
        if (!actual) {
          driftFailures.push(`table ${obj.name}: column ${expectedCol.name} is missing`);
          continue;
        }
        if (actual.dataType !== expectedCol.type) {
          driftFailures.push(
            `table ${obj.name}.${expectedCol.name}: expected data_type ${expectedCol.type}, found ${actual.dataType}`,
          );
        }
        if (expectedCol.type === 'USER-DEFINED' && expectedCol.udtName && actual.udtName !== expectedCol.udtName) {
          driftFailures.push(
            `table ${obj.name}.${expectedCol.name}: expected udt ${expectedCol.udtName}, found ${actual.udtName}`,
          );
        }
        if (expectedCol.notNull && actual.nullable) {
          driftFailures.push(`table ${obj.name}.${expectedCol.name}: expected NOT NULL, found NULLABLE`);
        }
      }

      const pkCols = await fetchPrimaryKeyColumns(client, obj.name);
      const pkMatches =
        pkCols.length === obj.primaryKey.length &&
        pkCols.every((c, i) => c === obj.primaryKey[i]);
      if (!pkMatches) {
        driftFailures.push(
          `table ${obj.name}: expected primary key (${obj.primaryKey.join(', ')}), found (${pkCols.join(', ')})`,
        );
      }
      continue;
    }

    driftFailures.push(`unknown manifest object type: ${obj.type} for ${obj.name}`);
  }

  const failures = [...missingFailures, ...driftFailures];
  return { failures, missingFailures, driftFailures, partialPresence };
}

// ── bootstrap orchestration ───────────────────────────────────────────────

async function bootstrapCheck(client, artifacts) {
  const recorded = await loadRecordedBootstrapHashes(client);
  log(`bootstrap: ${artifacts.length} artifact(s) discovered under packages/db/bootstrap/.`);
  for (const art of artifacts) {
    const status = recorded.has(art.hash) ? 'RECORDED' : 'PENDING';
    log(`  · ${art.name}  sha256=${art.hash.slice(0, 12)}...  ${status}`);
    if (!recorded.has(art.hash)) {
      const manifest = loadManifestFor(art);
      const { driftFailures, missingFailures, partialPresence } = await reconcileManifest(client, manifest);
      if (driftFailures.length === 0 && partialPresence.present > 0 && partialPresence.missing === 0) {
        log('      -> would be RECONCILE-safe (all manifest objects present & compatible)');
      } else if (partialPresence.present === 0) {
        log('      -> would be APPLY-safe (no manifest objects present)');
      } else if (driftFailures.length > 0) {
        log('      -> DRIFT on existing objects — apply refused, fix manually:');
        for (const f of driftFailures) log(`         - ${f}`);
      } else {
        log(
          `      -> would be APPLY-safe (${partialPresence.present} present + ${partialPresence.missing} missing; ` +
            `no drift on present objects, baseline will create missing ones):`,
        );
        for (const f of missingFailures) log(`         - ${f}`);
      }
    }
  }
  return recorded;
}

async function bootstrapApply(client, artifacts) {
  const recorded = await loadRecordedBootstrapHashes(client);
  let executed = 0;
  for (const art of artifacts) {
    if (recorded.has(art.hash)) {
      log(`bootstrap: ${art.name} already recorded; skipping.`);
      continue;
    }
    const manifest = loadManifestFor(art);
    const { driftFailures, partialPresence } = await reconcileManifest(client, manifest);
    if (driftFailures.length > 0) {
      fail(
        `bootstrap-apply refused for ${art.name}: schema drift detected on existing objects. ` +
          `Baseline SQL creates missing objects idempotently but cannot ALTER existing ones. ` +
          `Fix drift manually (add missing columns / correct types / correct NOT NULL) or use ` +
          `--bootstrap-reconcile against a compatible database. Drift:\n  - ${driftFailures.join('\n  - ')}`,
      );
    }
    if (partialPresence.present > 0 && partialPresence.missing > 0) {
      log(
        `bootstrap: ${art.name} target has ${partialPresence.present} object(s) present and ` +
          `${partialPresence.missing} missing; applying baseline to fill the gaps ` +
          `(existing objects are contract-compatible, IF NOT EXISTS is a no-op for them).`,
      );
    }
    log(`bootstrap: applying ${art.name}`);
    try {
      await client.query('BEGIN');
      await client.query(art.sql);
      await client.query(
        `INSERT INTO drizzle.__platform_bootstrap (filename, hash, mode, recorded_at)
         VALUES ($1, $2, 'apply', $3)`,
        [art.name, art.hash, Date.now()],
      );
      await client.query('COMMIT');
      executed += 1;
      log(`  applied ${art.name}`);
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore
      }
      fail(`bootstrap-apply failed for ${art.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  log(`bootstrap-apply complete. Executed ${executed} artifact(s).`);
}

async function bootstrapReconcile(client, artifacts) {
  const recorded = await loadRecordedBootstrapHashes(client);
  let reconciled = 0;
  for (const art of artifacts) {
    if (recorded.has(art.hash)) {
      log(`bootstrap: ${art.name} already recorded; skipping.`);
      continue;
    }
    const manifest = loadManifestFor(art);
    const { failures, partialPresence } = await reconcileManifest(client, manifest);
    if (partialPresence.present === 0) {
      fail(
        `bootstrap-reconcile refused for ${art.name}: none of the manifest objects exist on the target. ` +
          `Use --bootstrap-apply against an empty database, not --bootstrap-reconcile.`,
      );
    }
    if (failures.length > 0) {
      fail(
        `bootstrap-reconcile refused for ${art.name}: schema drift detected. ` +
          `No baseline row was recorded. Failures:\n  - ${failures.join('\n  - ')}`,
      );
    }
    await client.query(
      `INSERT INTO drizzle.__platform_bootstrap (filename, hash, mode, recorded_at)
       VALUES ($1, $2, 'reconcile', $3)`,
      [art.name, art.hash, Date.now()],
    );
    reconciled += 1;
    log(`bootstrap: reconciled ${art.name} (all manifest objects present & compatible).`);
  }
  log(`bootstrap-reconcile complete. Reconciled ${reconciled} artifact(s).`);
}

async function assertBootstrapReady(client, artifacts) {
  const recorded = await loadRecordedBootstrapHashes(client);
  const pending = artifacts.filter((a) => !recorded.has(a.hash));
  if (pending.length === 0) return;
  const names = pending.map((p) => p.name).join(', ');
  fail(
    `bootstrap not satisfied: ${pending.length} artifact(s) pending: ${names}. ` +
      `Run --bootstrap-apply (empty DB) or --bootstrap-reconcile (existing DB) first.`,
    3,
  );
}

// ── main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = new Set(process.argv.slice(2));
  const modes = [
    'check',
    'verify',
    'baseline',
    'bootstrap-check',
    'bootstrap-apply',
    'bootstrap-reconcile',
  ];
  const activeModes = modes.filter((m) => args.has(`--${m}`));
  if (activeModes.length > 1) {
    fail(`modes are mutually exclusive; got: ${activeModes.map((m) => `--${m}`).join(', ')}`);
  }
  const mode = activeModes[0] ?? null;

  const databaseUrl = loadDatabaseUrl();
  if (!databaseUrl) {
    fail('DATABASE_URL is not set. Set it in the shell or in .env.local.');
  }

  const bootstrapArtifacts = listSqlArtifacts(bootstrapDir);
  const incrementalArtifacts = listSqlArtifacts(migrationsDir);

  if (bootstrapArtifacts.length === 0) {
    fail(
      `no bootstrap artifacts found under packages/db/bootstrap/. This runner requires at least one ` +
        `checked-in bootstrap artifact. See Phase 0A · Migration Lineage Closure.`,
    );
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await ensureTrackingTables(client);

    if (mode === 'bootstrap-check') {
      await bootstrapCheck(client, bootstrapArtifacts);
      return;
    }
    if (mode === 'bootstrap-apply') {
      await bootstrapApply(client, bootstrapArtifacts);
      return;
    }
    if (mode === 'bootstrap-reconcile') {
      await bootstrapReconcile(client, bootstrapArtifacts);
      return;
    }

    if (mode === 'check') {
      log('=== Phase 1 · bootstrap status ===');
      await bootstrapCheck(client, bootstrapArtifacts);
      log('=== Phase 2 · incremental status ===');
      const applied = await loadAppliedIncrementalHashes(client);
      const pending = incrementalArtifacts.filter((f) => !applied.has(f.hash));
      log(`incrementals: ${incrementalArtifacts.length} discovered; ${applied.size} recorded; ${pending.length} pending.`);
      for (const p of pending) log(`  - ${p.name}  sha256=${p.hash.slice(0, 12)}...`);
      return;
    }

    if (mode === 'verify') {
      const recorded = await loadRecordedBootstrapHashes(client);
      const bootstrapPending = bootstrapArtifacts.filter((a) => !recorded.has(a.hash));
      const applied = await loadAppliedIncrementalHashes(client);
      const incrementalPending = incrementalArtifacts.filter((f) => !applied.has(f.hash));
      if (bootstrapPending.length > 0 || incrementalPending.length > 0) {
        const bs = bootstrapPending.map((p) => `bootstrap:${p.name}`).join(', ');
        const inc = incrementalPending.map((p) => `incremental:${p.name}`).join(', ');
        const parts = [bs, inc].filter(Boolean).join(' | ');
        fail(`verify failed: pending artifact(s): ${parts}`, 2);
      }
      // Phase 0A.1 closure enforcement.
      const knownPartialFailures = loadKnownPartialFailures();
      const problems = [];

      // (a) Every allowlist entry MUST reference a healer that exists on disk.
      for (const [filename, entry] of knownPartialFailures) {
        const healerOnDisk = incrementalArtifacts.some((a) => a.name === entry.healer);
        if (!healerOnDisk) {
          problems.push(
            `allowlist entry "${filename}" names healer "${entry.healer}" which is missing from packages/db/drizzle/`,
          );
        }
      }

      // (b) Every allowlisted file that has been recorded as partial MUST
      //     have a paired healer row also recorded. And every non-partial
      //     recorded row whose file is on the allowlist is a witness
      //     mismatch (unwitnessed allowlist entry).
      const rows = await client.query(
        `SELECT filename, partial, healer_filename, outcome_class
           FROM drizzle.__platform_migrations
           ORDER BY id`,
      );
      const recordedByName = new Map();
      for (const r of rows.rows) {
        recordedByName.set(r.filename, r);
      }
      for (const [filename, entry] of knownPartialFailures) {
        const row = recordedByName.get(filename);
        if (!row) continue; // not yet applied to this DB — nothing to enforce
        if (row.partial === false) {
          problems.push(
            `allowlist entry "${filename}" is recorded as full-success but the allowlist claims it partials — witness mismatch (unwitnessed allowlist entry). If the historical defect is truly gone, remove the allowlist entry.`,
          );
          continue;
        }
        if (!recordedByName.has(entry.healer)) {
          problems.push(
            `partial-apply of "${filename}" is not yet paired with an applied healer "${entry.healer}" — chain incomplete.`,
          );
        }
      }

      // (c) Healer hash-stability: recorded healer rows must still match the
      //     healer file on disk. (Any recorded incremental row must match
      //     the on-disk hash, because insertion enforces UNIQUE(hash); a
      //     mismatch means the file was edited after being applied.)
      const artifactHashByName = new Map(incrementalArtifacts.map((a) => [a.name, a.hash]));
      const recordedHashRows = await client.query(
        `SELECT filename, hash FROM drizzle.__platform_migrations`,
      );
      for (const r of recordedHashRows.rows) {
        const onDisk = artifactHashByName.get(r.filename);
        if (onDisk && onDisk !== r.hash) {
          problems.push(
            `applied-file hash drift for "${r.filename}": recorded=${r.hash.slice(0, 12)}... on-disk=${onDisk.slice(0, 12)}...`,
          );
        }
      }

      if (problems.length > 0) {
        fail(
          `verify failed (Phase 0A.1 closure enforcement):\n  - ${problems.join('\n  - ')}`,
          2,
        );
      }
      log('verify: bootstrap satisfied, no incremental migrations pending, every allowlisted partial is paired with an applied healer, no hash drift.');
      return;
    }

    // Modes that require bootstrap to be satisfied:
    await assertBootstrapReady(client, bootstrapArtifacts);

    if (mode === 'baseline') {
      const applied = await loadAppliedIncrementalHashes(client);
      const pending = incrementalArtifacts.filter((f) => !applied.has(f.hash));
      log(`baseline: recording ${pending.length} incremental file(s) as applied (no SQL executed).`);
      for (const p of pending) {
        await client.query(
          `INSERT INTO drizzle.__platform_migrations (filename, hash, created_at)
           VALUES ($1, $2, $3) ON CONFLICT (hash) DO NOTHING`,
          [p.name, p.hash, Date.now()],
        );
      }
      log('baseline complete.');
      return;
    }

    // default mode: apply pending incrementals
    const applied = await loadAppliedIncrementalHashes(client);
    const pending = incrementalArtifacts.filter((f) => !applied.has(f.hash));
    log(`incrementals: ${incrementalArtifacts.length} discovered; ${applied.size} already applied; ${pending.length} pending.`);

    if (pending.length === 0) {
      log('All incremental migrations already applied.');
      return;
    }

    // Incremental migrations are executed WITHOUT explicit BEGIN/COMMIT so
    // that PostgreSQL's simple-query protocol autocommits each statement
    // independently, matching `psql -f` semantics. This is required to preserve
    // the historical execution model that some catch-up migrations rely on
    // (e.g. `0033_fix_pilot_alerts_rule_fk.sql` reapplies statements that
    // `0010_pilot_alerting_hardening.sql` intentionally leaves half-applied
    // after its known `ADD CONSTRAINT IF NOT EXISTS` syntax error).
    //
    // If a migration fails mid-file, statements that already ran remain
    // committed. Behavior depends on the allowlist at
    // `packages/db/drizzle/.known-partial-failures.json`:
    //   • listed → runner warns, records the file as applied, continues.
    //     The healer migration named in the allowlist entry is expected
    //     later in the chain to catch the schema up.
    //   • not listed → runner hard-fails without recording. Operator must
    //     add an allowlist entry (with healer) or fix the DB manually.
    const knownPartialFailures = loadKnownPartialFailures();
    for (const p of pending) {
      log(`applying ${p.name}`);
      let partial = null;
      try {
        await client.query(p.sql);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const sqlstate =
          (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string' && err.code) || null;
        const errPosition =
          (err && typeof err === 'object' && 'position' in err && err.position != null && String(err.position)) || null;
        const errWhere =
          (err && typeof err === 'object' && 'where' in err && err.where != null && String(err.where)) || null;
        const statementLocation = [
          errPosition ? `position=${errPosition}` : null,
          errWhere ? `where=${errWhere.split('\n')[0]}` : null,
        ]
          .filter(Boolean)
          .join(' ') || null;
        const errorSignature = message.split('\n')[0].slice(0, 500);
        const allow = knownPartialFailures.get(p.name);
        if (!allow) {
          fail(
            `failure applying ${p.name}: ${message}. ` +
              `Statements executed prior to this error remain committed. ` +
              `Either patch the database manually, add a healer migration, ` +
              `or (only for genuinely known-broken historical files) add an ` +
              `entry to packages/db/drizzle/.known-partial-failures.json ` +
              `naming the healer migration.`,
          );
        }
        // Verify the named healer exists in the incremental set; refuse to
        // tolerate a partial failure whose healer is missing.
        const healerPresent = incrementalArtifacts.some((a) => a.name === allow.healer);
        if (!healerPresent) {
          fail(
            `failure applying ${p.name}: ${message}. ` +
              `.known-partial-failures.json declares healer "${allow.healer}" ` +
              `but that file is not present in packages/db/drizzle/. Cannot ` +
              `safely record the partial failure.`,
          );
        }
        partial = { message, healer: allow.healer, sqlstate, statementLocation, errorSignature };
        warn(
          `partial-apply tolerated for ${p.name} (SQLSTATE=${sqlstate ?? 'null'}; known defect: ${allow.reason}). ` +
            `Healer: ${allow.healer}. Error: ${message}`,
        );
      }
      const outcomeClass = partial ? 'approved-partial' : 'full-success';
      await client.query(
        `INSERT INTO drizzle.__platform_migrations
           (filename, hash, created_at, partial, sqlstate, error_signature, statement_location, healer_filename, outcome_class)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          p.name,
          p.hash,
          Date.now(),
          Boolean(partial),
          partial?.sqlstate ?? null,
          partial?.errorSignature ?? null,
          partial?.statementLocation ?? null,
          partial?.healer ?? null,
          outcomeClass,
        ],
      );
      log(partial ? `  recorded ${p.name} (partial; healer ${partial.healer})` : `  applied ${p.name}`);
    }
    log(`Done. Applied ${pending.length} incremental migration(s).`);
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.stack || err.message : String(err));
});
