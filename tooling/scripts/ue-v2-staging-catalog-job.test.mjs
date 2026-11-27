import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash, randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  CATALOG_CONTRACT,
  CATALOG_SCHEMA,
  CONTAINER_NAME,
  EXPECTED_IMAGE,
  EXPECTED_REVISION,
  RESOURCE_GROUP,
  RUNTIME_LOGIN,
  RUNTIME_ROLE,
  SUBSCRIPTION_ID,
  TENANT_ID,
  buildContinuationToken,
  containerSource,
  continuationDefect,
  reconcileCatalogSessions,
} from './ue-v2-staging-catalog-exec.mjs'
import {
  ENVIRONMENT_ID,
  EVIDENCE_CHUNK_BYTES,
  EVIDENCE_MAX_BYTES,
  IDENTITY,
  JOB_OWNER,
  JOB_PURPOSE,
  LOG_PAGE_CHUNKS,
  OPERATOR_CONTAINER,
  STAGING_HOST,
  assertStagingTarget,
  cleanupForRun,
  cleanupOwnedJob,
  evidenceQuery,
  executeCatalogJob,
  frameCatalog,
  jobNameForRun,
  loadPriorSession,
  jobSpecification,
  operatorImageDefect,
  ownedJobDefect,
  reassembleCatalog,
  verifyImageSmoke,
  writeJobArtifacts,
} from './ue-v2-staging-catalog-job.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const require = createRequire(path.join(REPO, 'package.json'))
const YAML = require('yaml')
const WORKFLOW = path.join(REPO, '.github/workflows/ue-v2-staging-catalog-job.yml')
const IMAGE = `nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2-catalog@sha256:${'b'.repeat(64)}`
const SHA = 'c'.repeat(40)
const RUN = '45887919234'
const NAME = jobNameForRun(RUN)
const EXECUTION = `${NAME}-x7k2p`
const REPLICA = `${EXECUTION}-r9q4z`
const WORKSPACE = 'ce2ff61f-0059-46eb-b18b-a9be8162d009'

function query(id, rows) {
  return { id, rowCount: rows.length, rows }
}

