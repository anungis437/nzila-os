/** Local-only PostgreSQL 16 proof. It accepts qualified schema exports, never an
 * Azure URL, and keeps all connection secrets in its private output directory. */
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import pg from 'pg'
import { inspectCatalog, catalogDigest } from '../../apps/union-eyes/scripts/bootstrap-v2/installer'
import { nativePostgres16Image } from '../../apps/union-eyes/scripts/bootstrap-v2/native-postgres-image'
import { evaluateCatalogAdmission } from '../../apps/union-eyes/lib/operations/catalog-admission'
import { parseSql } from '../../apps/union-eyes/scripts/lib/sql-census/parse'
import { currentDeadlineGuardBody } from '../../apps/union-eyes/db/auth/business-session-event-guard'
import { BUSINESS_SESSION_POLICY } from '../../apps/union-eyes/db/auth/business-session-policy'
import { sqlFromGuardedDump } from './lib/ue-guarded-postgres-dump.mjs'
import { MANAGED_PG16_LOGIN_TARGETS } from './lib/ue-managed-pg16-catalog.mjs'
import { planCanonicalForwardUpgrade, retainedForwardProfile } from './lib/ue-v2-forward-upgrade'
import {
  executeForwardUpgrade,
  verifyForwardTarget,
  forwardDigest,
  normalizeForwardCatalog,
  FORWARD_EVENT_CATALOG_QUERY,
  type ForwardUpgradeBundle,
} from './lib/ue-v2-forward-upgrade-runtime'

const arg = (name: string) => {
  const i = process.argv.indexOf(name)
  assert(i > 0 && process.argv[i + 1], `${name} required`)
  return path.resolve(process.argv[i + 1])
}
const hash = (v: string | Buffer) => createHash('sha256').update(v).digest('hex')
function load(dir: string, currentCatalog: boolean) {
  const report = JSON.parse(fs.readFileSync(path.join(dir, 'export-qualification.json'), 'utf8'))
  assert.equal(report.localOnly, true)
  assert.equal(report.restoredDump, 'PASS')
  assert.equal(report.privilegeStatus, 'PASS_PUBLIC_AND_AUTH_NATIVE_PRIVILEGES')
  assert.deepEqual(report.privilegeMismatches, [])
  for (const [file, entry] of Object.entries(report.files) as [string, { sha256: string }][]) {
    assert(/^[a-z-]+\.sql$/.test(file))
    assert.equal(hash(fs.readFileSync(path.join(dir, file))), entry.sha256)
  }
  // The old source used its own historical normalizer. Its hash-verified SQL,
  // not a reinterpreted historical JSON digest, supplies the actual preimage.
  const catalog = currentCatalog
    ? JSON.parse(fs.readFileSync(path.join(dir, 'expected-catalog.json'), 'utf8'))
    : []
  if (currentCatalog)
    assert.equal(catalogDigest(catalog), report.catalogDigest, 'PROOF_EXPORT_CATALOG_HASH')
  return { report, catalog, dir }
}

