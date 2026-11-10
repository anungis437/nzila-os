/** Local-only managed-role qualification. No remote host or connection URL is accepted. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import pg from 'pg'
const root = path.resolve(__dirname, '../..')
const base = path.join(root, 'apps/union-eyes/scripts/bootstrap-v2')
const { inspectCatalog, catalogDigest, verifyCurrentModels } = require(
  path.join(base, 'installer.ts'),
)
const { canonicalCatalogObject } = require(path.join(base, 'catalog-normalization.ts'))
const { qualifyNativePrivileges } = require(path.join(base, 'manifest-security.ts'))
const {
  qualifyManagedPg16Catalog,
  assertManagedPg16PrivilegeProbe,
  MANAGED_PG16_LOGIN_TARGETS,
} = require('./lib/ue-managed-pg16-catalog.mjs')
const { sqlFromGuardedDump } = require('./lib/ue-guarded-postgres-dump.mjs')
const hash = (x: string | Buffer) => createHash('sha256').update(x).digest('hex')
const exportIndex = process.argv.indexOf('--export')
const requestedExportDir = exportIndex >= 0 ? process.argv[exportIndex + 1] : undefined
assert(
  requestedExportDir && path.isAbsolute(requestedExportDir),
  'QUALIFIED_ABSOLUTE_EXPORT_REQUIRED',
)
const exportDir: string = requestedExportDir
const referenceReport = JSON.parse(
  fs.readFileSync(path.join(exportDir, 'export-qualification.json'), 'utf8'),
)
assert.equal(referenceReport.localOnly, true)
assert.equal(referenceReport.restoredDump, 'PASS')
assert.deepEqual(referenceReport.privilegeMismatches, [])
assert.equal(referenceReport.privilegeStatus, 'PASS_PUBLIC_AND_AUTH_NATIVE_PRIVILEGES')
assert.equal(referenceReport.repeat, 'NOOP')
assert.equal(referenceReport.restoredRepeat, 'NOOP')
assert.equal(referenceReport.stagingAcceptance, false)
assert.equal(referenceReport.catalogNormalization, 'PG16_DUMP_EQUIVALENCE_V1')
assert(/^[a-f0-9]{40}$/.test(referenceReport.applicationSourceSha), 'EXPORT_SOURCE_SHA_REQUIRED')
assert.equal(
  referenceReport.exporterSourceDigest,
  hash(fs.readFileSync(path.join(__dirname, 'export-ue-v2-staging-schema.cts'))),
  'EXPORTER_SOURCE_BINDING_MISMATCH',
)
assert.deepEqual(
  Object.keys(referenceReport.files).sort(),
  ['schema.sql', 'receipt.sql', 'roles.sql', 'schema-restore.sql', 'receipt-restore.sql'].sort(),
  'EXPORT_FILE_SET_MISMATCH',
)

for (const [file, entry] of Object.entries(referenceReport.files) as [
  string,
  { sha256: string },
][]) {
  assert(/^[a-z-]+\.sql$/.test(file), 'INVALID_EXPORT_FILE')
  assert.equal(
    hash(fs.readFileSync(path.join(exportDir, file))),
    entry.sha256,
    `EXPORT_HASH_MISMATCH:${file}`,
  )
}
const plan = JSON.parse(
  fs.readFileSync(
    path.join(root, 'docs/union-eyes/bootstrap-v2/UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'),
    'utf8',
  ),
)
assert.equal(
  hash(JSON.stringify(plan)),
  referenceReport.sourcePlanDigest,
  'EXPORT_PLAN_BINDING_MISMATCH',
)
const reference = JSON.parse(fs.readFileSync(path.join(exportDir, 'expected-catalog.json'), 'utf8'))
assert.equal(
  catalogDigest(reference),
  referenceReport.catalogDigest,
  'EXPORT_CATALOG_BINDING_MISMATCH',
)
const image =
  'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337'
assert.equal(referenceReport.image, image, 'EXPORT_DATABASE_IMAGE_MISMATCH')
const name = 'ue-managed-role-qualification-' + randomUUID()
const db = 'ue_v2_clean_managed_role_qualification'
const bootstrapPassword = randomBytes(32).toString('hex')
const adminPassword = randomBytes(32).toString('hex')
const loginPasswords = Object.fromEntries(
  Object.keys(MANAGED_PG16_LOGIN_TARGETS).map((n) => [n, randomBytes(32).toString('hex')]),
)
const clients: pg.Client[] = []
let created = false
let phase = 'start'
function docker(args: string[]) {
  return execFileSync('docker', args, {
    encoding: 'utf8',
    env: { ...process.env, POSTGRES_PASSWORD: bootstrapPassword },
    timeout: 180000,
    maxBuffer: 4 * 1024 * 1024,
  }).trim()
}
async function forbidden(client: pg.Client, statement: string) {
  try {
    await client.query(statement)
  } catch (e) {
    assert.equal((e as { code: string }).code, '42501')
    return
  }
  throw new Error('EXPECTED_NATIVE_PRIVILEGE_DENIAL')
}
async function main() {
  docker([
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
    'nzila.mission=UE_MANAGED_ROLE_QUALIFICATION',
    '--memory',
    '2g',
    '-p',
    '127.0.0.1::5432',
    '-e',
    'POSTGRES_PASSWORD',
    '-e',
    'POSTGRES_USER=azuresu',
    image,
  ])
  created = true
  const port = Number(
    JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', name]))[
      '5432/tcp'
    ][0].HostPort,
  )
  const config = { host: '127.0.0.1', port, database: db }
  let bootstrap: pg.Client | undefined
  for (let i = 0; i < 80; i++) {
    const c = new pg.Client({
      ...config,
      database: 'postgres',
      user: 'azuresu',
      password: bootstrapPassword,
      connectionTimeoutMillis: 1000,
    })
    try {
      await c.connect()
      bootstrap = c
      clients.push(c)
      break
    } catch {
      await c.end()
      await new Promise((r) => setTimeout(r, 500))
    }
  }
  assert(bootstrap, 'DISPOSABLE_MANAGED_MODEL_NOT_RESPONSIVE')
  phase = 'provider-owned-empty-database'
  await bootstrap.query('CREATE ROLE azure_pg_admin NOLOGIN NOSUPERUSER')
  await bootstrap.query(
    `CREATE ROLE uev2admin LOGIN CREATEDB CREATEROLE NOSUPERUSER NOBYPASSRLS PASSWORD '${adminPassword}'`,
  )
  await bootstrap.query('GRANT azure_pg_admin TO uev2admin')
  await bootstrap.query(`CREATE DATABASE ${db} OWNER uev2admin`)
  const provider = new pg.Client({ ...config, user: 'azuresu', password: bootstrapPassword })
  await provider.connect()
  clients.push(provider)
  await provider.query('ALTER SCHEMA public OWNER TO azure_pg_admin')
  const admin = new pg.Client({ ...config, user: 'uev2admin', password: adminPassword })
  await admin.connect()
  clients.push(admin)
  phase = 'managed-restore'
  await admin.query('BEGIN')
  // Azure owns public through azure_pg_admin. Transfer it while the operator
  // is still database owner, before transferring the database to the canonical owner.
  await admin.query('ALTER SCHEMA public OWNER TO pg_database_owner')
  await admin.query(fs.readFileSync(path.join(exportDir, 'roles.sql'), 'utf8'))
  await admin.query('GRANT ue_v2_owner TO uev2admin WITH ADMIN FALSE, INHERIT FALSE, SET TRUE')
  await admin.query(`ALTER DATABASE ${db} OWNER TO ue_v2_owner`)
  for (const f of ['schema-restore.sql', 'receipt-restore.sql'])
    await admin.query(sqlFromGuardedDump(fs.readFileSync(path.join(exportDir, f), 'utf8')))
  await admin.query('RESET ROLE; RESET ALL')
  for (const [login, target] of Object.entries(MANAGED_PG16_LOGIN_TARGETS) as [string, string][]) {
    await admin.query(
      `CREATE ROLE ${login} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${loginPasswords[login]}'`,
    )
    await admin.query(`GRANT ${target} TO ${login} WITH ADMIN FALSE, INHERIT FALSE, SET TRUE`)
    await admin.query(`GRANT CONNECT ON DATABASE ${db} TO ${login}`)
  }
  const logins = Object.keys(MANAGED_PG16_LOGIN_TARGETS)
  async function snapshots(client: pg.Client) {
    const roles = (
      await client.query(
        `SELECT rolname name,rolsuper superuser,rolbypassrls bypassrls,rolcreatedb createdb,rolcreaterole createrole,rolreplication replication,rolinherit inherit,rolcanlogin login FROM pg_roles WHERE rolname=ANY($1::text[])`,
        [[...logins, 'uev2admin', 'azuresu']],
      )
    ).rows
    const loginMemberships = (
      await client.query(
        `SELECT parent.rolname role,member.rolname member,grantor.rolname grantor,m.admin_option admin,m.inherit_option inherit,m.set_option set FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member JOIN pg_roles grantor ON grantor.oid=m.grantor WHERE parent.rolname=ANY($1::text[]) OR member.rolname=ANY($1::text[])`,
        [logins],
      )
    ).rows
    return {
      operator: roles.find((r) => r.name === 'uev2admin'),
      bootstrap: roles.find((r) => r.name === 'azuresu'),
      loginRoles: roles.filter((r) => logins.includes(r.name)),
      loginMemberships,
    }
  }
  async function qualify(client: pg.Client, state: 'RESTORE_OPEN' | 'FINAL') {
    const catalog = await inspectCatalog(client)
    const proof = qualifyManagedPg16Catalog({
      reference: reference.map(canonicalCatalogObject),
      actual: catalog.map(canonicalCatalogObject),
      ...(await snapshots(client)),
      phase: state,
    })
    assert.equal(
      catalogDigest(proof.projection),
      referenceReport.catalogDigest,
      'MANAGED_CANONICAL_PROJECTION_MISMATCH',
    )
    const native = await qualifyNativePrivileges(client, plan)
    return { catalog, proof, privilege: assertManagedPg16PrivilegeProbe(native, proof) }
  }
  await admin.query('SET ROLE ue_v2_owner')
  await verifyCurrentModels(admin, plan)
  const receipt = (
    await admin.query(
      'SELECT contract_version,source_digest,catalog_digest FROM public.ue_v2_bootstrap_receipt WHERE singleton=true',
    )
  ).rows
  assert.equal(receipt.length, 1)
  assert.equal(receipt[0].source_digest, referenceReport.sourcePlanDigest)
  assert.equal(receipt[0].catalog_digest, referenceReport.catalogDigest)
  const open = await qualify(admin, 'RESTORE_OPEN')
  await admin.query('RESET ROLE')
  await admin.query('REVOKE ue_v2_owner FROM uev2admin GRANTED BY uev2admin')
  await admin.query('COMMIT')
  phase = 'real-restricted-logins'
  const observers: Record<string, pg.Client> = {}
  let denials = 0
  for (const [login, target] of Object.entries(MANAGED_PG16_LOGIN_TARGETS) as [string, string][]) {
    const c = new pg.Client({ ...config, user: login, password: loginPasswords[login] })
    await c.connect()
    clients.push(c)
    observers[login] = c
    assert.equal((await c.query('SELECT session_user AS principal')).rows[0].principal, login)
    await forbidden(c, 'SELECT count(*) FROM public.claims')
    denials++
    for (const prohibited of ['ue_v2_owner', ...Object.values(MANAGED_PG16_LOGIN_TARGETS)].filter(
      (r) => r !== target,
    )) {
      await forbidden(c, `SET ROLE ${prohibited}`)
      denials++
    }
  }
  const runtime = observers.ue_staging_runtime
  await runtime.query(
    'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL ROLE union_eyes_runtime',
  )
  const final = await qualify(runtime, 'FINAL')
  await forbiddenWithSavepoint(runtime, 'SELECT * FROM public.ue_v2_bootstrap_receipt')
  await runtime.query('COMMIT')
  phase = 'real-negative-controls'
  await admin.query(
    'GRANT ue_v2_owner TO ue_staging_runtime WITH ADMIN FALSE, INHERIT FALSE, SET TRUE',
  )
  await runtime.query(
    'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL ROLE union_eyes_runtime',
  )
  await assert.rejects(qualify(runtime, 'FINAL'), /MANAGED_ROLE_MEMBERSHIP_DRIFT/)
  await runtime.query('COMMIT')
  await admin.query('REVOKE ue_v2_owner FROM ue_staging_runtime GRANTED BY uev2admin')
  await forbidden(runtime, 'SET ROLE ue_v2_owner')
  denials++
  await admin.query('GRANT ue_v2_owner TO uev2admin WITH ADMIN FALSE, INHERIT FALSE, SET TRUE')
  await admin.query(
    'SET ROLE ue_v2_owner; GRANT SELECT ON public.claims TO ue_staging_runtime; RESET ROLE',
  )
  await admin.query('REVOKE ue_v2_owner FROM uev2admin GRANTED BY uev2admin')
  await runtime.query(
    'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY; SET LOCAL ROLE union_eyes_runtime',
  )
  await assert.rejects(
    qualify(runtime, 'FINAL'),
    /MANAGED_CATALOG_DEFINITION_DRIFT:relation:public.claims/,
  )
  await runtime.query('COMMIT')
  const report = {
    status: 'PASS',
    localOnly: true,
    stagingAcceptance: false,
    image,
    exportApplicationSourceSha: referenceReport.applicationSourceSha,
    sourcePlanDigest: referenceReport.sourcePlanDigest,
    canonicalCatalogDigest: referenceReport.catalogDigest,
    finalRawCatalogDigest: catalogDigest(final.catalog),
    profile: final.proof.profile,
    canonicalObjects: final.proof.canonicalObjects,
    managedObjects: final.proof.actualObjects,
    openPrivilege: open.privilege,
    finalPrivilege: final.privilege,
    loginBoundaryDenials: denials,
    receiptReadDeniedToRuntime: true,
    extraOwnerMembershipRejected: true,
    directLoginTableGrantRejected: true,
    temporaryOperatorSetGrantRemoved: true,
    qualifierSourceDigest: hash(fs.readFileSync(__filename)),
    profileSourceDigest: hash(
      fs.readFileSync(path.join(__dirname, 'lib/ue-managed-pg16-catalog.mjs')),
    ),
    at: new Date().toISOString(),
  }
  const outputIndex = process.argv.indexOf('--receipt')
  if (outputIndex >= 0) {
    const output = process.argv[outputIndex + 1]
    assert(output && path.isAbsolute(output))
    fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' })
  }
  console.log(JSON.stringify(report))
}
async function forbiddenWithSavepoint(client: pg.Client, statement: string) {
  await client.query('SAVEPOINT privilege_denial')
  await forbidden(client, statement)
  await client.query('ROLLBACK TO SAVEPOINT privilege_denial; RELEASE SAVEPOINT privilege_denial')
}
main()
  .catch((e) => {
    console.error(
      JSON.stringify({
        status: 'FAIL',
        phase,
        code: e.code ?? null,
        message: String(e.message)
          .replaceAll(bootstrapPassword, '[redacted]')
          .replaceAll(adminPassword, '[redacted]')
          .slice(0, 1500),
      }),
    )
    process.exitCode = 1
  })
  .finally(async () => {
    for (const client of clients) await client.end().catch(() => {})
    if (created) docker(['rm', '-f', name])
  })