function completeCatalog() {
  return {
    schema: CATALOG_SCHEMA,
    rolledBack: true,
    observedAt: '2026-11-26T20:00:00.000Z',
    readOnlyCredential: false,
    identity: { database: 'ue_v2_staging', user: RUNTIME_ROLE, session_user: RUNTIME_LOGIN, transaction_read_only: 'on', version: 'PostgreSQL 16.8' },
    privilege: { user: RUNTIME_ROLE, login: RUNTIME_LOGIN, classification: 'LIMITED_RUNTIME', readOnlyCredential: false, rolsuper: false, rolbypassrls: false },
    queries: [
      query('identity', [{ database: 'ue_v2_staging', user: RUNTIME_ROLE, session_user: RUNTIME_LOGIN, transaction_read_only: 'on' }]),
      query('migration_relations', []),
      query('migration_columns', []),
      query('drizzle_rows', []),
      query('roles', [{ rolname: RUNTIME_ROLE, rolsuper: false, rolbypassrls: false }]),
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

/** A realistic catalogue at the measured canonical scale (1,819 policies, 803 relations, 784 tables). */
function realisticCatalog() {
  const catalog = completeCatalog()
  const tables = Array.from({ length: 784 }, (_, index) => ({ schema: index < 40 ? 'user_management' : 'public', name: `table_${String(index).padStart(4, '0')}` }))
  const expression = "(( SELECT user_management.auth_business_org_authorized((NULLIF(current_setting('app.current_org_id'::text, true), ''::text))::uuid) AS auth_business_org_authorized) AND ((organization_id)::text = NULLIF(current_setting('app.current_org_id'::text, true), ''::text)))"
  catalog.queries = catalog.queries.map((item) => {
    if (item.id === 'tables') return query('tables', tables)
    if (item.id === 'relations') return query('relations', [...tables, ...tables.slice(0, 19)].map((table) => ({ ...table, relkind: 'r', owner: 'ue_v2_owner', relrowsecurity: true, relforcerowsecurity: true, acl: '{ue_v2_owner=arwdDxtm/ue_v2_owner,union_eyes_runtime=arwd/ue_v2_owner}' })))
    if (item.id === 'rls') return query('rls', tables.map((table) => ({ ...table, relrowsecurity: true, relforcerowsecurity: true })))
    if (item.id === 'policies') return query('policies', Array.from({ length: 1819 }, (_, index) => ({ ...tables[index % tables.length], polname: `ue_v2_policy_${index}`, polcmd: 'r', polpermissive: true, using_expr: expression, check_expr: expression })))
    return item
  })
  catalog.counts = tables.map((table) => ({ ...table, visibleToConnectedRole: true, globalTotal: false, classification: 'OBSERVED', n: '0' }))
  return catalog
}

function frameRows(body, overrides = {}) {
  return frameCatalog(typeof body === 'string' ? body : JSON.stringify(body), { runId: RUN, source: SHA, ...overrides.frame }).lines.map((line) => ({
    Log_s: line,
    ContainerJobName_s: overrides.job ?? NAME,
    ContainerName_s: overrides.container ?? OPERATOR_CONTAINER,
    ContainerImage_s: overrides.image ?? IMAGE,
    ContainerGroupName_s: overrides.replica ?? REPLICA,
    Stream_s: 'stdout',
  }))
}

function ownedJob(extra = {}) {
  return {
    name: NAME,
    tags: { purpose: JOB_PURPOSE, runId: RUN, source: SHA, owner: JOB_OWNER },
    identity: { type: 'UserAssigned', userAssignedIdentities: { [IDENTITY]: {} } },
    properties: { environmentId: ENVIRONMENT_ID, template: { containers: [{ name: OPERATOR_CONTAINER, image: IMAGE }] } },
    ...extra,
  }
}

function virtualClock(step, extra = {}) {
  let time = Date.parse('2026-11-27T02:00:00.000Z')
  return { now: () => time, sleep: async () => { time += step }, intervalMs: step, ingestIntervalMs: step, deadlineMs: step * 10, stopDeadlineMs: step * 3, ingestDeadlineMs: step * 10, ...extra }
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
  return { name: EXPECTED_REVISION, healthState: 'Healthy', trafficWeight: 100, containers: [{ name: CONTAINER_NAME, image: EXPECTED_IMAGE }] }
}

const quotedValues = (kql) => [...kql.matchAll(/'([^']*)'/g)].map((match) => match[1])

/**
 * Fake Azure: account, revision, environment log configuration, the job resource
 * through its lifecycle, executions, and a Log Analytics workspace whose rows
 * carry the real binding columns and become visible after an ingestion delay.
 */
function harness(options = {}) {
  const calls = []
  const specs = []
  const statuses = [...(options.statuses ?? [options.status ?? 'Succeeded'])]
  let statusIndex = 0
  let stopped = false
  let created = Boolean(options.preexisting)
  let deleted = false
  let deleteCalls = 0
  let headerPolls = 0
  let queryCalls = 0
  const rows = options.rows ?? (options.body === undefined ? frameRows(completeCatalog()) : options.body === null ? [] : frameRows(options.body))
  const visibleRows = () => (headerPolls > (options.ingestDelayPolls ?? 0) ? rows : [])
  const currentStatus = () => (stopped ? (options.afterStop ?? 'Stopped') : statuses[Math.min(statusIndex, statuses.length - 1)])
  const bound = (kql) => {
    const values = quotedValues(kql)
    return visibleRows().filter((row) => values.includes(row.ContainerJobName_s) && values.includes(row.ContainerName_s) && values.includes(row.ContainerImage_s) &&
      values.some((value) => value.endsWith('-') && row.ContainerGroupName_s.startsWith(value)) && row.Stream_s === 'stdout')
  }
  const spawn = async (executable, args) => {
    calls.push({ executable, args })
    const line = args.join(' ')
    if (line.includes('account show')) return { code: 0, stdout: JSON.stringify({ subscriptionId: options.subscriptionId ?? SUBSCRIPTION_ID, tenantId: options.tenantId ?? TENANT_ID }), stderr: '' }
    if (line.includes('revision show')) return { code: 0, stdout: JSON.stringify(options.revision ?? revision()), stderr: '' }
    if (line.includes('secrets[].name')) return { code: 0, stdout: JSON.stringify(options.secrets ?? ['database-url']), stderr: '' }
    if (line.includes('containerapp env show')) return { code: options.envCode ?? 0, stdout: JSON.stringify(options.logsConfig ?? { destination: 'log-analytics', logAnalyticsConfiguration: { customerId: WORKSPACE } }), stderr: '' }
    if (line.includes('job create')) {
      specs.push(JSON.parse(readFileSync(args[args.indexOf('--yaml') + 1], 'utf8')))
      if ((options.createCode ?? 0) === 0 || options.createShow === 'created') created = true
      return { code: options.createCode ?? 0, stdout: '', stderr: options.createError ?? '' }
    }
    if (line.includes('job start')) return { code: options.startCode ?? 0, stdout: options.startCode ? '' : `${EXECUTION}\n`, stderr: '' }
    if (line.includes('job stop')) { stopped = (options.stopCode ?? 0) === 0; return { code: options.stopCode ?? 0, stdout: '', stderr: '' } }
    if (line.includes('execution list')) {
      if (options.listCode) return { code: options.listCode, stdout: '', stderr: 'transient' }
      return { code: 0, stdout: JSON.stringify(options.startCode && !options.executionExists ? [] : [{ name: EXECUTION, status: currentStatus() }]), stderr: '' }
    }
    if (line.includes('execution show')) {
      if (Array.isArray(options.showCodes)) {
        const code = options.showCodes[statusIndex] ?? 0
        if (code !== 0) { statusIndex += 1; return { code, stdout: '', stderr: 'transient' } }
      }
      const status = currentStatus()
      if (!stopped) statusIndex += 1
      return { code: 0, stdout: `${status}\n`, stderr: '' }
    }
    if (line.includes('job delete')) {
      deleteCalls += 1
      const code = Array.isArray(options.deleteCodes) ? (options.deleteCodes[deleteCalls - 1] ?? 0) : (options.deleteCode ?? 0)
      if (code === 0 && !options.deleteNoop) deleted = true
      return { code, stdout: '', stderr: options.deleteError ?? '' }
    }
    if (line.includes('job show')) {
      if (options.createShow === 'ambiguous' && created === false) return { code: 1, stdout: '', stderr: 'network reset' }
      if (options.createShow === 'unowned' && line.includes(NAME) && calls.filter((c) => c.args.join(' ').includes('job create')).length) {
        return { code: 0, stdout: JSON.stringify({ name: NAME, tags: { purpose: 'cron' } }), stderr: '' }
      }
      if (deleted && options.afterDeleteShow === 'unreadable') return { code: 1, stdout: '', stderr: 'gateway timeout' }
      if (!created || deleted) return { code: 3, stdout: '', stderr: "(ResourceNotFound) The Resource 'Microsoft.App/jobs/x' was not found." }
      return { code: 0, stdout: JSON.stringify(options.jobShape ?? ownedJob()), stderr: '' }
    }
    if (line.includes('log-analytics query')) {
      queryCalls += 1
      const kql = args[args.indexOf('--analytics-query') + 1]
      if (Array.isArray(options.queryFailures) && options.queryFailures.includes(queryCalls)) return { code: 1, stdout: '', stderr: 'throttled' }
      if (kql.includes("not(Log_s startswith 'UE_CATALOG_V2 CHUNK ')")) {
        headerPolls += 1
        return { code: 0, stdout: JSON.stringify(bound(kql).filter((row) => !row.Log_s.startsWith('UE_CATALOG_V2 CHUNK ')).map(({ Log_s, ContainerGroupName_s }) => ({ Log_s, ContainerGroupName_s }))), stderr: '' }
      }
      const nonce = kql.match(/UE_CATALOG_V2 CHUNK ([a-f0-9]{32}) /)?.[1]
      const chunks = bound(kql).filter((row) => row.Log_s.startsWith(`UE_CATALOG_V2 CHUNK ${nonce} `)).map((row) => ({ ...row, i: Number(row.Log_s.split(' ')[3].split('/')[0]) }))
      if (kql.includes('summarize n = dcount(i)')) return { code: 0, stdout: JSON.stringify([{ n: new Set(chunks.map((row) => row.i)).size }]), stderr: '' }
      const range = kql.match(/between \((\d+) \.\. (\d+)\)/)
      const page = chunks.filter((row) => row.i >= Number(range[1]) && row.i <= Number(range[2]))
      if (page.length > LOG_PAGE_CHUNKS * 2) return { code: 1, stdout: '', stderr: 'response too large' }
      return { code: 0, stdout: JSON.stringify(page.reverse().map(({ Log_s, ContainerGroupName_s }) => ({ Log_s, ContainerGroupName_s }))), stderr: '' }
    }
    return { code: 1, stdout: '', stderr: `UNEXPECTED ${line}` }
  }
  return { calls, specs, spawn, did: (fragment) => calls.some((call) => call.args.join(' ').includes(fragment)), count: (fragment) => calls.filter((call) => call.args.join(' ').includes(fragment)).length }
}

const run = (options = {}, clock = virtualClock(1000)) => {
  const fake = harness(options)
  return executeCatalogJob(liveEnv(options.env), fake.spawn, { ...clock, prior: options.prior }).then((result) => ({ ...result, fake }))
}

// ── Targeting, ownership, specification ──────────────────────────────────────

test('staging targeting, image pinning, and exact job ownership fail closed', () => {
  assert.equal(assertStagingTarget({ resourceGroup: 'nzila-production-rg', database: 'ue_v2_production', host: 'prod.postgres.database.azure.com' }), 'WRONG_ENVIRONMENT')
  assert.equal(assertStagingTarget({ resourceGroup: RESOURCE_GROUP, database: 'ue_v2_staging', host: STAGING_HOST }), null)
  assert.equal(operatorImageDefect(EXPECTED_IMAGE), 'OPERATOR_IMAGE_UNQUALIFIED')
  assert.equal(operatorImageDefect('nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2-catalog:latest'), 'OPERATOR_IMAGE_UNQUALIFIED')
  assert.equal(operatorImageDefect(IMAGE), null)
  const expected = { name: NAME, runId: RUN, source: SHA, image: IMAGE }
  assert.equal(ownedJobDefect(ownedJob(), expected), null)
  for (const forged of [
    { name: 'ue-v2-forward-1' },
    { tags: { purpose: JOB_PURPOSE, runId: RUN, source: SHA } },
    { tags: { purpose: JOB_PURPOSE, runId: '1', source: SHA, owner: JOB_OWNER } },
    { properties: { environmentId: ENVIRONMENT_ID.replace('staging', 'prod'), template: { containers: [{ name: OPERATOR_CONTAINER, image: IMAGE }] } } },
    { properties: { environmentId: ENVIRONMENT_ID, template: { containers: [{ name: OPERATOR_CONTAINER, image: EXPECTED_IMAGE }] } } },
    { properties: { environmentId: ENVIRONMENT_ID, template: { containers: [{ name: OPERATOR_CONTAINER, image: IMAGE }, { name: 'sidecar', image: IMAGE }] } } },
    { identity: { type: 'UserAssigned', userAssignedIdentities: { '/subscriptions/x/other': {} } } },
  ]) assert.equal(ownedJobDefect(ownedJob(forged), expected), 'UNOWNED_JOB', JSON.stringify(forged))
  const spec = jobSpecification({ image: IMAGE, runId: RUN, source: SHA })
  const serialized = JSON.stringify(spec)
  assert.equal(serialized.includes('containerapp exec'), false)
  assert.equal(serialized.includes('PGPASSWORD'), false)
  assert.equal(/postgres(?:ql)?:\/\//i.test(serialized), false)
  assert.equal(spec.properties.template.containers[0].env.some((item) => item.secretRef === 'database-url'), true)
  assert.equal(spec.properties.template.containers[0].env.find((item) => item.name === 'UE_CATALOG_SOURCE_SHA').value, SHA)
  assert.equal(ownedJobDefect({ ...spec, properties: { ...spec.properties } }, expected), null, 'the created specification is itself owned')
})

// ── Frame v2 transport ───────────────────────────────────────────────────────

test('the v2 frame round-trips the measured catalogue scale and far beyond, byte for byte', () => {
  const realistic = JSON.stringify(realisticCatalog())
  assert.ok(Buffer.byteLength(realistic) > 1_300_000, `realistic catalogue is ${Buffer.byteLength(realistic)} bytes`)
  for (const body of [realistic, `{"pad":"${'é漢🙂'.repeat(5000)}"}`, JSON.stringify({ pad: randomBytes(12 * 1024 * 1024).toString('hex') })]) {
    const framed = frameCatalog(body, { runId: RUN, source: SHA })
    assert.equal(framed.overflow, false)
    for (const line of framed.lines) assert.ok(line.length < 16384, `line of ${line.length} characters would be split by the container log driver`)
    const shuffled = [...framed.lines].sort(() => Math.random() - 0.5)
    const result = reassembleCatalog([...shuffled, ...framed.lines.slice(1, 4)], { runId: RUN, source: SHA })
    assert.equal(result.ok, true, result.defect)
    assert.equal(result.body, body)
    assert.equal(result.sha256, createHash('sha256').update(Buffer.from(body, 'utf8')).digest('hex'))
    assert.equal(result.duplicates, 3)
  }
})

test('the v2 frame refuses missing, conflicting, mixed, rebound, malformed, and oversize evidence', () => {
  const body = JSON.stringify(realisticCatalog())
  const framed = frameCatalog(body, { runId: RUN, source: SHA })
  const lines = framed.lines
  const missing = reassembleCatalog(lines.filter((_, index) => index !== 7), { runId: RUN, source: SHA })
  assert.equal(missing.defect, 'EVIDENCE_MISSING')
  assert.deepEqual(missing.missing, [7])
  assert.equal(reassembleCatalog(lines.slice(0, -1), { runId: RUN, source: SHA }).defect, 'EVIDENCE_MISSING')
  assert.equal(reassembleCatalog(lines.slice(1), { runId: RUN, source: SHA }).defect, 'EVIDENCE_MISSING')
  const conflicting = lines[3].slice(0, -8) + (lines[3].endsWith('AAAAAAAA') ? 'BBBBBBBB' : 'AAAAAAAA')
  assert.equal(reassembleCatalog([...lines, conflicting], { runId: RUN, source: SHA }).defect, 'EVIDENCE_CONFLICT')
  const other = frameCatalog(body, { runId: RUN, source: SHA, nonce: 'f'.repeat(32) }).lines
  assert.equal(reassembleCatalog([...lines, ...other], { runId: RUN, source: SHA }).defect, 'EVIDENCE_AMBIGUOUS')
  assert.equal(reassembleCatalog(lines, { runId: '1', source: SHA }).defect, 'EVIDENCE_BINDING_MISMATCH')
  assert.equal(reassembleCatalog(lines, { runId: RUN, source: 'd'.repeat(40) }).defect, 'EVIDENCE_BINDING_MISMATCH')
  const tampered = [...lines]
  const parts = tampered[2].split(' ')
  const payload = Buffer.from(parts[4], 'base64')
  payload[10] ^= 1
  parts[4] = payload.toString('base64')
  tampered[2] = parts.join(' ')
  assert.equal(reassembleCatalog(tampered, { runId: RUN, source: SHA }).defect, 'EVIDENCE_HASH_MISMATCH')
  const short = [...lines]
  const shortParts = short[2].split(' ')
  shortParts[4] = shortParts[4].slice(0, -4)
  short[2] = shortParts.join(' ')
  assert.equal(reassembleCatalog(short, { runId: RUN, source: SHA }).defect, 'EVIDENCE_MALFORMED')
  assert.equal(reassembleCatalog([...lines, 'UE_CATALOG_V2 BEGIN garbage'], { runId: RUN, source: SHA }).defect, 'EVIDENCE_MALFORMED')
  const overflow = frameCatalog('y'.repeat(EVIDENCE_MAX_BYTES + 1), { runId: RUN, source: SHA })
  assert.equal(overflow.overflow, true)
  assert.equal(overflow.lines.length, 1)
  assert.equal(reassembleCatalog(overflow.lines).defect, 'EVIDENCE_TRANSPORT_EXCEEDED')
})

// ── End-to-end controller over the fake Azure ────────────────────────────────

test('a complete run retrieves the full catalogue through Log Analytics and deletes only its own job', async () => {
  const text = readFileSync(new URL('./ue-v2-staging-catalog-job.mjs', import.meta.url), 'utf8')
  assert.equal(text.includes("'exec'"), false)
  assert.equal(text.includes('exec/action'), false)
  const { exitCode, report, fake } = await run({ body: realisticCatalog() })
  assert.equal(exitCode, 0, JSON.stringify(report.defects))
  assert.equal(report.verdict, 'CATALOG_COMPLETE')
  assert.equal(report.catalogAccepted, true)
  assert.equal(report.S2_02_PREIMAGE_COMPLETE, 'NO')
  assert.equal(fake.did('logs show'), false, 'the replica log-stream proxy is never used')
  assert.ok(fake.count('log-analytics query') >= 3)
  assert.equal(report.evidence.chunks, Math.ceil(Buffer.byteLength(JSON.stringify(realisticCatalog())) / EVIDENCE_CHUNK_BYTES))
  assert.equal(report.evidence.replica, REPLICA)
  assert.equal(report.cleanup.deleted, true)
  assert.equal(report.phases.delete, 'DONE')
  const manifest = report.manifest
  assert.equal(manifest.categoryInventory.required, CATALOG_CONTRACT.categories.length)
  assert.equal(manifest.categoryInventory.accepted, CATALOG_CONTRACT.categories.length)
  assert.equal(manifest.sha256, report.evidenceSha256)
  assert.equal(manifest.operatorImage, IMAGE)
  assert.deepEqual(manifest.execution, { githubRunId: RUN, sourceSha: SHA, job: NAME, execution: EXECUTION, replica: REPLICA })
  assert.equal(manifest.observedIdentity.role, RUNTIME_ROLE)
  assert.equal(manifest.observedIdentity.login, RUNTIME_LOGIN)
  assert.equal(manifest.counts.observed, 784)
  for (const call of fake.calls.filter((item) => item.args.join(' ').includes('log-analytics query'))) {
    const kql = call.args[call.args.indexOf('--analytics-query') + 1]
    for (const binding of [NAME, OPERATOR_CONTAINER, IMAGE, `${EXECUTION}-`]) assert.ok(kql.includes(`'${binding}'`), `query not bound to ${binding}`)
  }
})

test('ingestion delay and transient query failures are waited out; a never-ingested frame is not a catalogue', async () => {
  const delayed = await run({ body: realisticCatalog(), ingestDelayPolls: 4, queryFailures: [2, 7] })
  assert.equal(delayed.exitCode, 0, JSON.stringify(delayed.report.defects))
  assert.ok(delayed.report.evidence.polls >= 5)
  const never = await run({ body: null })
  assert.equal(never.report.defects.includes('EVIDENCE_MISSING'), true)
  assert.equal(never.report.catalogAccepted, false)
  assert.equal(never.report.cleanup.deleted, true, 'a finished job is still cleaned up when evidence is missing')
  const truncated = frameRows(realisticCatalog()).filter((_, index) => index !== 20)
  const partial = await run({ rows: truncated })
  assert.equal(partial.report.defects.includes('EVIDENCE_MISSING'), true)
  assert.equal(partial.report.catalog, null)
})

test('only lines bound to this job, execution, container and image count as evidence', async () => {
  const foreign = [
    ...frameRows(completeCatalog(), { image: EXPECTED_IMAGE }),
    ...frameRows(completeCatalog(), { job: 'nzila-ue-v2-stagin-basops' }),
    ...frameRows(completeCatalog(), { replica: `${NAME}-other-r1` }),
    ...frameRows(completeCatalog(), { container: 'union-eyes' }),
  ]
  const ignored = await run({ rows: foreign })
  assert.equal(ignored.report.defects.includes('EVIDENCE_MISSING'), true)
  const twoReplicas = [...frameRows(completeCatalog()), ...frameRows(completeCatalog(), { replica: `${EXECUTION}-second`, frame: { nonce: 'e'.repeat(32) } })]
  const ambiguous = await run({ rows: twoReplicas })
  assert.equal(ambiguous.report.defects.includes('EVIDENCE_AMBIGUOUS'), true)
  const rebound = await run({ rows: frameRows(completeCatalog(), { frame: { runId: '999' } }) })
  assert.equal(rebound.report.defects.includes('EVIDENCE_BINDING_MISMATCH'), true)
  const overflow = frameCatalog('y'.repeat(EVIDENCE_MAX_BYTES + 1), { runId: RUN, source: SHA }).lines.map((Log_s) => ({ ...frameRows('{}')[0], Log_s }))
  const exceeded = await run({ rows: overflow })
  assert.equal(exceeded.report.defects.includes('EVIDENCE_TRANSPORT_EXCEEDED'), true)
  const channel = await run({ logsConfig: { destination: 'azure-monitor' } })
  assert.equal(channel.report.defects.includes('EVIDENCE_CHANNEL_UNAVAILABLE'), true)
  assert.equal(channel.fake.did('job create'), false, 'no job is created when the evidence channel is unavailable')
})

test('the job identity, role and read-only session are verified from the evidence itself', async () => {
  const login = completeCatalog()
  login.identity.user = RUNTIME_LOGIN
  assert.equal((await run({ body: login })).report.defects.includes('DATABASE_IDENTITY_REFUSED'), true)
  const otherLogin = completeCatalog()
  otherLogin.identity.session_user = 'uev2admin'
  assert.equal((await run({ body: otherLogin })).report.defects.includes('DATABASE_IDENTITY_REFUSED'), true)
  const writable = completeCatalog()
  writable.rolledBack = false
  assert.equal((await run({ body: writable })).report.defects.includes('READ_ONLY_TRANSACTION_UNPROVEN'), true)
  const absentUrl = { ...completeCatalog(), blocker: 'DATABASE_URL_ABSENT' }
  assert.equal((await run({ body: absentUrl })).report.catalogAccepted, false)
  const partial = completeCatalog()
  partial.counts[0] = { ...partial.counts[0], classification: 'NOT_ATTEMPTED', n: null }
  const partialRun = await run({ body: partial })
  assert.equal(partialRun.report.verdict, 'CATALOG_PARTIAL')
  assert.equal(partialRun.report.catalogAccepted, false)
  assert.equal(partialRun.report.manifest.counts.notAttempted, 1)
})

// ── Asynchronous lifecycle ───────────────────────────────────────────────────

test('observation waits through Pending and Running and tolerates unread status', async () => {
  const sequence = await run({ statuses: ['Pending', 'Pending', 'Running', 'Running', 'Succeeded'] })
  assert.equal(sequence.exitCode, 0)
  assert.deepEqual(sequence.report.executionObservations.map((item) => item.status), ['Pending', 'Pending', 'Running', 'Running', 'Succeeded'])
  assert.equal(sequence.fake.did('job stop'), false)
  const unread = await run({ showCodes: [1, 1, 0] })
  assert.equal(unread.exitCode, 0)
  assert.equal(unread.report.executionObservations.filter((item) => item.status === 'UNREAD').length, 2)
})

test('a failed, stopped, or unterminated execution never yields a successful verdict', async () => {
  const failed = await run({ status: 'Failed' })
  assert.equal(failed.exitCode, 5)
  assert.equal(failed.report.defects.includes('JOB_EXECUTION_FAILED'), true)
  assert.equal(failed.report.catalogAccepted, false)
  assert.equal(failed.report.catalog.schema, CATALOG_SCHEMA, 'evidence is still captured for diagnosis')
  const stopped = await run({ statuses: ['Running'] })
  assert.equal(stopped.report.executionStatus, 'Stopped')
  assert.equal(stopped.exitCode, 5)
  assert.equal(stopped.report.catalogAccepted, false)
  assert.equal(stopped.report.cleanup.deleted, true)
  const held = await run({ statuses: ['Running'], stopCode: 1 })
  assert.equal(held.report.defects.includes('JOB_EXECUTION_TIMED_OUT'), true)
  assert.equal(held.report.defects.includes('JOB_CLEANUP_UNPROVEN'), true)
  assert.equal(held.report.phases.delete, 'HELD')
  assert.equal(held.fake.did('job delete'), false)
  assert.match(held.report.cleanup.incident.action, /delete only this owned job/)
  const lateTermination = await run({ statuses: ['Running'], afterStop: 'Running' })
  assert.equal(lateTermination.fake.did('job delete'), false)
  assert.equal(lateTermination.report.phases.delete, 'HELD')
})

test('creation is reconciled exactly: conflicts, ambiguous responses, and partial creation', async () => {
  const conflict = await run({ preexisting: true })
  assert.equal(conflict.report.defects.includes('JOB_NAME_CONFLICT'), true)
  assert.equal(conflict.fake.did('job create'), false)
  assert.equal(conflict.fake.did('job delete'), false)
  const marker = String.fromCharCode(109, 97, 114, 107, 101, 114, 45, 97, 108, 112, 104, 97)
  const secret = ['post', 'gresql://ue:', marker, '@db/ue_v2_staging'].join('')
  const partial = await run({ createCode: 1, createShow: 'created', createError: secret })
  assert.equal(partial.report.defects.includes('JOB_CREATION_FAILED'), true)
  assert.equal(partial.fake.did('job delete'), true, 'a job created despite an error response is cleaned up')
  assert.equal(partial.report.cleanup.deleted, true)
  assert.equal(JSON.stringify(partial.report).includes(marker), false)
  const absent = await run({ createCode: 1 })
  assert.equal(absent.report.defects.includes('JOB_CREATION_FAILED'), true)
  assert.equal(absent.fake.did('job delete'), false)
  const ambiguous = await run({ createCode: 1, createShow: 'ambiguous' })
  assert.equal(ambiguous.report.defects.includes('JOB_CLEANUP_UNPROVEN') || ambiguous.report.defects.includes('JOB_STATE_UNREADABLE'), true)
  assert.equal(ambiguous.fake.did('job delete'), false)
  const foreign = await run({ createCode: 1, createShow: 'unowned' })
  assert.equal(foreign.report.defects.includes('JOB_NAME_CONFLICT'), true)
  assert.equal(foreign.fake.did('job delete'), false)
  const notStarted = await run({ startCode: 1 })
  assert.equal(notStarted.report.defects.includes('JOB_EXECUTION_FAILED'), true)
  assert.equal(notStarted.report.cleanup.deleted, true)
  const startedAnyway = await run({ startCode: 1, executionExists: true, statuses: ['Running'] })
  assert.equal(startedAnyway.fake.did('job stop'), true, 'an execution started despite an error is stopped before deletion')
  assert.equal(startedAnyway.report.cleanup.deleted, true)
})

test('cleanup overrides success, retries deletion, and requires explicit proof of absence', async () => {
  const failing = await run({ deleteCode: 1, deleteNoop: true })
  assert.equal(failing.exitCode, 6)
  assert.equal(failing.report.catalogAccepted, false)
  assert.equal(failing.report.defects.includes('JOB_CLEANUP_FAILED'), true)
  assert.equal(failing.fake.count('job delete'), 3)
  const retried = await run({ deleteCodes: [1, 0] })
  assert.equal(retried.exitCode, 0)
  assert.equal(retried.report.cleanup.attempts, 2)
  const unproven = await run({ afterDeleteShow: 'unreadable' })
  assert.equal(unproven.report.cleanup.deleted, false)
  assert.equal(unproven.report.defects.includes('JOB_CLEANUP_UNPROVEN'), true)
  assert.equal(unproven.exitCode, 6)
  const unownedClean = await cleanupOwnedJob(async () => ({ code: 0, stdout: JSON.stringify({ name: 'scheduled-dues', tags: { purpose: 'cron' } }), stderr: '' }), { name: NAME, runId: RUN, source: SHA, image: IMAGE }, virtualClock(10))
  assert.equal(unownedClean.deleted, false)
  assert.equal(unownedClean.reason, 'UNOWNED_JOB')
  const listUnreadable = await run({ listCode: 1 })
  assert.equal(listUnreadable.report.cleanup.deleted, false)
  assert.equal(listUnreadable.report.cleanup.reason, 'EXECUTIONS_UNREADABLE')
})

test('interrupted runs: cleanup-only removes only this run\'s owned job after settling it', async () => {
  const live = harness({ preexisting: true, statuses: ['Running'] })
  const receipt = await cleanupForRun(liveEnv(), live.spawn, virtualClock(10))
  assert.equal(receipt.deleted, true)
  assert.equal(live.did('job stop'), true)
  const gone = await cleanupForRun(liveEnv(), harness().spawn, virtualClock(10))
  assert.equal(gone.deleted, true)
  assert.equal(gone.absent, true)
  const foreign = harness({ preexisting: true, jobShape: ownedJob({ tags: { purpose: JOB_PURPOSE, runId: '1', source: SHA, owner: JOB_OWNER } }) })
  const refused = await cleanupForRun(liveEnv(), foreign.spawn, virtualClock(10))
  assert.equal(refused.deleted, false)
  assert.equal(foreign.did('job delete'), false)
})

test('production or unapproved contexts never reach Azure', async () => {
  const azure = async () => { throw new Error('AZURE_CALLED') }
  const production = await executeCatalogJob(liveEnv({ UE_CATALOG_TARGET: JSON.stringify({ resourceGroup: 'nzila-production-rg', database: 'ue_v2_production', host: 'prod.postgres.database.azure.com' }) }), azure)
  assert.equal(production.report.defects.includes('WRONG_ENVIRONMENT'), true)
  assert.equal((await executeCatalogJob(liveEnv({ GITHUB_REF: 'refs/heads/feature' }), azure)).report.defects.includes('WRONG_ENVIRONMENT'), true)
  assert.equal((await executeCatalogJob(liveEnv({ UE_CATALOG_JOB_LIVE: '0' }), azure)).report.defects.includes('WRONG_ENVIRONMENT'), true)
  assert.equal((await run({ subscriptionId: 'other' })).report.defects.includes('WRONG_SUBSCRIPTION'), true)
  assert.equal((await run({ secrets: [] })).report.defects.includes('RUNTIME_SECRET_UNAVAILABLE'), true)
  assert.equal((await run({ revision: { ...revision(), containers: [{ name: CONTAINER_NAME, image: IMAGE }] } })).report.defects.includes('REVISION_BINDING_CHANGED'), true)
})

// ── Receipts, continuation, workflow ─────────────────────────────────────────

test('artifacts keep the exact evidence bytes and a failed run still writes its receipt', async () => {
  const { report } = await run({ body: realisticCatalog() })
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-catalog-artifacts-'))
  writeJobArtifacts(directory, report)
  const evidence = readFileSync(path.join(directory, 'catalog-evidence.json'))
  assert.equal(createHash('sha256').update(evidence).digest('hex'), report.evidenceSha256)
  assert.match(readFileSync(path.join(directory, 'SHA256SUMS'), 'utf8'), new RegExp(`${report.evidenceSha256}  catalog-evidence.json`))
  assert.equal(JSON.parse(readFileSync(path.join(directory, 'evidence-manifest.json'), 'utf8')).sha256, report.evidenceSha256)
  assert.equal('evidenceBody' in JSON.parse(readFileSync(path.join(directory, 'catalog.json'), 'utf8')), false)
  rmSync(directory, { recursive: true, force: true })
  const failedDirectory = mkdtempSync(path.join(tmpdir(), 'ue-catalog-out-'))
  const result = spawnSync(process.execPath, [path.join(REPO, 'tooling/scripts/ue-v2-staging-catalog-job.mjs'), '--out', failedDirectory], { env: { ...process.env, UE_CATALOG_JOB_LIVE: '0' }, encoding: 'utf8' })
  assert.notEqual(result.status, 0)
  const receipt = JSON.parse(readFileSync(path.join(failedDirectory, 'catalog.json'), 'utf8'))
  assert.equal(receipt.defects.includes('WRONG_ENVIRONMENT'), true)
  assert.equal(receipt.S2_02_PREIMAGE_COMPLETE, 'NO')
  rmSync(failedDirectory, { recursive: true, force: true })
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
  assert.equal(continuationDefect(token, { ...binding, revision: 'other' }, Date.parse('2026-11-26T21:00:00.000Z')), 'REVISION_BINDING_CHANGED')
  const continuation = {
    observedAt: '2026-11-26T21:00:00.000Z',
    token,
    now: Date.parse('2026-11-26T21:00:00.000Z'),
    catalog: { queries: [query('tables', tables)], counts: [{ schema: 'public', name: 't250', visibleToConnectedRole: true, globalTotal: false, classification: 'OBSERVED', n: '0' }] },
  }
  assert.equal(reconcileCatalogSessions([{ catalog: baseline, observedAt: baseline.observedAt }, continuation], binding).verdict, 'CATALOG_COMPLETE')
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

test('the workflow is manual, private, smoke-tests the real image, and always cleans up', () => {
  const text = readFileSync(WORKFLOW, 'utf8')
  const workflow = YAML.parse(text)
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch'])
  assert.equal(workflow.jobs.catalog.environment, 'ue-staging')
  assert.match(workflow.jobs.catalog.if, /refs\/heads\/main/)
  assert.equal(text.includes('containerapp exec'), false)
  assert.equal(text.includes('logs show'), false)
  assert.equal(text.includes('UE_V2_STAGING_DB_ADMIN_PASSWORD'), false)
  assert.equal(text.includes('forward-upgrade'), false)
  assert.equal(text.includes('postgres flexible-server firewall'), false)
  assert.ok(text.indexOf('--verify-image-smoke') > 0 && text.indexOf('--verify-image-smoke') < text.indexOf('docker push'), 'the real image is smoke-tested before it is pushed')
  const cleanup = workflow.jobs.catalog.steps.find((step) => String(step.run ?? '').includes('--cleanup-only'))
  assert.ok(cleanup, 'an always() cleanup step exists for interrupted runs')
  assert.match(String(cleanup.if), /always\(\)/)
  assert.ok(workflow.jobs.catalog['timeout-minutes'] >= 30)
  const docker = readFileSync(path.join(REPO, 'tooling/docker/ue-v2-catalog-operator.Dockerfile'), 'utf8')
  assert.match(docker, /ENTRYPOINT \["node", "\/app\/ue-catalog\/operator.cjs"\]/)
  assert.match(docker, /USER 1001:1001/)
  const source = containerSource()
  assert.equal(source.includes('containerapp exec'), false)
  assert.equal(source.includes('UE_UPGRADE_OPERATION'), false)
  assert.match(source, /BEGIN READ ONLY/)
  assert.match(source, /-c role=/)
  assert.equal(/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE|GRANT|REVOKE)\s/.test(source.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""')), false, 'the operator issues no write or DDL statement')
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-operator-'))
  writeFileSync(path.join(directory, 'operator.cjs'), source)
  assert.equal(spawnSync(process.execPath, ['--check', path.join(directory, 'operator.cjs')]).status, 0)
  rmSync(directory, { recursive: true, force: true })
})

test('the image smoke accepts only the real entrypoint resolving pg as uid 1001', () => {
  const runtime = { uid: 1001, node: 'v22', entry: '/app/ue-catalog/operator.cjs', pgPath: '/app/node_modules/pg/lib/index.js', pgVersion: '8.20.0' }
  const smoke = (body) => frameCatalog(JSON.stringify(body), { runId: RUN, source: SHA }).lines.join('\n')
  const good = { schema: CATALOG_SCHEMA, client: { resolved: true }, runtime, blocker: 'DATABASE_URL_ABSENT' }
  assert.equal(verifyImageSmoke(smoke(good), { runId: RUN, source: SHA }).ok, true)
  for (const bad of [
    { ...good, client: { resolved: false }, blocker: 'NO_IN_CONTAINER_PG_CLIENT' },
    { ...good, runtime: { ...runtime, uid: 0 } },
    { ...good, runtime: { ...runtime, pgPath: '/root/.node_modules/pg/lib/index.js' } },
    { ...good, runtime: { ...runtime, entry: '/app/server.js' } },
    { ...good, blocker: 'QUERY_FAILED' },
  ]) assert.equal(verifyImageSmoke(smoke(bad), { runId: RUN, source: SHA }).ok, false, JSON.stringify(bad))
  assert.equal(verifyImageSmoke('no frame', { runId: RUN, source: SHA }).ok, false)
})

test('evidence queries refuse values that could escape the KQL string literal', () => {
  const binding = { name: NAME, execution: EXECUTION, image: IMAGE, since: '2026-11-27T00:00:00.000Z' }
  assert.match(evidenceQuery(binding, '| take 1'), /ContainerJobName_s == 'ue-s202-cat-45887919234'/)
  assert.throws(() => evidenceQuery({ ...binding, name: "x' or 1==1 //" }, ''), /KQL_VALUE_REFUSED/)
  assert.throws(() => evidenceQuery({ ...binding, since: 'not a date' }, ''), /KQL_VALUE_REFUSED/)
})

test('continuation sessions chain through hash-verified artifacts to one complete catalogue', async () => {
  const tables = Array.from({ length: 260 }, (_, index) => ({ schema: 'public', name: `t${String(index).padStart(3, '0')}` }))
  const baseline = completeCatalog()
  baseline.queries = baseline.queries.map((item) => item.id === 'tables' ? query('tables', tables) : item)
  baseline.counts = tables.map((table, index) => ({ ...table, visibleToConnectedRole: true, globalTotal: false, classification: index < 250 ? 'OBSERVED' : 'NOT_ATTEMPTED', n: index < 250 ? '0' : null }))
  const first = await run({ body: baseline })
  assert.equal(first.report.verdict, 'CATALOG_PARTIAL')
  assert.equal(first.report.catalogAccepted, false)
  assert.equal(first.report.continuationToken.remaining.length, 10)
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-catalog-chain-'))
  writeJobArtifacts(directory, first.report)
  const prior = loadPriorSession(directory)
  assert.equal(prior.defect, undefined)
  assert.equal(prior.token.remaining.length, 10)

  const continuation = {
    schema: CATALOG_SCHEMA, rolledBack: true, observedAt: '2026-11-27T03:00:00.000Z', sessionKind: 'continuation',
    identity: { database: 'ue_v2_staging', user: RUNTIME_ROLE, session_user: RUNTIME_LOGIN, transaction_read_only: 'on' },
    queries: [query('identity', [{ database: 'ue_v2_staging', user: RUNTIME_ROLE, session_user: RUNTIME_LOGIN, transaction_read_only: 'on' }]), query('tables', tables)],
    counts: tables.slice(250).map((table) => ({ ...table, visibleToConnectedRole: true, globalTotal: false, classification: 'OBSERVED', n: '0' })),
  }
  const second = await run({ body: continuation, prior })
  assert.equal(second.exitCode, 0, JSON.stringify(second.report.defects))
  assert.equal(second.report.verdict, 'CATALOG_COMPLETE')
  assert.equal(second.report.catalogAccepted, true)
  assert.equal(second.report.continuationToken, null)
  assert.deepEqual(second.report.mergedCatalog.sessions, [baseline.observedAt, continuation.observedAt])
  const env = second.fake.specs[0].properties.template.containers[0].env
  const sent = JSON.parse(env.find((item) => item.name === 'UE_CATALOG_CONTINUATION').value)
  assert.equal(sent.remaining.length, 10)
  assert.equal('completed' in sent, false, 'only the remaining tables travel to the job')
  assert.equal(sent.inventoryDigest, prior.token.inventoryDigest)
  assert.equal(first.fake.specs[0].properties.template.containers[0].env.some((item) => item.name === 'UE_CATALOG_CONTINUATION'), false)

  const tamperedDir = mkdtempSync(path.join(tmpdir(), 'ue-catalog-chain-tampered-'))
  writeJobArtifacts(tamperedDir, first.report)
  const tokenFile = path.join(tamperedDir, 'continuation-token.json')
  writeFileSync(tokenFile, readFileSync(tokenFile, 'utf8').replace('"t250"', '"t000"'))
  const tampered = await run({ body: continuation, prior: loadPriorSession(tamperedDir) })
  assert.equal(tampered.report.defects.includes('CONTINUATION_REJECTED'), true)
  assert.equal(tampered.fake.did('job create'), false)

  const expired = await run({ body: continuation, prior: { ...prior, token: { ...prior.token, expiresAt: '2026-11-26T00:00:00.000Z' } } })
  assert.equal(expired.report.defects.includes('CONTINUATION_EXPIRED'), true)
  assert.equal(expired.fake.did('job create'), false)
  const moved = await run({ body: continuation, prior: { ...prior, token: { ...prior.token, revision: 'nzila-ue-v2-staging-app--relother' } } })
  assert.equal(moved.report.defects.includes('REVISION_BINDING_CHANGED'), true)

  const drifted = structuredClone(continuation)
  drifted.queries[1].rows.push({ schema: 'public', name: 'new_table' })
  const drift = await run({ body: drifted, prior })
  assert.equal(drift.report.defects.includes('SCHEMA_DRIFT'), true)
  assert.equal(drift.report.catalogAccepted, false)
  const overlap = structuredClone(continuation)
  overlap.counts.push({ schema: 'public', name: 't000', visibleToConnectedRole: true, globalTotal: false, classification: 'OBSERVED', n: '5' })
  assert.equal((await run({ body: overlap, prior })).report.defects.includes('CONTINUATION_CONTRADICTION'), true)
  rmSync(directory, { recursive: true, force: true })
  rmSync(tamperedDir, { recursive: true, force: true })
})
