#!/usr/bin/env node
/**
 * Union Eyes — Canonical snapshot restore (interface).
 *
 * This script is the only legitimate interface between
 * `run-union-eyes-drizzle-bootstrap.mjs` and the canonical operational
 * snapshot of the Django-owned schema.
 *
 * Per docs/architecture/orm-governance/environment-bootstrap-strategy.md
 * and docs/architecture/orm-governance/fresh-database-bootstrap-reference-implementation.md,
 * demo/pilot environments must be bootstrapped from a canonical snapshot
 * — never from frozen Drizzle lineage replay.
 *
 * INPUTS (env)
 *   DATABASE_URL              Target Postgres. Required.
 *   UE_DB_RESTORE_SNAPSHOT_URL  Source snapshot URI. Required.
 *                              Supported schemes today:
 *                                - https://...   (signed pg_dump archive)
 *                                - azure://<account>/<container>/<blob>
 *                                - file:///abs/path/to/dump.sql
 *
 * BEHAVIOR
 *   - Validates URL scheme is recognized.
 *   - Validates the target DB is NOT a production target (production
 *     restores follow a different governance path; see
 *     deployment-legitimacy-reconciliation.md).
 *   - Delegates the actual restore to the appropriate tool (pg_restore,
 *     psql, az storage) based on URL scheme.
 *
 * Restore implementations supported:
 *   file://    — pg_restore / psql against a local dump file.
 *   https://   — download the signed dump URL to a temp file, then restore.
 *   azure://   — az storage blob download to a temp file, then restore.
 *               Requires `az` CLI authenticated (login or managed identity).
 *               Optional: set AZURE_STORAGE_SAS_TOKEN for SAS auth.
 *
 * For custom-format (pg_dump -Fc) dumps, pg_restore is used; for plain .sql
 * files, psql -f is used. PG17 `transaction_timeout` warnings from older
 * Azure Flex servers are treated as non-fatal.
 *
 * Override binary paths via PG_RESTORE_PATH and PSQL_PATH env vars.
 */

import { URL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createWriteStream, unlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function fail(msg) {
  process.stderr.write(`[restore] ${msg}\n`);
  process.exit(1);
}

function info(msg) {
  process.stdout.write(`[restore] ${msg}\n`);
}

const databaseUrl = process.env.DATABASE_URL;
const snapshotUrl = process.env.UE_DB_RESTORE_SNAPSHOT_URL;

if (!databaseUrl) fail('DATABASE_URL is required.');
if (!snapshotUrl) fail('UE_DB_RESTORE_SNAPSHOT_URL is required.');

const targetEnv = (process.env.UE_ENVIRONMENT || process.env.NZILA_MODE || '').toLowerCase();
if (targetEnv === 'production' || targetEnv === 'prod') {
  fail(
    'Production targets must not be restored via this path. See ' +
      'docs/architecture/orm-governance/deployment-legitimacy-reconciliation.md',
  );
}

let parsed;
try {
  parsed = new URL(snapshotUrl);
} catch {
  fail(`UE_DB_RESTORE_SNAPSHOT_URL is not a valid URL: ${snapshotUrl}`);
}

const supported = ['https:', 'http:', 'azure:', 'file:'];
if (!supported.includes(parsed.protocol)) {
  fail(`Unsupported snapshot URL scheme: ${parsed.protocol}`);
}

info(`Snapshot source scheme: ${parsed.protocol}`);
info(`Target environment: ${targetEnv || '(unspecified)'}`);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse DATABASE_URL into pg connection parameters. */
function parseDatabaseUrl(raw) {
  const u = new URL(raw);
  return {
    host: u.hostname,
    port: u.port || '5432',
    // URL.password keeps percent-encoding (e.g. %25→%, %21→!); decodeURIComponent
    // yields the raw password string suitable for the PGPASSWORD env var.
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ''),
  };
}

/** Detect whether a dump file is pg_dump custom/directory format vs plain SQL. */
function isCustomFormatDump(filePath) {
  return !/\.sql$/i.test(filePath);
}

