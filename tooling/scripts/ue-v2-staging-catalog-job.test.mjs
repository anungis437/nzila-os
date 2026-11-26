import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  CATALOG_SCHEMA,
  CONTAINER_NAME,
  EXPECTED_IMAGE,
  EXPECTED_REVISION,
  RESOURCE_GROUP,
  SUBSCRIPTION_ID,
  TENANT_ID,
  buildContinuationToken,
  containerSource,
  continuationDefect,
  reconcileCatalogSessions,
} from './ue-v2-staging-catalog-exec.mjs'
import {
  JOB_PURPOSE,
  STAGING_HOST,
  assertStagingTarget,
  cleanupOwnedJob,
  executeCatalogJob,
  jobNameForRun,
  jobSpecification,
  operatorImageDefect,
  ownedJobDefect,
} from './ue-v2-staging-catalog-job.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const require = createRequire(path.join(REPO, 'package.json'))
const YAML = require('yaml')
const WORKFLOW = path.join(REPO, '.github/workflows/ue-v2-staging-catalog-job.yml')
const IMAGE = `nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2-catalog@sha256:${'b'.repeat(64)}`
const SHA = 'c'.repeat(40)
const RUN = '45887919234'

function query(id, rows) {
  return { id, rowCount: rows.length, rows }
}

function completeCatalog() {
  return {
    schema: CATALOG_SCHEMA,
    rolledBack: true,
    observedAt: '2026-11-26T20:00:00.000Z',
    readOnlyCredential: false,
    identity: { database: 'ue_v2_staging', user: 'union_eyes_runtime', transaction_read_only: 'on' },
    privilege: { user: 'union_eyes_runtime', classification: 'LIMITED_RUNTIME', readOnlyCredential: false, rolsuper: false, rolbypassrls: false },
    queries: [
      query('identity', [{ database: 'ue_v2_staging', user: 'union_eyes_runtime', transaction_read_only: 'on' }]),
      query('migration_relations', []),
      query('migration_columns', []),
      query('drizzle_rows', []),
      query('roles', [{ rolname: 'union_eyes_runtime', rolsuper: false, rolbypassrls: false }]),
      query('memberships', []),
      query('relations', [{ schema: 'public', name: 'members' }]),
      query('rls', [{ schema: 'public', name: 'members', relrowsecurity: true }]),
      query('policies', []),
      query('function', []),
      query('security_definer', []),
      query('event_trigger', []),
      query('audit', []),
      query('audit_grants', []),
      query('sequences', []),
      query('tables', [{ schema: 'public', name: 'members' }]),
    ],
    counts: [{ schema: 'public', name: 'members', visibleToConnectedRole: true, globalTotal: false, classification: 'OBSERVED', n: '1' }],
  }
}

function marked(body, digestOverride) {
  const json = JSON.stringify(body)
  const digest = digestOverride ?? createHash('sha256').update(json).digest('hex')
  return `UE_CATALOG_BEGIN\n${json}\nUE_CATALOG_END\nUE_CATALOG_SHA256 ${digest}\n`
}

function liveEnv(extra = {}) {
  return {
    UE_CATALOG_JOB_LIVE: '1',
    GITHUB_REPOSITORY: 'anungis437/nzila-os',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_RUN_ID: RUN,
    GITHUB_SHA: SHA,
    OPERATOR_IMAGE: IMAGE,
    ...extra,
  }
}

function revision() {
  return {
    name: EXPECTED_REVISION,
    healthState: 'Healthy',
    trafficWeight: 100,
    containers: [{ name: CONTAINER_NAME, image: EXPECTED_IMAGE }],
  }
}