async function main() {
  const sourceFiles = [
    'tooling/scripts/prove-ue-v2-forward-upgrade.cts',
    'tooling/scripts/lib/ue-v2-forward-upgrade.ts',
    'tooling/scripts/lib/ue-v2-forward-upgrade-runtime.ts',
  ]
  const sourceHashes = () =>
    Object.fromEntries(sourceFiles.map((file) => [file, hash(fs.readFileSync(file))]))
  const toolSources = sourceHashes()
  const qualificationSourceSha = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  const before = load(arg('--before'), false),
    after = load(arg('--after'), true),
    out = arg('--out')
  assert.equal(
    before.report.applicationSourceSha,
    'cccfc8c311a1017f80241bf089c00ef0c6828751',
    'PROOF_OLD_SOURCE_MISMATCH',
  )
  fs.mkdirSync(out, { recursive: true, mode: 0o700 })
  const container = `ue-forward-proof-${randomUUID()}`,
    image = nativePostgres16Image()
  const password = randomBytes(24).toString('hex'),
    adminPassword = randomBytes(24).toString('hex')
  const loginPasswords = Object.fromEntries(
    Object.keys(MANAGED_PG16_LOGIN_TARGETS).map((name) => [name, randomBytes(24).toString('hex')]),
  )
  const docker = (args: string[]) =>
    execFileSync('docker', args, {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, POSTGRES_PASSWORD: password },
    }).trim()
  const clients: pg.Client[] = []
  let passed = false
  docker([
    'run',
    '-d',
    '--rm',
    '--pull',
    'never',
    '--name',
    container,
    '--memory',
    '2g',
    '--cpus',
    '2',
    '--label',
    'nzila.owner=codex-ue-forward-upgrade',
    '-p',
    '127.0.0.1::5432',
    '-e',
    'POSTGRES_PASSWORD',
    '-e',
    'POSTGRES_USER=azuresu',
    image,
  ])
  const port = Number(
    JSON.parse(docker(['inspect', '--format', '{{json .NetworkSettings.Ports}}', container]))[
      '5432/tcp'
    ][0].HostPort,
  )
  fs.writeFileSync(
    path.join(out, 'private-local-state.json'),
    JSON.stringify({ container, port, password, adminPassword, loginPasswords }),
    { mode: 0o600 },
  )
  const open = async (user: string, pass: string, database = 'ue_v2_staging', role?: string) => {
    for (let i = 0; i < 80; i++) {
      const c = new pg.Client({
        host: '127.0.0.1',
        port,
        user,
        password: pass,
        database,
        connectionTimeoutMillis: 1000,
        ...(role ? { options: `-c role=${role}` } : {}),
      })
      try {
        await c.connect()
        clients.push(c)
        return c
      } catch (e) {
        await c.end().catch(() => {})
        if (i === 79) throw e
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
    throw new Error('PROOF_LOCAL_DATABASE_NOT_RESPONSIVE')
  }
  try {
    const su = await open('azuresu', password, 'postgres')
    await su.query('CREATE ROLE azure_pg_admin NOLOGIN NOSUPERUSER')
    await su.query(
      `CREATE ROLE uev2admin LOGIN CREATEDB CREATEROLE NOSUPERUSER NOBYPASSRLS PASSWORD '${adminPassword}'`,
    )
    await su.query('GRANT azure_pg_admin TO uev2admin')
    await su.query('CREATE DATABASE ue_v2_staging OWNER uev2admin')
    const provider = await open('azuresu', password)
    await provider.query('ALTER SCHEMA public OWNER TO azure_pg_admin')
    const c = await open('uev2admin', adminPassword)
    await c.query('BEGIN')
    await c.query('ALTER SCHEMA public OWNER TO pg_database_owner')
    await c.query(fs.readFileSync(path.join(before.dir, 'roles.sql'), 'utf8'))
    await c.query('GRANT ue_v2_owner TO uev2admin WITH ADMIN FALSE, INHERIT FALSE, SET TRUE')
    await c.query('ALTER DATABASE ue_v2_staging OWNER TO ue_v2_owner')
    for (const file of ['schema-restore.sql', 'receipt-restore.sql'])
      await c.query(sqlFromGuardedDump(fs.readFileSync(path.join(before.dir, file), 'utf8')))
    await c.query('RESET ROLE; RESET ALL')
    for (const [login, role] of Object.entries(MANAGED_PG16_LOGIN_TARGETS)) {
      await c.query(
        `CREATE ROLE ${login} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD '${loginPasswords[login]}'`,
      )
      await c.query(`GRANT ${role} TO ${login} WITH ADMIN FALSE, INHERIT FALSE, SET TRUE`)
      await c.query(`GRANT CONNECT ON DATABASE ue_v2_staging TO ${login}`)
    }
    await c.query('REVOKE ue_v2_owner FROM uev2admin GRANTED BY uev2admin')
    await c.query('COMMIT')
    console.log('PROOF old canonical managed restore installed')

    // A nonempty historical schema, sequence, exact JSON spelling, Unicode and
    // array bounds make a reset, data rewrite or sequence reset observable.
    await provider.query('CREATE SCHEMA drizzle AUTHORIZATION uev2admin')
    await c.query(
      'CREATE TABLE drizzle.original_history (id integer PRIMARY KEY, payload json, note text, array_value text[])',
    )
    await c.query('CREATE SEQUENCE drizzle.original_sequence START 17')
    await c.query("SELECT nextval('drizzle.original_sequence')")
    const json = ' { "a": 1, "b" : [2,3] } '
    await c.query('INSERT INTO drizzle.original_history VALUES (1,$1,$2,$3)', [
      json,
      'Original — données conservées',
      '[0:1]={"a,b",NULL}',
    ])
    const org = randomUUID(),
      user = randomUUID(),
      caseId = randomUUID()
    await provider.query(
      "INSERT INTO public.organizations (id,name,slug,organization_type,hierarchy_path) VALUES ($1,'Preserved synthetic local',$2,'local',ARRAY[]::text[])",
      [org, 'forward-' + org],
    )
    await provider.query(
      'INSERT INTO user_management.users (user_id,email,email_verified) VALUES ($1,$2,true)',
      [user, user + '@example.com'],
    )
    await provider.query(
      "INSERT INTO public.claims (id,claim_id,organization_id,member_id,claim_number,description) VALUES ($1,$1,$2,$3,'PRESERVE-001','Original synthetic case')",
      [caseId, org, user],
    )
    await provider.query(
      'ALTER TABLE public.in_app_notifications ALTER COLUMN updated_at SET DEFAULT pg_catalog.now()',
    )
    // An opaque historical table remains data, even though the current source
    // declares no application authority over it. Deliberately stale grants must
    // close without discarding its original owner, row or stored JSON spelling.
    await provider.query(
      'CREATE TABLE public.ue_governance_job_execution_state (id text PRIMARY KEY,payload json)',
    )
    await provider.query('ALTER TABLE public.ue_governance_job_execution_state OWNER TO uev2admin')
    await provider.query(
      'ALTER TABLE public.ue_governance_job_execution_state ENABLE ROW LEVEL SECURITY',
    )
    await provider.query(
      'ALTER TABLE public.ue_governance_job_execution_state FORCE ROW LEVEL SECURITY',
    )
    await provider.query(
      "INSERT INTO public.ue_governance_job_execution_state VALUES ('original',$1)",
      [json],
    )
    await provider.query(
      'GRANT SELECT ON TABLE public.ue_governance_job_execution_state TO union_eyes_runtime,ue_v2_owner',
    )
    await provider.query(
      'GRANT SELECT(payload) ON TABLE public.ue_governance_job_execution_state TO ue_framework_worker',
    )

    // Source-only reproduction of the retained immutable migration helpers and
    // the previous release's exact session-policy guard. No live data or private
    // catalog is needed to reproduce this managed PostgreSQL proof in CI.
    const workbook = await parseSql(
      fs.readFileSync(
        path.resolve(
          __dirname,
          '../../apps/union-eyes/db/migrations-cache/0013_workbook_credential_payment_authority.sql',
        ),
        'utf8',
      ),
    )
    assert(workbook.ok)
    const names = new Set([
      'ue_is_workbook_system_principal',
      'ue_enforce_workbook_credential_authority',
    ])
    let installed = 0
    for (const [i, node] of workbook.statements.entries()) {
      const name = node.CreateFunctionStmt?.funcname?.at(-1)?.String?.sval
      if (!names.has(name)) continue
      await provider.query(workbook.texts[i])
      await provider.query(`ALTER FUNCTION public.${name}() OWNER TO uev2admin`)
      installed++
    }
    assert.equal(installed, 2)
    const priorPredicate =
      "user_management.auth_business_org_authorized((NULLIF(current_setting('app.current_org_id'::text, true), ''::text))::uuid, NULL::text[])"
    await provider.query(
      `CREATE FUNCTION public.ue_guard_deadline_reassignment_convergence_policy() RETURNS event_trigger LANGUAGE plpgsql AS $prior$${currentDeadlineGuardBody(BUSINESS_SESSION_POLICY, priorPredicate)}$prior$`,
    )
    await provider.query(
      'ALTER FUNCTION public.ue_guard_deadline_reassignment_convergence_policy() OWNER TO uev2admin',
    )
    await provider.query(
      'CREATE POLICY ue_system_full_access ON public.deadline_reassignment_convergence TO union_eyes_system USING(true) WITH CHECK(true)',
    )
    await provider.query(
      'CREATE TRIGGER ue_workbook_credential_authority BEFORE INSERT OR UPDATE ON public.workbooks FOR EACH ROW EXECUTE FUNCTION public.ue_enforce_workbook_credential_authority()',
    )
    await provider.query(
      "CREATE EVENT TRIGGER ue_guard_deadline_reassignment_convergence_policy ON ddl_command_end WHEN TAG IN('CREATE POLICY','ALTER POLICY') EXECUTE FUNCTION public.ue_guard_deadline_reassignment_convergence_policy()",
    )

    const oldRuntime = await open(
      'ue_staging_runtime',
      loginPasswords.ue_staging_runtime,
      'ue_v2_staging',
      'union_eyes_runtime',
    )
    const actual = [
      ...(await inspectCatalog(oldRuntime)),
      ...(await oldRuntime.query(FORWARD_EVENT_CATALOG_QUERY)).rows,
    ]
    const queries: string[] = []
    // Produce the source inspector's fixed PostgreSQL-16 query program. This is
    // SQL generation only; only real query results below are native evidence.
    await inspectCatalog({
      query: async (sql: string) =>
        sql.includes('server_version_num')
          ? { rows: [{ version: '160012' }] }
          : (queries.push(sql), { rows: [] }),
    } as unknown as pg.Client)
    queries.push(FORWARD_EVENT_CATALOG_QUERY)
    const profile = retainedForwardProfile(
      actual,
      after.catalog,
      fs.readFileSync(path.join(after.dir, 'schema.sql'), 'utf8'),
    )
    const statements = [
      ...profile.prefix,
      ...(await planCanonicalForwardUpgrade({
        before: actual,
        after: profile.target,
        dump: profile.dump,
      })),
      ...profile.suffix,
    ]
    const bundle: ForwardUpgradeBundle = {
      version: 1,
      applicationSourceSha: after.report.applicationSourceSha,
      catalogSourceSha: after.report.applicationSourceSha,
      sourcePlanDigest: after.report.sourcePlanDigest,
      catalogQueries: queries,
      before: actual,
      target: profile.target,
      statements,
    }
    fs.writeFileSync(path.join(out, 'bundle.json'), JSON.stringify(bundle))
    console.log('PROOF plan compiled', statements.length)

    await c.query('BEGIN')
    await assert.rejects(
      executeForwardUpgrade(c, bundle, {
        afterStatement: (i) => {
          if (i === 2) throw new Error('PROOF_INJECTED_AFTER_DDL')
        },
      }),
      /PROOF_INJECTED_AFTER_DDL/,
    )
    await c.query('ROLLBACK')
    assert.equal(
      forwardDigest(
        normalizeForwardCatalog([
          ...(await inspectCatalog(oldRuntime)),
          ...(await oldRuntime.query(FORWARD_EVENT_CATALOG_QUERY)).rows,
        ]),
      ),
      forwardDigest(normalizeForwardCatalog(actual)),
      'PROOF_FAILED_UPGRADE_LEFT_CATALOG_CHANGES',
    )
    assert.equal(
      (await c.query('SELECT payload::text FROM drizzle.original_history')).rows[0].payload,
      json,
    )
    console.log('PROOF injected DDL failure rolled back without data or role residue')

    // The managed administrator observed in staging has pre-existing BYPASSRLS.
    // Prove both profiles on this owned disposable server. Only the provider
    // fixture changes that attribute; the upgrade itself must preserve it.
    await c.query('BEGIN')
    const noBypassRehearsal = await executeForwardUpgrade(c, bundle)
    assert.equal(noBypassRehearsal.operatorProfile.rolbypassrls, false)
    await c.query('ROLLBACK')
    assert.equal(
      forwardDigest(
        normalizeForwardCatalog([
          ...(await inspectCatalog(oldRuntime)),
          ...(await oldRuntime.query(FORWARD_EVENT_CATALOG_QUERY)).rows,
        ]),
      ),
      forwardDigest(normalizeForwardCatalog(actual)),
      'PROOF_NOBYPASS_REHEARSAL_LEFT_CATALOG_CHANGES',
    )
    await provider.query('ALTER ROLE uev2admin BYPASSRLS')
    await c.query('BEGIN')
    await assert.rejects(
      executeForwardUpgrade(c, bundle, {
        afterStatement: (i) => {
          if (i === 2) throw new Error('PROOF_INJECTED_PREEXISTING_BYPASS_AFTER_DDL')
        },
      }),
      /PROOF_INJECTED_PREEXISTING_BYPASS_AFTER_DDL/,
    )
    await c.query('ROLLBACK')
    assert.equal(
      forwardDigest(
        normalizeForwardCatalog([
          ...(await inspectCatalog(oldRuntime)),
          ...(await oldRuntime.query(FORWARD_EVENT_CATALOG_QUERY)).rows,
        ]),
      ),
      forwardDigest(normalizeForwardCatalog(actual)),
      'PROOF_BYPASS_FAILED_UPGRADE_LEFT_CATALOG_CHANGES',
    )
    assert.equal(
      (await c.query("SELECT rolbypassrls FROM pg_roles WHERE rolname='uev2admin'")).rows[0]
        .rolbypassrls,
      true,
      'PROOF_EXISTING_OPERATOR_BYPASS_CHANGED',
    )
    await c.query('BEGIN')
    const receipt = await executeForwardUpgrade(c, bundle)
    assert.equal(receipt.operatorProfile.rolbypassrls, true)
    await c.query('COMMIT')
    assert.equal(
      (await c.query('SELECT payload::text FROM drizzle.original_history')).rows[0].payload,
      json,
    )
    const runtime = await open(
      'ue_staging_runtime',
      loginPasswords.ue_staging_runtime,
      'ue_v2_staging',
      'union_eyes_runtime',
    )
    const finalQualification = await verifyForwardTarget(runtime, bundle)
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    process.env.UE_ENVIRONMENT = 'staging'
    const admission = await evaluateCatalogAdmission(async (sql) => (await runtime.query(sql)).rows)
    assert.equal(
      admission.ok,
      true,
      `PROOF_PACKAGED_ADMISSION_FAILED:${admission.violations.join('|')}`,
    )
    const originalReceipt = (
      await provider.query('SELECT source_digest FROM public.ue_v2_bootstrap_receipt')
    ).rows
    assert.equal(
      originalReceipt[0].source_digest,
      before.report.sourcePlanDigest,
      'PROOF_ORIGINAL_BOOTSTRAP_RECEIPT_CHANGED',
    )
    const result = {
      status: 'PASS_DISPOSABLE_MANAGED_FORWARD_UPGRADE',
      qualificationSourceSha,
      toolSources,
      image,
      source: after.report.applicationSourceSha,
      originalSource: before.report.applicationSourceSha,
      injectedFailureRollback: true,
      operatorProfiles: {
        noBypass: {
          fullRehearsalRollback: true,
          originalAttributesPreserved: noBypassRehearsal.operatorAttributesPreserved,
        },
        preexistingBypass: {
          injectedFailureRollback: true,
          committedUpgrade: true,
          originalAttributesPreserved: receipt.operatorAttributesPreserved,
        },
        applicationPrincipalsRemainUnprivileged: admission.ok,
        liveAdministratorAttributesChanged: false,
      },
      originalBootstrapReceiptPreserved: true,
      packagedAdmission: { ok: admission.ok, violations: admission.violations },
      ...receipt,
      finalQualification,
      stagingAcceptance: false,
    }
    assert.deepEqual(sourceHashes(), toolSources, 'PROOF_TOOL_SOURCE_CHANGED_DURING_EXECUTION')
    fs.writeFileSync(path.join(out, 'receipt.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
    passed = true
  } finally {
    for (const c of clients) await c.end().catch(() => {})
    if (passed) docker(['rm', '-f', container])
    else console.log('PROOF failed; owned disposable container retained for diagnosis:', container)
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'PROOF_FAILED')
  process.exitCode = 1
})