/** Return the path to pg_restore, checking common Windows install locations. */
function findPgRestore() {
  if (process.env.PG_RESTORE_PATH) return process.env.PG_RESTORE_PATH;
  const win17 = 'C:\\Program Files\\PostgreSQL\\17\\bin\\pg_restore.exe';
  const win16 = 'C:\\Program Files\\PostgreSQL\\16\\bin\\pg_restore.exe';
  if (process.platform === 'win32') {
    if (existsSync(win17)) return win17;
    if (existsSync(win16)) return win16;
  }
  return 'pg_restore';
}

/** Return the path to psql. */
function findPsql() {
  if (process.env.PSQL_PATH) return process.env.PSQL_PATH;
  const win17 = 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe';
  const win16 = 'C:\\Program Files\\PostgreSQL\\16\\bin\\psql.exe';
  if (process.platform === 'win32') {
    if (existsSync(win17)) return win17;
    if (existsSync(win16)) return win16;
  }
  return 'psql';
}

/**
 * Drop all user-defined schemas (CASCADE) and recreate an empty public schema.
 * This ensures pg_restore starts against a perfectly clean slate, avoiding any
 * "already exists" or "objects depend on it" errors on re-runs.
 */
function preCleanTarget(connInfo, pgEnv) {
  const psql = findPsql();
  info('Pre-cleaning target DB schemas...');

  // Fetch the list of user schemas from the target DB.
  const listResult = spawnSync(
    psql,
    [
      '-h', connInfo.host, '-U', connInfo.user, '-d', connInfo.database, '-p', connInfo.port,
      '-t', '-A', '-c',
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema','pg_catalog') AND schema_name NOT LIKE 'pg_%'",
    ],
    { env: pgEnv, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  if (listResult.error) fail(`Could not list schemas: ${listResult.error.message}`);
  if (listResult.status !== 0) fail(`Schema list query failed:\n${listResult.stderr?.toString().slice(0, 300)}`);

  const schemas = listResult.stdout
    .toString()
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  info(`Dropping ${schemas.length} schema(s): ${schemas.join(', ')}`);

  // Build a single SQL statement to drop all user schemas + recreate public.
  const dropStmts = schemas.map((s) => `DROP SCHEMA IF EXISTS "${s}" CASCADE;`).join(' ');
  const sql = `${dropStmts} CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO public;`;

  const dropResult = spawnSync(psql, [
    '-h', connInfo.host, '-U', connInfo.user, '-d', connInfo.database, '-p', connInfo.port,
    '-c', sql,
  ], { env: pgEnv, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024 });
  if (dropResult.error) fail(`Pre-clean failed: ${dropResult.error.message}`);
  if (dropResult.status !== 0) fail(`Pre-clean failed:\n${dropResult.stderr?.toString().slice(0, 300)}`);

    info('Pre-clean complete.');
}

/**
 * Run pg_restore (custom format) or psql (plain SQL) against the target DB.
 * Pre-cleans all user schemas before restoring so the operation is idempotent.
 * Non-fatal pg_restore warnings (e.g. transaction_timeout from PG17 dumps
 * against older Azure Flex servers) are allowed through; only errors that
 * originate from schema/data failures cause a hard exit.
 */
function runRestore(dumpFilePath, connInfo) {
  const pgEnv = {
    ...process.env,
    PGPASSWORD: connInfo.password,
    PGSSLMODE: process.env.PGSSLMODE || 'require',
  };

  preCleanTarget(connInfo, pgEnv);

  if (isCustomFormatDump(dumpFilePath)) {
    const bin = findPgRestore();
    info(`Running pg_restore (custom format): ${dumpFilePath}`);
    const result = spawnSync(
      bin,
      [
        '--no-owner', '--no-acl',
        '-h', connInfo.host, '-U', connInfo.user, '-d', connInfo.database, '-p', connInfo.port,
        dumpFilePath,
      ],
      { env: pgEnv, stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 50 * 1024 * 1024 },
    );

    if (result.error) fail(`pg_restore failed to start: ${result.error.message}`);

    const stderr = result.stderr?.toString() ?? '';
    // Ignore PG17-client-only SET parameters not supported on older Azure Flex servers.
    const hardErrors = stderr
      .split('\n')
      .filter((l) => l.startsWith('pg_restore: error:') && !l.includes('transaction_timeout'));

    if (result.status !== 0 && hardErrors.length > 0) {
      fail(`pg_restore failed:\n${hardErrors.join('\n')}`);
    }
    if (stderr.trim()) info(`pg_restore warnings (non-fatal):\n${stderr.slice(0, 400)}`);
  } else {
    const bin = findPsql();
    info(`Running psql (plain SQL format): ${dumpFilePath}`);
    const result = spawnSync(
      bin,
      ['-h', connInfo.host, '-U', connInfo.user, '-d', connInfo.database, '-p', connInfo.port, '-f', dumpFilePath],
      { env: pgEnv, stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 50 * 1024 * 1024 },
    );
    if (result.error) fail(`psql failed to start: ${result.error.message}`);
    if (result.status !== 0) {
      fail(`psql restore failed:\n${result.stderr?.toString().slice(0, 600)}`);
    }
  }

  info('Restore complete.');
}

/** Download an https:// or http:// URL to a temp file and return its path. */
async function downloadHttp(url) {
  const tmpFile = join(tmpdir(), `ue-snapshot-${Date.now()}.dump`);

  async function fetch(href) {
    const { default: https } = await import('node:https');
    const { default: http } = await import('node:http');
    return new Promise((resolve, reject) => {
      const mod = href.startsWith('https:') ? https : http;
      mod
        .get(href, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            const location = res.headers.location;
            if (!location) { reject(new Error('Redirect with no Location header')); return; }
            // Follow exactly one redirect (signed blob URLs may redirect once)
            fetch(location).then(resolve).catch(reject);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode} downloading snapshot`));
            return;
          }
          const out = createWriteStream(tmpFile);
          res.pipe(out);
          out.on('finish', () => resolve(tmpFile));
          out.on('error', reject);
        })
        .on('error', reject);
    });
  }

  info(`Downloading snapshot from ${url.hostname}...`);
  return fetch(url.href);
}

/**
 * Download an azure://<account>/<container>/<blob> URL via `az storage blob download`.
 * Requires `az` CLI to be available and authenticated (AZURE_STORAGE_ACCOUNT /
 * AZURE_STORAGE_SAS_TOKEN, or `az login` / managed identity).
 */
async function downloadAzureBlob(url) {
  const account = url.hostname;
  const parts = url.pathname.replace(/^\//, '').split('/');
  const container = parts[0];
  const blobName = parts.slice(1).join('/');

  if (!account || !container || !blobName) {
    fail('Invalid azure:// URL — expected azure://<account>/<container>/<blob-name>');
  }

  const tmpFile = join(tmpdir(), `ue-snapshot-${Date.now()}.dump`);
  info(`Downloading Azure Blob: ${account}/${container}/${blobName}...`);

  const azArgs = [
    'storage', 'blob', 'download',
    '--account-name', account,
    '--container-name', container,
    '--name', blobName,
    '--file', tmpFile,
    '--overwrite',
  ];

  // Prefer explicit SAS token if provided; fall back to `az login` identity.
  if (process.env.AZURE_STORAGE_SAS_TOKEN) {
    azArgs.push('--sas-token', process.env.AZURE_STORAGE_SAS_TOKEN);
  } else {
    azArgs.push('--auth-mode', 'login');
  }

  const result = spawnSync('az', azArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
  if (result.error) fail(`az storage blob download failed to start: ${result.error.message}`);
  if (result.status !== 0) {
    fail(`az storage blob download failed:\n${result.stderr?.toString().slice(0, 600)}`);
  }

  info('Blob download complete.');
  return tmpFile;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const connInfo = parseDatabaseUrl(databaseUrl);
  let tmpFile = null;

  try {
    if (parsed.protocol === 'file:') {
      const filePath = fileURLToPath(snapshotUrl);
      if (!existsSync(filePath)) fail(`Snapshot file not found: ${filePath}`);
      info(`Using local file: ${filePath}`);
      runRestore(filePath, connInfo);
    } else if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      tmpFile = await downloadHttp(parsed);
      runRestore(tmpFile, connInfo);
    } else if (parsed.protocol === 'azure:') {
      tmpFile = await downloadAzureBlob(parsed);
      runRestore(tmpFile, connInfo);
    }
  } finally {
    if (tmpFile && existsSync(tmpFile)) {
      unlinkSync(tmpFile);
      info('Temp snapshot file cleaned up.');
    }
  }
}

main().catch((err) => fail(err.message));