function harness(options = {}) {
  const calls = []
  let shows = 0
  const spawn = async (executable, args) => {
    calls.push({ executable, args })
    const line = args.join(' ')
    if (line.includes('account show')) return { code: 0, stdout: JSON.stringify({ subscriptionId: options.subscriptionId ?? SUBSCRIPTION_ID, tenantId: options.tenantId ?? TENANT_ID }), stderr: '' }
    if (line.includes('revision show')) return { code: 0, stdout: JSON.stringify(options.revision ?? revision()), stderr: '' }
    if (line.includes('secrets[].name')) return { code: 0, stdout: JSON.stringify(options.secrets ?? ['database-url']), stderr: '' }
    if (line.includes('job create')) return { code: options.createCode ?? 0, stdout: '', stderr: options.createError ?? '' }
    if (line.includes('job start')) return { code: options.startCode ?? 0, stdout: `${jobNameForRun(RUN)}-exec\n`, stderr: '' }
    if (line.includes('execution show')) return { code: 0, stdout: `${options.status ?? 'Succeeded'}\n`, stderr: '' }
    if (line.includes('logs show')) return { code: 0, stdout: options.logs ?? '', stderr: options.logError ?? '' }
    if (line.includes('job show')) {
      shows += 1
      if (options.unowned) return { code: 0, stdout: JSON.stringify({ name: 'ue-v2-forward-1', tags: { purpose: 'staging-forward-upgrade', runId: '1' } }), stderr: '' }
      if (options.cleanupMissing && shows === 1) return { code: 1, stdout: '', stderr: 'not found' }
      if (shows > 1) return { code: options.afterCode ?? 3, stdout: '', stderr: 'missing' }
      return { code: 0, stdout: JSON.stringify({ name: jobNameForRun(RUN), tags: { purpose: JOB_PURPOSE, runId: RUN, source: SHA } }), stderr: '' }
    }
    if (line.includes('job delete')) return { code: options.deleteCode ?? 0, stdout: '', stderr: options.deleteError ?? '' }
    return { code: 1, stdout: '', stderr: `UNEXPECTED ${line}` }
  }
  return { calls, spawn }
}

test('staging targeting, image pinning, and job custody fail closed', () => {
  assert.equal(assertStagingTarget({ resourceGroup: 'nzila-production-rg', database: 'ue_v2_production', host: 'prod.postgres.database.azure.com' }), 'WRONG_ENVIRONMENT')
  assert.equal(assertStagingTarget({ resourceGroup: RESOURCE_GROUP, database: 'ue_v2_staging', host: STAGING_HOST }), null)
  assert.equal(operatorImageDefect(EXPECTED_IMAGE), 'OPERATOR_IMAGE_UNQUALIFIED')
  assert.equal(operatorImageDefect('nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2-catalog:latest'), 'OPERATOR_IMAGE_UNQUALIFIED')
  assert.equal(operatorImageDefect(IMAGE), null)
  assert.equal(ownedJobDefect({ name: 'ue-v2-forward-1', tags: { purpose: 'staging-forward-upgrade' } }, { name: jobNameForRun(RUN), runId: RUN, source: SHA }), 'UNOWNED_JOB')
  const spec = jobSpecification({ image: IMAGE, runId: RUN, source: SHA })
  assert.equal(JSON.stringify(spec).includes('containerapp exec'), false)
  assert.equal(JSON.stringify(spec).includes('PGPASSWORD'), false)
  assert.equal(spec.properties.template.containers[0].env.some((item) => item.secretRef === 'database-url'), true)
})

test('the private job controller does not use the exec console', async () => {
  const text = readFileSync(new URL('./ue-v2-staging-catalog-job.mjs', import.meta.url), 'utf8')
  assert.equal(text.includes('containerapp exec'), false)
  assert.equal(text.includes("exec/action"), false)
  const produced = await executeCatalogJob(liveEnv(), harness({ logs: marked(completeCatalog()) }).spawn)
  assert.equal(produced.exitCode, 0)
  assert.equal(produced.report.verdict, 'CATALOG_COMPLETE')
  assert.equal(produced.report.catalogAccepted, true)
  assert.equal(produced.report.S2_02_PREIMAGE_COMPLETE, 'NO')
  assert.equal(produced.report.cleanup.deleted, true)
  assert.equal(produced.report.phases.delete, 'DONE')
})

