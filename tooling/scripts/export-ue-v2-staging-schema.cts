/** Local-only current-plan schema export. Requires the hash-locked wheelhouse and pinned Docker image; never connects to Azure. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import pg from 'pg'

const root = path.resolve(__dirname, '../..')
const base = path.join(root, 'apps/union-eyes/scripts/bootstrap-v2')
const {
  connectLocalV2,
  createCurrentState,
  applyV2,
  inspectCatalog,
  catalogDigest,
  verifyCurrentModels,
} = require(path.join(base, 'installer.ts'))
const { compileMinimumRoleProvisioningSql } = require(path.join(base, 'minimum-installer.ts'))
const { qualifyNativePrivileges } = require(path.join(base, 'manifest-security.ts'))
const { sqlFromGuardedDump } = require('./lib/ue-guarded-postgres-dump.mjs')
const { transformSchemaDump, transformReceiptDump } = require(
  path.join(root, 'apps/union-eyes/scripts/production/prepare-bootstrap-restore.ts'),
)
const hash = (x: string | Buffer) => createHash('sha256').update(x).digest('hex')
const image =
  'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337'
const name = 'ue-v2-export-' + randomUUID()
const outIndex = process.argv.indexOf('--out')
const out = outIndex >= 0 ? process.argv[outIndex + 1] : undefined
if (!out || !path.isAbsolute(out)) throw new Error('UE_V2_EXPORT_ABSOLUTE_OUTPUT_REQUIRED')
if (fs.existsSync(out) && fs.readdirSync(out).length)
  throw new Error('UE_V2_EXPORT_OUTPUT_NOT_EMPTY')
const password = randomBytes(32).toString('hex')
const clients: pg.Client[] = []
let container: string | undefined
function docker(args: string[]) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    timeout: 180000,
    env: { ...process.env, POSTGRES_PASSWORD: password },
    maxBuffer: 64 * 1024 * 1024,
  }).trim()
}
async function main() {
  const wheelhouse = process.env.UE_V2_WHEELHOUSE
  if (!wheelhouse || !path.isAbsolute(wheelhouse)) throw new Error('UE_V2_WHEELHOUSE_REQUIRED')
  execFileSync('pnpm', ['exec', 'tsx', path.join(base, 'plan.ts'), '--self-test', '--check'], {
    cwd: root,
    env: process.env,
    stdio: 'pipe',
    timeout: 240000,
    maxBuffer: 4 * 1024 * 1024,
  })
  const applicationSourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim()
  const plan = JSON.parse(
    fs.readFileSync(
      path.join(root, 'docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'),
      'utf8',
    ),
  )
  for (const [source, digest] of Object.entries(plan.sourceCommitments)) {
    if (source.startsWith('python:')) continue
    assert.equal(
      hash(fs.readFileSync(path.join(root, source))),
      digest,
      'SOURCE_COMMITMENT_MISMATCH:' + source,
    )
  }
  const dirty = execFileSync(
    'git',
    [
      'status',
      '--porcelain',
      '--',
      'apps/union-eyes',
      'packages/db',
      'docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json',
      'tooling/scripts/export-ue-v2-staging-schema.cts',
      'tooling/scripts/lib/ue-guarded-postgres-dump.mjs',
    ],
    { cwd: root, encoding: 'utf8', stdio: 'pipe' },
  )
  assert.equal(dirty.trim(), '', 'UE_V2_EXPORT_CLEAN_COMMITTED_SOURCE_REQUIRED')
  container = docker([
    'run',
    '-d',
    '--rm',
    '--pull',
    'never',
    '--platform',
    'linux/amd64',
    '--name',
    name,
    '--label',
    'nzila.mission=UE_V2_CURRENT_EXPORT',
    '--memory',
    '2g',
    '-p',
    '127.0.0.1::5432',
    '-e',
    'POSTGRES_PASSWORD',
    image,
  ])
  const binding = JSON.parse(
    docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', container]),
  )
  const config = {
    host: '127.0.0.1',
    port: Number(binding['5432/tcp'][0].HostPort),
    user: 'postgres',
    password,
  }
  let admin: pg.Client | undefined
  for (let i = 0; i < 80; i++) {
    const c = new pg.Client({ ...config, database: 'postgres', connectionTimeoutMillis: 1000 })
    try {
      await c.connect()
      admin = c
      clients.push(c)
      break
    } catch {
      await c.end()
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  assert(admin, 'DISPOSABLE_POSTGRES_NOT_RESPONSIVE')
  const roles = compileMinimumRoleProvisioningSql()
  await admin.query(roles)
  for (const db of ['ue_v2_clean_export_reference', 'ue_v2_clean_export_qualified'])
    await admin.query(`CREATE DATABASE ${db} OWNER ue_v2_owner`)
  const reference = await connectLocalV2({ ...config, database: 'ue_v2_clean_export_reference' })
  clients.push(reference)
  await reference.query('BEGIN')
  await createCurrentState(reference, plan)
  await reference.query('COMMIT')
  const expected = await inspectCatalog(reference)
  await verifyCurrentModels(reference, plan)
  const qualified = await connectLocalV2({ ...config, database: 'ue_v2_clean_export_qualified' })
  clients.push(qualified)
  const installed = await applyV2(qualified, plan, expected)
  const repeated = await applyV2(qualified, plan, expected)
  assert.equal(repeated.result, 'NOOP')
  const privileges = await qualifyNativePrivileges(qualified, plan)
  assert.deepEqual(privileges.mismatches, [], 'NATIVE_PRIVILEGE_QUALIFICATION_FAILED')
  const catalog = await inspectCatalog(qualified)
  assert.equal(catalogDigest(catalog), catalogDigest(expected))
  const schema =
    docker([
      'exec',
      container,
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      'ue_v2_clean_export_qualified',
      '--schema-only',
    ]) + '\n'
  const receipt =
    docker([
      'exec',
      container,
      'pg_dump',
      '-U',
      'postgres',
      '-d',
      'ue_v2_clean_export_qualified',
      '--data-only',
      '--inserts',
      '--table=public.ue_v2_bootstrap_receipt',
    ]) + '\n'
  const files = {
    'schema.sql': schema,
    'receipt.sql': receipt,
    'roles.sql': roles + '\n',
    'schema-restore.sql': transformSchemaDump(schema, {
      vectorExtensionExpected: plan.statements.some((s: { canonicalId: string }) => s.canonicalId === 'CURRENT_EXTENSION:vector'),
    }),
    'receipt-restore.sql': transformReceiptDump(receipt),
  }
  // Verify the actual transformed dump, not only the installer that produced it.
  // The protocol driver rejects client commands instead of interpreting them.
  await admin.query('CREATE DATABASE ue_v2_clean_export_roundtrip OWNER ue_v2_owner')
  const roundtrip = await connectLocalV2({ ...config, database: 'ue_v2_clean_export_roundtrip' })
  clients.push(roundtrip)
  await roundtrip.query('BEGIN')
  await roundtrip.query(sqlFromGuardedDump(files['schema-restore.sql']))
  await roundtrip.query(sqlFromGuardedDump(files['receipt-restore.sql']))
  assert.equal(catalogDigest(await inspectCatalog(roundtrip)), catalogDigest(expected), 'RESTORE_CATALOG_MISMATCH')
  const restorePrivileges = await qualifyNativePrivileges(roundtrip, plan)
  assert.deepEqual(restorePrivileges.mismatches, [], 'RESTORE_PRIVILEGE_MISMATCH')
  await roundtrip.query('COMMIT')
  const restoredRepeat = await applyV2(roundtrip, plan, expected)
  assert.equal(restoredRepeat.result, 'NOOP', 'RESTORED_RECEIPT_NOT_ACCEPTED')
  fs.mkdirSync(out, { recursive: true })
  for (const [file, bytes] of Object.entries(files)) fs.writeFileSync(path.join(out, file), bytes)
  fs.writeFileSync(path.join(out, 'expected-catalog.json'), JSON.stringify(catalog, null, 2) + '\n')
  const report = {
    applicationSourceSha,
    exporterSourceDigest: hash(fs.readFileSync(__filename)),
    sourcePlanDigest: hash(JSON.stringify(plan)),
    extensions: plan.statements.filter((s: { canonicalId: string }) => s.canonicalId.startsWith('CURRENT_EXTENSION:')).map((s: { canonicalId: string }) => s.canonicalId),
    image,
    tables: plan.tables.length,
    statements: plan.statements.length,
    catalogObjects: catalog.length,
    catalogDigest: catalogDigest(catalog),
    installation: installed.result,
    repeat: repeated.result,
    restoredDump: 'PASS',
    restoredRepeat: restoredRepeat.result,
    privilegeStatus: privileges.status,
    privilegeMismatches: privileges.mismatches,
    files: Object.fromEntries(
      Object.entries(files).map(([k, v]) => [k, { bytes: Buffer.byteLength(v), sha256: hash(v) }]),
    ),
    localOnly: true,
    stagingAcceptance: false,
  }
  fs.writeFileSync(
    path.join(out, 'export-qualification.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
  console.log(JSON.stringify(report))
}
main()
  .catch((e) => {
    console.error(e.message)
    process.exitCode = 1
  })
  .finally(async () => {
    for (const c of clients.reverse()) await c.end().catch(() => {})
    if (container) docker(['rm', '-f', container])
  })
