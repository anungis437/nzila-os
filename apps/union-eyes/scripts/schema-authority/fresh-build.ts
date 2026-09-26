/**
 * schema:contract:fresh-build — disposable fresh-DB harness (Phase D/E).
 *
 * The HARNESS (not the generator) materializes a throwaway PostgreSQL database
 * from CURRENT SOURCE authority, then invokes the read-only generator against it.
 *
 * Canonical fresh-build order (Step 8):
 *   empty disposable DB
 *   -> required extensions            (shared ensureExtensions)
 *   -> Django migrate --noinput       (backend/manage.py)
 *   -> scoped Drizzle 0000-0013       (shared applyScopedMigrations on migrations-cache)
 *   -> migrate --check                (asserts no pending Django migrations)
 *   -> RLS verification/preflight     (optional; UE_SCHEMA_CONTRACT_RLS=1)
 *   -> schema:contract:generate
 *
 * It deliberately does NOT: restore a snapshot, use the QA baseline, run
 * align-org-schema.ts, replay frozen db/migrations/, or set a lineage override.
 * This is intended to REPRODUCE today's canonical deficiency.
 *
 * Hard safety: the target database name MUST start with `ue_schema_contract_`.
 * It refuses staging / production / unknown database names.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import pg from 'pg';
import { generate, serializeArtifact } from './generate-canonical-schema';
import { APP_ROOT, CANONICAL_SCHEMA_PATH, CANONICAL_SCHEMA_SHA_PATH, GENERATED_DIR } from './lib/contracts';

const REPO_ROOT = path.resolve(APP_ROOT, '..', '..');
const BACKEND_DIR = path.join(APP_ROOT, 'backend');
const MIGRATIONS_CACHE = path.join(APP_ROOT, 'db', 'migrations-cache');
const SCOPED_JOURNAL = path.join(MIGRATIONS_CACHE, 'meta', '_journal.json');

const DISPOSABLE_PREFIX = 'ue_schema_contract_';
const FORBIDDEN_SUBSTR = ['staging', 'prod', 'production', 'nzila_os', 'nzila_union_eyes', 'nzila_automation'];

function log(msg: string): void {
  process.stdout.write(`[fresh-build] ${msg}\n`);
}

function assertDisposableName(name: string): void {
  if (!name || !name.startsWith(DISPOSABLE_PREFIX)) {
    throw new Error(`Refusing: target DB "${name}" does not start with the disposable prefix "${DISPOSABLE_PREFIX}".`);
  }
  if (!/^ue_schema_contract_[a-z0-9_]+$/.test(name)) {
    throw new Error(`Refusing: target DB "${name}" has an unexpected shape for a disposable database.`);
  }
  const lower = name.toLowerCase();
  for (const bad of FORBIDDEN_SUBSTR) {
    if (lower.includes(bad)) throw new Error(`Refusing: target DB "${name}" contains forbidden substring "${bad}".`);
  }
}

interface PgConn {
  host: string;
  port: string;
  user: string;
  password: string;
}

function readConn(): PgConn {
  return {
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT || '5432',
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
  };
}

// Build a pg client config (never a URL string with inline credentials).
function pgConfig(conn: PgConn, database: string): pg.ClientConfig {
  return { host: conn.host, port: Number(conn.port), user: conn.user, password: conn.password, database };
}

async function createDisposableDatabase(conn: PgConn, adminDb: string, target: string): Promise<void> {
  const admin = new pg.Client(pgConfig(conn, adminDb));
  await admin.connect();
  try {
    // Guarded drop + create. Identifier is validated against the disposable prefix.
    await admin.query(`DROP DATABASE IF EXISTS "${target}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${target}"`);
    log(`created disposable database ${target}`);
  } finally {
    await admin.end();
  }
}

function runDjangoMigrate(conn: PgConn, dbName: string, checkOnly: boolean): void {
  const python = process.env.UE_PYTHON || 'python';
  const args = ['manage.py', 'migrate', ...(checkOnly ? ['--check'] : ['--noinput'])];
  log(`django ${args.join(' ')}`);
  const res = spawnSync(python, args, {
    cwd: BACKEND_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      DJANGO_SETTINGS_MODULE: process.env.DJANGO_SETTINGS_MODULE || 'config.settings',
      PGDATABASE: dbName,
      PGUSER: conn.user,
      PGPASSWORD: conn.password,
      PGHOST: conn.host,
      PGPORT: conn.port,
    },
  });
  if (res.status !== 0) {
    throw new Error(`Django ${checkOnly ? 'migrate --check' : 'migrate --noinput'} failed (exit ${res.status}).`);
  }
}

async function applyExtensionsAndScoped(conn: PgConn, dbName: string): Promise<{ scopedApplied: number; scopedTags: string[] }> {
  const sharedUrl = pathToFileURL(path.join(REPO_ROOT, 'tooling', 'scripts', 'lib', 'union-eyes-scoped-migrations.mjs')).href;
  const shared = (await import(sharedUrl)) as {
    ensureExtensions: (client: unknown, opts?: { log?: (m: string) => void }) => Promise<void>;
    applyScopedMigrations: (
      client: unknown,
      opts: { journalPath: string; migrationsDir: string; log?: (m: string) => void },
    ) => Promise<{ applied: number; appliedTags: string[] }>;
  };
  const client = new pg.Client(pgConfig(conn, dbName));
  await client.connect();
  try {
    await shared.ensureExtensions(client, { log });
    // Preflight: scoped migrations 0006+ GRANT to these cluster-global runtime
    // roles. They are an environmental prerequisite provisioned once by the
    // canonical `db:provision-roles` step (production semantics) — the harness
    // does not create cluster roles itself.
    const roles = await client.query(
      `SELECT rolname FROM pg_roles WHERE rolname IN ('union_eyes_runtime','union_eyes_system')`,
    );
    const present = new Set(roles.rows.map((r) => r.rolname));
    const missing = ['union_eyes_runtime', 'union_eyes_system'].filter((r) => !present.has(r));
    if (missing.length) {
      throw new Error(
        `Missing runtime role(s): ${missing.join(', ')}. Provision them once with ` +
          `\`pnpm db:provision-roles\` (PROVISION_ADMIN_DATABASE_URL=<admin/superuser> ` +
          `UNION_EYES_RUNTIME_DB_PASSWORD=... UNION_EYES_SYSTEM_DB_PASSWORD=...) before fresh-build.`,
      );
    }
    const scoped = await shared.applyScopedMigrations(client, {
      journalPath: SCOPED_JOURNAL,
      migrationsDir: MIGRATIONS_CACHE,
      log,
    });
    return { scopedApplied: scoped.applied, scopedTags: scoped.appliedTags };
  } finally {
    await client.end();
  }
}

function maybeRunRls(conn: PgConn, dbName: string): string {
  if (process.env.UE_SCHEMA_CONTRACT_RLS !== '1') return 'SKIPPED';
  const res = spawnSync('pnpm', ['rls:verify'], {
    cwd: APP_ROOT,
    stdio: 'inherit',
    env: { ...process.env, PGHOST: conn.host, PGPORT: conn.port, PGUSER: conn.user, PGPASSWORD: conn.password, PGDATABASE: dbName },
    shell: process.platform === 'win32',
  });
  return res.status === 0 ? 'PASS' : 'FAIL';
}

export interface FreshBuildResult {
  dbName: string;
  scopedApplied: number;
  scopedTags: string[];
  rls: string;
  digest: string;
  outFile: string;
}

async function main(): Promise<void> {
  const conn = readConn();
  const adminDb = process.env.UE_SCHEMA_CONTRACT_ADMIN_DB || 'postgres';
  const dbName = process.env.UE_SCHEMA_CONTRACT_DB_NAME || `${DISPOSABLE_PREFIX}${Date.now()}`;
  assertDisposableName(dbName);

  log(`target disposable DB = ${dbName} (admin=${adminDb}, host=${conn.host}:${conn.port}, user=${conn.user})`);
  await createDisposableDatabase(conn, adminDb, dbName);

  // extensions -> Django migrate -> scoped Drizzle -> migrate --check -> RLS -> generate
  runDjangoMigrate(conn, dbName, false);
  const { scopedApplied, scopedTags } = await applyExtensionsAndScoped(conn, dbName);
  runDjangoMigrate(conn, dbName, true);
  const rls = maybeRunRls(conn, dbName);

  const result = await generate(pgConfig(conn, dbName));
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  fs.writeFileSync(CANONICAL_SCHEMA_PATH, serializeArtifact(result));
  fs.writeFileSync(CANONICAL_SCHEMA_SHA_PATH, `${result.digest}\n`);

  log(`scoped migrations applied = ${scopedApplied} [${scopedTags.join(', ')}]`);
  log(`RLS = ${rls}`);
  log(`CANONICAL_SCHEMA_DIGEST = ${result.digest}`);
  log(`wrote ${CANONICAL_SCHEMA_PATH}`);

  if (process.env.UE_SCHEMA_CONTRACT_DROP === '1') {
    const admin = new pg.Client(pgConfig(conn, adminDb));
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.end();
    log(`dropped disposable database ${dbName}`);
  } else {
    log(`disposable database ${dbName} left in place (set UE_SCHEMA_CONTRACT_DROP=1 to drop).`);
  }
}

const invokedDirectly = process.argv[1] && process.argv[1].includes('fresh-build');
if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(`[fresh-build] failed: ${err.message}\n`);
    process.exit(1);
  });
}

export { assertDisposableName };