test('controller failure modes stay diagnosable and an unowned job is not deleted', async () => {
  const marker = String.fromCharCode(109, 97, 114, 107, 101, 114, 45, 97, 108, 112, 104, 97)
  const secret = ['post', 'gresql://ue:', marker, '@db/ue_v2_staging'].join('')
  const leaked = await executeCatalogJob(liveEnv(), harness({ logs: marked(completeCatalog()), logError: secret }).spawn)
  assert.equal(JSON.stringify(leaked.report).includes(marker), false)

  const missing = await executeCatalogJob(liveEnv(), harness({ logs: 'no catalogue' }).spawn)
  assert.equal(missing.report.defects.includes('EVIDENCE_MISSING'), true)

  const mismatch = await executeCatalogJob(liveEnv(), harness({ logs: marked(completeCatalog(), 'a'.repeat(64)) }).spawn)
  assert.equal(mismatch.report.defects.includes('EVIDENCE_HASH_MISMATCH'), true)

  const unowned = await cleanupOwnedJob(async () => ({ code: 0, stdout: JSON.stringify({ name: 'scheduled-dues', tags: { purpose: 'cron' } }), stderr: '' }), { name: jobNameForRun(RUN), runId: RUN, source: SHA })
  assert.equal(unowned.deleted, false)
  assert.equal(unowned.reason, 'UNOWNED_JOB')

  const cleanup = await executeCatalogJob(liveEnv(), harness({ logs: marked(completeCatalog()), deleteCode: 1 }).spawn)
  assert.equal(cleanup.report.defects.includes('JOB_CLEANUP_FAILED'), true)

  const created = await executeCatalogJob(liveEnv(), harness({ createCode: 1, createError: secret }).spawn)
  assert.equal(created.report.defects.includes('JOB_CREATION_FAILED'), true)
  assert.equal(JSON.stringify(created.report).includes(marker), false)

  const secretMissing = await executeCatalogJob(liveEnv(), harness({ secrets: [] }).spawn)
  assert.equal(secretMissing.report.defects.includes('RUNTIME_SECRET_UNAVAILABLE'), true)

  const wrongAccount = await executeCatalogJob(liveEnv(), harness({ subscriptionId: 'other' }).spawn)
  assert.equal(wrongAccount.report.defects.includes('WRONG_SUBSCRIPTION'), true)

  const timed = await executeCatalogJob(liveEnv(), harness({ status: 'Running' }).spawn)
  assert.equal(timed.report.defects.includes('JOB_EXECUTION_TIMED_OUT'), true)

  const production = await executeCatalogJob(liveEnv({ UE_CATALOG_TARGET: JSON.stringify({ resourceGroup: 'nzila-production-rg', database: 'ue_v2_production', host: 'prod.postgres.database.azure.com' }) }), async () => { throw new Error('AZURE_CALLED') })
  assert.equal(production.report.defects.includes('WRONG_ENVIRONMENT'), true)

  const writable = completeCatalog()
  writable.rolledBack = false
  const refused = await executeCatalogJob(liveEnv(), harness({ logs: marked(writable) }).spawn)
  assert.equal(refused.report.defects.includes('READ_ONLY_TRANSACTION_UNPROVEN'), true)
})

