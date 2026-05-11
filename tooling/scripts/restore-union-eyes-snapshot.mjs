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
 * This file deliberately does not perform the restore in this commit.
 * The interface is in place; the operator selects the snapshot source
 * and wires the corresponding restore implementation. See
 * `migration-execution-governance.md` for the rationale.
 */

import { URL } from 'node:url';

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

const env = (process.env.UE_ENVIRONMENT || process.env.NZILA_MODE || '').toLowerCase();
if (env === 'production' || env === 'prod') {
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
info(`Target environment: ${env || '(unspecified)'}`);
info(
  'Restore implementation is operator-selected. See ' +
    'docs/architecture/orm-governance/fresh-database-bootstrap-reference-implementation.md ' +
    'for the supported restore matrix.',
);

// Intentional non-zero exit until an operator wires the restore for
// their environment. This guarantees demo/pilot bootstraps cannot
// silently skip the restore step when UE_DB_RESTORE_SNAPSHOT_URL is set.
fail(
  'Restore not yet wired for this environment. Either:\n' +
    '  1) implement the restore in this script for your snapshot source, or\n' +
    '  2) unset UE_DB_RESTORE_SNAPSHOT_URL to bootstrap without restore (cache-only).',
);
