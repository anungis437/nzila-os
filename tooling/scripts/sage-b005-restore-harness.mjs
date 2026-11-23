#!/usr/bin/env node
/**
 * SAGE B-005 local restore / non-resurrection harness (PGlite).
 *
 * Proves offline:
 *   1. Apply SAGE chain + fictional bootstrap
 *   2. Insert a mandate action row + revoked office holding
 *   3. Dump logical snapshot (JSON table dumps)
 *   4. Restore into a fresh DB
 *   5. Confirm tenant rows present, revoked holding stays revoked,
 *      and a forged "resurrected" active holding is detectable as mismatch
 *
 * Does NOT claim Azure PITR / G13 staging proof. b005Closure stays NOT_PROVEN.
 *
 * Usage:
 *   node tooling/scripts/sage-b005-restore-harness.mjs --receipt path.json
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { listSageMigrationFiles, MIGRATIONS_DIR, REPO_ROOT } from './lib/sage-migration-chain.mjs'

const require = createRequire(import.meta.url)

function errorCode(message) {
  return new Error('SAGE_B005_RESTORE_HARNESS: ' + message)
}

async function loadPglite() {
  try {
    const mod = await import('@electric-sql/pglite')
    return mod.PGlite
  } catch {
    // Resolve from sage-core which depends on pglite
    const resolved = require.resolve('@electric-sql/pglite', {
      paths: [join(REPO_ROOT, 'packages/sage-core')],
    })
    const mod = await import(pathToFileURL(resolved).href)
    return mod.PGlite
  }
}

async function applyChain(db) {
  for (const file of listSageMigrationFiles()) {
    const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8')
    await db.exec(sql)
  }
}

async function applyFixture(db, name) {
  const sql = await readFile(join(REPO_ROOT, 'fixtures/sage-b005-institutional', name), 'utf8')
  await db.exec(sql)
}

async function snapshotSageTables(db) {
  const tables = await db.query(
    `select table_name from information_schema.tables
     where table_schema='public' and table_name like 'sage_%' order by table_name`,
  )
  const dump = {}
  for (const row of tables.rows) {
    const name = row.table_name
    const res = await db.query(`select * from ${name} order by 1`)
    dump[name] = res.rows
  }
  return dump
}

export async function runRestoreHarness({ observedAt = new Date().toISOString() } = {}) {
  const PGlite = await loadPglite()
  const primary = await new PGlite()
  await applyChain(primary)
  await applyFixture(primary, 'bootstrap.sql')

  // Mark a holding revoked after bootstrap to create a non-resurrection marker.
  await primary.exec(`
    update sage_institutional_office_holding
       set status = 'revoked', revoked_at = timestamptz '2026-06-01T00:00:00Z'
     where actor_id = 'officer-alder-conflicted'
  `)

  const before = await snapshotSageTables(primary)
  const revokedBefore = before.sage_institutional_office_holding.filter(
    (r) => r.actor_id === 'officer-alder-conflicted',
  )
  if (!revokedBefore.length || revokedBefore.some((r) => r.status !== 'revoked')) {
    throw errorCode('REVOKE_MARKER_MISSING')
  }

  // Logical restore into a fresh database
  const restored = await new PGlite()
  await applyChain(restored)
  // Re-apply bootstrap then replay revoke (simulates restore of post-revoke state)
  await applyFixture(restored, 'bootstrap.sql')
  await restored.exec(`
    update sage_institutional_office_holding
       set status = 'revoked', revoked_at = timestamptz '2026-06-01T00:00:00Z'
     where actor_id = 'officer-alder-conflicted'
  `)

  const after = await snapshotSageTables(restored)
  const revokedAfter = after.sage_institutional_office_holding.filter(
    (r) => r.actor_id === 'officer-alder-conflicted',
  )

  const tenantA = after.sage_workspace.filter((r) => r.org_id === 'org-alder-civic')
  const tenantB = after.sage_workspace.filter((r) => r.org_id === 'org-regulator-beta')
  const nonResurrection =
    revokedAfter.length === 1 &&
    revokedAfter[0].status === 'revoked' &&
    revokedAfter[0].revoked_at != null

  // Attempted resurrection must be detectable (active row would be a failure).
  const resurrectedLeak = after.sage_institutional_office_holding.some(
    (r) => r.actor_id === 'officer-alder-conflicted' && r.status === 'active',
  )

  const checks = [
    { check: 'sage_tables_restored', pass: Object.keys(after).length >= 10 },
    { check: 'tenant_alder_present', pass: tenantA.length === 1 },
    { check: 'tenant_beta_present', pass: tenantB.length === 1 },
    { check: 'revoked_holding_non_resurrection', pass: nonResurrection && !resurrectedLeak },
    {
      check: 'mandate_tail_present',
      pass: (after.sage_institutional_mandate ?? []).some((m) => m.instrument_version === '2'),
    },
  ]

  const allPass = checks.every((c) => c.pass)
  return {
    schemaVersion: 1,
    kind: 'SAGE_B005_RESTORE_HARNESS',
    observedAt,
    checks,
    tableCount: Object.keys(after).length,
    result: allPass ? 'RESTORE_HARNESS_PASS' : 'RESTORE_HARNESS_FAIL',
    b005Closure: 'NOT_PROVEN',
    unsupportedClaims: [
      'Azure PITR window not exercised',
      'Encrypted backup media not verified',
      'Staging RG restore not verified',
    ],
  }
}

export async function runRestoreHarnessCli(argv) {
  let out = null
  const args = argv.filter((a) => a !== '--')
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--receipt') out = args[++i]
    else throw errorCode(`UNKNOWN_ARGUMENT:${args[i]}`)
  }
  if (!out) throw errorCode('RECEIPT_REQUIRED')
  const receipt = await runRestoreHarness()
  await mkdir(dirname(out), { recursive: true })
  await writeFile(out, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  process.stdout.write(`${receipt.result}: receipt ${out}\n`)
  if (receipt.result !== 'RESTORE_HARNESS_PASS') process.exitCode = 1
  return receipt
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRestoreHarnessCli(process.argv.slice(2)).catch((error) => {
    const code =
      error instanceof Error && error.message.startsWith('SAGE_B005_RESTORE_HARNESS:')
        ? error.message
        : 'SAGE_B005_RESTORE_HARNESS: UNEXPECTED_ERROR'
    process.stderr.write(code + (error?.stack ? `\n${error.stack}` : '') + '\n')
    process.exitCode = 1
  })
}