test('count continuation reconciles one inventory and rejects drift or overlap', () => {
  const binding = { revision: EXPECTED_REVISION, image: EXPECTED_IMAGE, sessionId: 'run-1' }
  const baseline = completeCatalog()
  const tables = Array.from({ length: 251 }, (_, index) => ({ schema: 'public', name: `t${index}` }))
  baseline.queries = baseline.queries.map((item) => item.id === 'tables' ? query('tables', tables) : item)
  baseline.counts = tables.map((table, index) => ({ ...table, visibleToConnectedRole: true, globalTotal: false, classification: index < 250 ? 'OBSERVED' : 'NOT_ATTEMPTED', n: index < 250 ? '0' : null }))
  const token = buildContinuationToken(baseline, binding, Date.parse('2026-11-26T20:00:00.000Z'))
  assert.equal(token.remaining.length, 1)
  assert.equal(continuationDefect(token, binding, Date.parse('2026-11-26T21:00:00.000Z')), null)
  assert.equal(continuationDefect({ ...token, expiresAt: '2026-11-26T20:00:00.000Z' }, binding, Date.parse('2026-11-26T21:00:00.000Z')), 'CONTINUATION_EXPIRED')

  const continuation = {
    observedAt: '2026-11-26T21:00:00.000Z',
    token,
    now: Date.parse('2026-11-26T21:00:00.000Z'),
    catalog: { queries: [query('tables', tables)], counts: [{ schema: 'public', name: 't250', visibleToConnectedRole: true, globalTotal: false, classification: 'OBSERVED', n: '0' }] },
  }
  const reconciled = reconcileCatalogSessions([
    { catalog: baseline, observedAt: baseline.observedAt },
    continuation,
  ], binding)
  assert.equal(reconciled.verdict, 'CATALOG_COMPLETE')

  const drifted = structuredClone(continuation)
  drifted.catalog.queries[0].rows.push({ schema: 'public', name: 'extra' })
  assert.equal(reconcileCatalogSessions([{ catalog: baseline, observedAt: baseline.observedAt }, drifted], binding).reason, 'SCHEMA_DRIFT')

  const overlap = structuredClone(continuation)
  overlap.catalog.counts = [{ schema: 'public', name: 't0', visibleToConnectedRole: true, globalTotal: false, classification: 'OBSERVED', n: '0' }]
  assert.equal(reconcileCatalogSessions([{ catalog: baseline, observedAt: baseline.observedAt }, overlap], binding).reason, 'CONTINUATION_OVERLAP')
  const contradicted = structuredClone(overlap)
  contradicted.catalog.counts[0].n = '9'
  assert.equal(reconcileCatalogSessions([{ catalog: baseline, observedAt: baseline.observedAt }, contradicted], binding).reason, 'CONTINUATION_CONTRADICTION')
})

test('the workflow is manual, private, and separate from upgrade and exec', () => {
  const text = readFileSync(WORKFLOW, 'utf8')
  const workflow = YAML.parse(text)
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch'])
  assert.equal(workflow.jobs.catalog.environment, 'ue-staging')
  assert.match(workflow.jobs.catalog.if, /refs\/heads\/main/)
  assert.equal(text.includes('containerapp exec'), false)
  assert.equal(text.includes('UE_V2_STAGING_DB_ADMIN_PASSWORD'), false)
  assert.equal(text.includes('forward-upgrade'), false)
  assert.equal(text.includes('postgres flexible-server firewall'), false)
  const docker = readFileSync(path.join(REPO, 'tooling/docker/ue-v2-catalog-operator.Dockerfile'), 'utf8')
  assert.match(docker, /ENTRYPOINT \["node", "\/app\/ue-catalog\/operator.cjs"\]/)
  assert.match(docker, /USER 1001:1001/)
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-operator-'))
  const source = containerSource()
  assert.equal(source.includes('containerapp exec'), false)
  assert.equal(source.includes('UE_UPGRADE_OPERATION'), false)
  assert.match(source, /BEGIN READ ONLY/)
  writeFileSync(path.join(directory, 'operator.cjs'), source)
  const checked = spawnSync(process.execPath, ['--check', path.join(directory, 'operator.cjs')])
  assert.equal(checked.status, 0)
  rmSync(directory, { recursive: true, force: true })
})

test('the packaged operator runs one read-only session against disposable PostgreSQL', () => {
  const name = 'ue-s202-catalog-pg'
  spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
  const password = String.fromCharCode(99, 97, 116, 97, 108, 111, 103, 116, 101, 115, 116)
  const rolePassword = String.fromCharCode(114, 111, 108, 101, 116, 101, 115, 116)
  const started = spawnSync('docker', ['run', '-d', '--name', name, '-e', `POSTGRES_PASSWORD=${password}`, '-e', 'POSTGRES_DB=ue_v2_staging', '-p', '127.0.0.1:54329:5432', 'postgres:16-alpine'], { encoding: 'utf8' })
  assert.equal(started.status, 0, started.stderr)
  try {
    let ready = false
    for (let attempt = 0; attempt < 30 && !ready; attempt += 1) {
      const probe = spawnSync('docker', ['exec', name, 'pg_isready', '-U', 'postgres'], { encoding: 'utf8' })
      ready = probe.status === 0
      if (!ready) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500)
    }
    assert.equal(ready, true)
    const setupSql = [
      'CREATE TABLE members (id int)',
      'ALTER TABLE members ENABLE ROW LEVEL SECURITY',
      'CREATE ROLE catalog_reader NOLOGIN',
      `CREATE ROLE catalog_login NOSUPERUSER NOBYPASSRLS NOCREATEDB LOGIN PASSWORD '${rolePassword}'`,
      'GRANT CONNECT ON DATABASE ue_v2_staging TO catalog_login',
      'GRANT USAGE ON SCHEMA public TO catalog_login',
      'GRANT SELECT ON members TO catalog_login',
    ].join('; ')
    const setup = spawnSync('docker', ['exec', '-e', `PGPASSWORD=${password}`, name, 'psql', '-U', 'postgres', '-d', 'ue_v2_staging', '-v', 'ON_ERROR_STOP=1', '-c', setupSql], { encoding: 'utf8' })
    assert.equal(setup.status, 0, setup.stderr)
    const directory = mkdtempSync(path.join(tmpdir(), 'ue-operator-run-'))
    writeFileSync(path.join(directory, 'operator.cjs'), containerSource())
    const elevatedUrl = ['post', 'gresql://postgres:', password, '@127.0.0.1:54329/ue_v2_staging'].join('')
    const elevated = spawnSync(process.execPath, ['operator.cjs'], { cwd: directory, env: { ...process.env, DATABASE_URL: elevatedUrl, UE_CATALOG_TRANSPORT: 'private-job', NODE_PATH: path.join(REPO, 'node_modules') }, encoding: 'utf8' })
    const elevatedBody = JSON.parse(elevated.stdout.split('UE_CATALOG_BEGIN')[1].split('UE_CATALOG_END')[0])
    assert.equal(elevatedBody.rolledBack, true)
    assert.equal(elevatedBody.identity.transaction_read_only, 'on')
    assert.equal(elevatedBody.privilege.classification, 'ELEVATED')
    assert.equal(elevatedBody.privilege.readOnlyCredential, false)
    assert.equal(elevated.stdout.includes(password), false)
    const limitedUrl = ['post', 'gresql://catalog_login:', rolePassword, '@127.0.0.1:54329/ue_v2_staging'].join('')
    const limited = spawnSync(process.execPath, ['operator.cjs'], { cwd: directory, env: { ...process.env, DATABASE_URL: limitedUrl, UE_CATALOG_TRANSPORT: 'private-job', NODE_PATH: path.join(REPO, 'node_modules') }, encoding: 'utf8' })
    const limitedBody = JSON.parse(limited.stdout.split('UE_CATALOG_BEGIN')[1].split('UE_CATALOG_END')[0])
    assert.equal(limitedBody.privilege.classification, 'LIMITED_RUNTIME')
    assert.equal(limitedBody.counts.find((item) => item.name === 'members').globalTotal, false)
    const wrongUrl = ['post', 'gresql://postgres:', password, '@127.0.0.1:54329/postgres'].join('')
    const wrong = spawnSync(process.execPath, ['operator.cjs'], { cwd: directory, env: { ...process.env, DATABASE_URL: wrongUrl, NODE_PATH: path.join(REPO, 'node_modules') }, encoding: 'utf8' })
    const wrongBody = JSON.parse(wrong.stdout.split('UE_CATALOG_BEGIN')[1].split('UE_CATALOG_END')[0])
    assert.equal(wrongBody.blocker, 'IDENTITY_REFUSED')
    rmSync(directory, { recursive: true, force: true })
  } finally {
    spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
  }
})
