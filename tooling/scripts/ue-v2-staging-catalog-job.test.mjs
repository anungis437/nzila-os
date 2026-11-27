import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
  AZ_LOG_TAIL_MAX,
  EVIDENCE_CHUNK_CHARS,
  EVIDENCE_LINE_BUDGET,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_TAIL_LINES,
  LOG_STDOUT_MAX_BYTES,
  cleanupOwnedJob,
  executeCatalogJob,
  frameCatalog,
  launch,
  jobNameForRun,
  jobSpecification,
  operatorImageDefect,
  ownedJobDefect,
  reassembleCatalog,
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
  const framed = frameCatalog(JSON.stringify(body))
  if (!digestOverride) return framed.text
  return framed.text.replaceAll(framed.digest, digestOverride)
}

function virtualClock(step) {
  let time = 0
  return {
    now: () => time,
    sleep: async () => { time += step },
    intervalMs: step,
    deadlineMs: step,
    stopDeadlineMs: step,
  }
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
  const statuses = [...(options.statuses ?? [options.status ?? 'Succeeded'])]
  let statusIndex = 0
  let stopped = false
  let deleted = false
  const owned = { name: jobNameForRun(RUN), tags: { purpose: JOB_PURPOSE, runId: RUN, source: SHA } }
  const spawn = async (executable, args) => {
    calls.push({ executable, args })
    const line = args.join(' ')
    if (line.includes('account show')) return { code: 0, stdout: JSON.stringify({ subscriptionId: options.subscriptionId ?? SUBSCRIPTION_ID, tenantId: options.tenantId ?? TENANT_ID }), stderr: '' }
    if (line.includes('revision show')) return { code: 0, stdout: JSON.stringify(options.revision ?? revision()), stderr: '' }
    if (line.includes('secrets[].name')) return { code: 0, stdout: JSON.stringify(options.secrets ?? ['database-url']), stderr: '' }
    if (line.includes('job create')) return { code: options.createCode ?? 0, stdout: '', stderr: options.createError ?? '' }
    if (line.includes('job start')) return { code: options.startCode ?? 0, stdout: `${jobNameForRun(RUN)}-exec\n`, stderr: '' }
    if (line.includes('job stop')) {
      stopped = true
      return { code: options.stopCode ?? 0, stdout: '', stderr: options.stopError ?? '' }
    }
    if (line.includes('execution show')) {
      if (Array.isArray(options.showCodes)) {
        const code = options.showCodes[statusIndex] ?? 0
        if (code !== 0) {
          statusIndex += 1
          return { code, stdout: '', stderr: 'transient' }
        }
      }
      const status = stopped ? (options.afterStop ?? 'Stopped') : statuses[Math.min(statusIndex, statuses.length - 1)]
      if (!stopped) statusIndex += 1
      return { code: 0, stdout: `${status}\n`, stderr: '' }
    }
    if (line.includes('logs show')) return { code: 0, stdout: options.logs ?? '', stderr: options.logError ?? '' }
    if (line.includes('job delete')) {
      deleted = true
      return { code: options.deleteCode ?? 0, stdout: '', stderr: options.deleteError ?? '' }
    }
    if (line.includes('job show')) {
      if (options.createCode && calls.filter((call) => call.args.join(' ').includes('job show')).length === 1 && options.createShow) {
        if (options.createShow === 'absent') return { code: 3, stdout: '', stderr: 'ResourceNotFound' }
        if (options.createShow === 'ambiguous') return { code: 1, stdout: '', stderr: 'network reset' }
        if (options.createShow === 'unowned') return { code: 0, stdout: JSON.stringify({ name: 'scheduled-dues', tags: { purpose: 'cron' } }), stderr: '' }
      }
      if (deleted) return { code: options.afterCode ?? 3, stdout: '', stderr: 'missing' }
      if (options.unowned) return { code: 0, stdout: JSON.stringify({ name: 'ue-v2-forward-1', tags: { purpose: 'staging-forward-upgrade', runId: '1' } }), stderr: '' }
      return { code: 0, stdout: JSON.stringify(owned), stderr: '' }
    }
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
  const fake = harness({ logs: marked(completeCatalog()) })
  const produced = await executeCatalogJob(liveEnv(), fake.spawn)
  assert.equal(EVIDENCE_TAIL_LINES, AZ_LOG_TAIL_MAX)
  assert.ok(EVIDENCE_TAIL_LINES <= 300)
  assert.equal(fake.calls.some((call) => call.args.includes(String(EVIDENCE_TAIL_LINES))), true)
  assert.equal(fake.calls.some((call) => call.args.at(-2) === '--tail' && call.args.at(-1) === '200'), false)
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
  assert.equal(cleanup.exitCode, 6)
  assert.equal(cleanup.report.catalogAccepted, false)
  assert.equal(cleanup.report.defects.includes('JOB_CLEANUP_FAILED'), true)

  const createdHarness = harness({ createCode: 1, createError: secret })
  const created = await executeCatalogJob(liveEnv(), createdHarness.spawn)
  assert.equal(created.report.defects.includes('JOB_CREATION_FAILED'), true)
  assert.equal(createdHarness.calls.some((call) => call.args.includes('delete')), true)
  assert.equal(JSON.stringify(created.report).includes(marker), false)

  const absent = harness({ createCode: 1, createShow: 'absent' })
  const absentResult = await executeCatalogJob(liveEnv(), absent.spawn)
  assert.equal(absentResult.report.defects.includes('JOB_CREATION_FAILED'), true)
  assert.equal(absent.calls.some((call) => call.args.includes('delete')), false)

  const ambiguous = harness({ createCode: 1, createShow: 'ambiguous' })
  const ambiguousResult = await executeCatalogJob(liveEnv(), ambiguous.spawn)
  assert.equal(ambiguousResult.report.defects.includes('JOB_CLEANUP_UNPROVEN'), true)
  assert.equal(ambiguous.calls.some((call) => call.args.includes('delete')), false)

  const foreign = harness({ createCode: 1, createShow: 'unowned' })
  const foreignResult = await executeCatalogJob(liveEnv(), foreign.spawn)
  assert.equal(foreignResult.report.defects.includes('JOB_CREATION_FAILED'), true)
  assert.equal(foreign.calls.some((call) => call.args.includes('delete')), false)

  const secretMissing = await executeCatalogJob(liveEnv(), harness({ secrets: [] }).spawn)
  assert.equal(secretMissing.report.defects.includes('RUNTIME_SECRET_UNAVAILABLE'), true)

  const wrongAccount = await executeCatalogJob(liveEnv(), harness({ subscriptionId: 'other' }).spawn)
  assert.equal(wrongAccount.report.defects.includes('WRONG_SUBSCRIPTION'), true)

  const clock = virtualClock(1000)
  const running = harness({ statuses: ['Running'], stopCode: 1 })
  const timed = await executeCatalogJob(liveEnv(), running.spawn, clock)
  assert.equal(timed.report.defects.includes('JOB_EXECUTION_TIMED_OUT'), true)
  assert.equal(timed.report.defects.includes('JOB_CLEANUP_UNPROVEN'), true)
  assert.equal(timed.report.phases.delete, 'HELD')
  assert.equal(running.calls.some((call) => call.args.includes('delete')), false)

  const stopping = harness({ statuses: ['Running'], logs: marked(completeCatalog()) })
  const stopped = await executeCatalogJob(liveEnv(), stopping.spawn, virtualClock(1000))
  assert.equal(stopped.report.executionStatus, 'Stopped')
  assert.equal(stopped.exitCode, 5)
  assert.equal(stopped.report.catalogAccepted, false)
  assert.equal(stopped.report.cleanup.deleted, true)

  const failed = await executeCatalogJob(liveEnv(), harness({ status: 'Failed', logs: marked(completeCatalog()) }).spawn)
  assert.equal(failed.exitCode, 5)
  assert.equal(failed.report.defects.includes('JOB_EXECUTION_FAILED'), true)
  assert.equal(failed.report.catalogAccepted, false)
  assert.equal(failed.report.catalog.schema, CATALOG_SCHEMA)

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

test('observation waits through pending and running, and a short log tail is not a catalogue', async () => {
  const clock = virtualClock(1000)
  clock.deadlineMs = 10000
  const sequence = harness({ statuses: ['Pending', 'Running', 'Running', 'Succeeded'], logs: marked(completeCatalog()) })
  const produced = await executeCatalogJob(liveEnv(), sequence.spawn, clock)
  assert.equal(produced.exitCode, 0)
  assert.deepEqual(produced.report.executionObservations.map((item) => item.status), ['Pending', 'Running', 'Running', 'Succeeded'])
  assert.equal(sequence.calls.some((call) => call.args.includes('stop')), false)

  const retry = harness({ statuses: ['Succeeded'], showCodes: [1, 1, 0], logs: marked(completeCatalog()) })
  const retried = await executeCatalogJob(liveEnv(), retry.spawn, { ...virtualClock(1000), deadlineMs: 10000 })
  assert.equal(retried.exitCode, 0)
  assert.equal(retried.report.executionObservations.filter((item) => item.status === 'UNREAD').length, 2)

  const payload = 'x'.repeat(EVIDENCE_CHUNK_CHARS * 250)
  const framed = frameCatalog(JSON.stringify({ pad: payload }))
  assert.ok(framed.chunks > 200)
  assert.ok(framed.text.split('\n').filter(Boolean).every((line) => line.length <= EVIDENCE_LINE_BUDGET))
  assert.equal(reassembleCatalog(framed.text).ok, true)
  const tail = framed.text.trim().split('\n').slice(-200).join('\n')
  assert.equal(reassembleCatalog(tail).defect, 'EVIDENCE_MISSING')
  const truncated = await executeCatalogJob(liveEnv(), harness({ logs: tail }).spawn)
  assert.equal(truncated.report.defects.includes('EVIDENCE_MISSING'), true)
  assert.equal(truncated.report.catalogAccepted, false)

  const overflow = frameCatalog('y'.repeat(EVIDENCE_MAX_BYTES + 1))
  assert.match(overflow.text, /overflow=1/)
  assert.equal(overflow.text.includes('UE_CATALOG_CHUNK'), false)
  assert.equal(reassembleCatalog(overflow.text).defect, 'EVIDENCE_TRANSPORT_EXCEEDED')
  const refused = await executeCatalogJob(liveEnv(), harness({ logs: overflow.text }).spawn)
  assert.equal(refused.report.defects.includes('EVIDENCE_TRANSPORT_EXCEEDED'), true)
  assert.equal(refused.report.catalog, null)
  assert.equal(refused.report.catalogAccepted, false)
})

test('a failed controller run still writes the catalogue receipt', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-catalog-out-'))
  const result = spawnSync(process.execPath, [path.join(REPO, 'tooling/scripts/ue-v2-staging-catalog-job.mjs'), '--out', directory], {
    env: { ...process.env, UE_CATALOG_JOB_LIVE: '0' },
    encoding: 'utf8',
  })
  assert.notEqual(result.status, 0)
  const receipt = JSON.parse(readFileSync(path.join(directory, 'catalog.json'), 'utf8'))
  assert.equal(receipt.defects.includes('WRONG_ENVIRONMENT'), true)
  assert.equal(receipt.S2_02_PREIMAGE_COMPLETE, 'NO')
  rmSync(directory, { recursive: true, force: true })
})

test('the real process launcher stays inside the Azure CLI tail and stdout limits', async () => {
  const tables = Array.from({ length: 1224 }, (_, index) => ({ schema: 'public', name: `t${String(index).padStart(4, '0')}`, owner: 'union_eyes_runtime' }))
  const realistic = completeCatalog()
  realistic.queries = realistic.queries.map((item) => item.id === 'tables' || item.id === 'relations' || item.id === 'rls' ? query(item.id, tables) : item)
  realistic.counts = tables.map((table) => ({ schema: table.schema, name: table.name, visibleToConnectedRole: true, globalTotal: false, classification: 'OBSERVED', n: '0' }))
  const realisticJson = JSON.stringify(realistic)
  assert.ok(realisticJson.length <= EVIDENCE_MAX_BYTES)
  const framed = frameCatalog(realisticJson)
  assert.equal(framed.overflow, false)
  assert.ok(framed.text.trim().split('\n').length <= AZ_LOG_TAIL_MAX)
  assert.ok(Buffer.byteLength(framed.text) < LOG_STDOUT_MAX_BYTES)
  assert.equal(JSON.parse(reassembleCatalog(framed.text).body).queries.find((item) => item.id === 'tables').rows.length, 1224)

  const directory = mkdtempSync(path.join(tmpdir(), 'ue-fake-az-'))
  const logFile = path.join(directory, 'logs.txt')
  const stateFile = path.join(directory, 'state')
  writeFileSync(logFile, framed.text)
  const az = path.join(directory, 'az')
  const emit = (value) => `fs.writeSync(1, ${JSON.stringify(value)})`
  writeFileSync(az, [
    '#!/usr/bin/env node',
    "const fs = require('fs')",
    'const args = process.argv.slice(2)',
    "const line = args.join(' ')",
    "const tailAt = args.indexOf('--tail')",
    "if (line.includes('logs show')) {",
    '  const tail = Number(args[tailAt + 1])',
    '  if (!Number.isInteger(tail) || tail < 0 || tail > 300) {',
    "    fs.writeSync(2, 'tail out of range\\n')",
    '    process.exit(2)',
    '  }',
    "  if (process.env.UE_FAKE_FLOOD === '1') {",
    `    fs.writeSync(1, 'x'.repeat(${LOG_STDOUT_MAX_BYTES + 4096}))`,
    '    process.exit(0)',
    '  }',
    "  const text = fs.readFileSync(process.env.UE_FAKE_LOG, 'utf8')",
    "  const rows = text.split('\\n')",
    '  fs.writeSync(1, rows.slice(-tail).join(\'\\n\'))',
    "  if (!text.endsWith('\\n')) fs.writeSync(1, '\\n')",
    '  process.exit(0)',
    '}',
    "if (line.includes('account show')) {",
    `  ${emit(JSON.stringify({ subscriptionId: SUBSCRIPTION_ID, tenantId: TENANT_ID }))}`,
    '  process.exit(0)',
    '}',
    "if (line.includes('revision show')) {",
    `  ${emit(JSON.stringify({ name: EXPECTED_REVISION, healthState: 'Healthy', trafficWeight: 100, containers: [{ name: 'union-eyes', image: EXPECTED_IMAGE }] }))}`,
    '  process.exit(0)',
    '}',
    "if (line.includes('secrets[].name')) {",
    `  ${emit(JSON.stringify(['database-url']))}`,
    '  process.exit(0)',
    '}',
    "if (line.includes('job start')) {",
    `  ${emit(`ue-s202-cat-${RUN}-exec\n`)}`,
    '  process.exit(0)',
    '}',
    "if (line.includes('execution show')) {",
    `  ${emit('Succeeded\n')}`,
    '  process.exit(0)',
    '}',
    "if (line.includes('job delete')) {",
    "  fs.writeFileSync(process.env.UE_FAKE_STATE, 'deleted')",
    '  process.exit(0)',
    '}',
    "if (line.includes('job show')) {",
    '  if (fs.existsSync(process.env.UE_FAKE_STATE)) {',
    "    fs.writeSync(2, 'ResourceNotFound\\n')",
    '    process.exit(3)',
    '  }',
    `  ${emit(JSON.stringify({ name: `ue-s202-cat-${RUN}`, tags: { purpose: 's202-private-catalog', runId: RUN, source: SHA } }))}`,
    '  process.exit(0)',
    '}',
    'process.exit(0)',
    '',
  ].join('\n'))
  chmodSync(az, 0o755)
  const previousLog = process.env.UE_FAKE_LOG
  const previousFlood = process.env.UE_FAKE_FLOOD
  const previousState = process.env.UE_FAKE_STATE
  process.env.UE_FAKE_LOG = logFile
  process.env.UE_FAKE_STATE = stateFile
  delete process.env.UE_FAKE_FLOOD
  const spawn = async (executable, args) => {
    assert.equal(executable, 'az')
    return launch(az, args)
  }
  try {
    const refused = launch(az, ['containerapp', 'job', 'logs', 'show', '--tail', '301'])
    assert.equal(refused.code, 2)
    const produced = await executeCatalogJob(liveEnv(), spawn)
    assert.equal(produced.exitCode, 0)
    assert.equal(produced.report.catalogAccepted, true)
    assert.equal(produced.report.catalog.queries.find((item) => item.id === 'tables').rows.length, 1224)
    assert.equal(produced.report.catalog.counts.length, 1224)
    rmSync(stateFile, { force: true })
    process.env.UE_FAKE_FLOOD = '1'
    const flooded = await executeCatalogJob(liveEnv(), spawn)
    assert.equal(flooded.report.defects.includes('EVIDENCE_TRANSPORT_EXCEEDED'), true)
    assert.equal(flooded.report.catalogAccepted, false)
    assert.equal(flooded.report.catalog, null)
    writeFileSync(logFile, framed.text.trim().split('\n').slice(-50).join('\n'))
    rmSync(stateFile, { force: true })
    delete process.env.UE_FAKE_FLOOD
    const truncated = await executeCatalogJob(liveEnv(), spawn)
    assert.equal(truncated.report.defects.includes('EVIDENCE_MISSING'), true)
    assert.equal(truncated.report.catalogAccepted, false)
  } finally {
    if (previousLog === undefined) delete process.env.UE_FAKE_LOG
    else process.env.UE_FAKE_LOG = previousLog
    if (previousFlood === undefined) delete process.env.UE_FAKE_FLOOD
    else process.env.UE_FAKE_FLOOD = previousFlood
    if (previousState === undefined) delete process.env.UE_FAKE_STATE
    else process.env.UE_FAKE_STATE = previousState
    rmSync(directory, { recursive: true, force: true })
  }
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
  assert.match(text, /if: always\(\)/)
  assert.ok(text.indexOf('process.getuid()') < text.indexOf('docker push'))
  assert.match(text, /--user 1001:1001/)
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
    const context = mkdtempSync(path.join(tmpdir(), 'ue-catalog-image-'))
    writeFileSync(path.join(context, 'operator.cjs'), containerSource())
    writeFileSync(path.join(context, 'base.Dockerfile'), [
      'FROM node:22-slim',
      'WORKDIR /app',
      'RUN npm install --omit=dev --no-fund --no-audit pg@8.20.0 \\',
      ' && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx',
      'RUN groupadd --system --gid 1001 nodejs \\',
      ' && useradd --system --uid 1001 --no-create-home nextjs \\',
      ' && chown -R nextjs:nodejs /app',
      'USER 1001:1001',
      '',
    ].join('\n'))
    const base = spawnSync('docker', ['build', '-f', path.join(context, 'base.Dockerfile'), '-t', 'ue-s202-catalog-base', context], { encoding: 'utf8' })
    assert.equal(base.status, 0, base.stderr)
    const image = spawnSync('docker', ['build', '-f', path.join(REPO, 'tooling/docker/ue-v2-catalog-operator.Dockerfile'), '--build-arg', 'QUALIFIED_APPLICATION_IMAGE=ue-s202-catalog-base', '--build-arg', 'OPERATOR_SOURCE_SHA=local', '-t', 'ue-s202-catalog-operator', context], { encoding: 'utf8' })
    assert.equal(image.status, 0, image.stderr)
    const probe = spawnSync('docker', ['run', '--rm', '--entrypoint', 'node', '-e', 'NODE_PATH=', 'ue-s202-catalog-operator', '-e', 'process.chdir("/app/ue-catalog"); const pg = require("pg"); if (process.getuid() !== 1001) process.exit(2); if (!pg.Client) process.exit(3); console.log("PG_RESOLVED " + require.resolve("pg"));'], { encoding: 'utf8' })
    assert.equal(probe.status, 0, probe.stderr)
    assert.match(probe.stdout, /PG_RESOLVED \/app\/node_modules\/pg\/lib\/index\.js/)
    const runOperator = (url) => spawnSync('docker', ['run', '--rm', '--network', 'host', '-e', 'NODE_PATH=', '-e', `DATABASE_URL=${url}`, '-e', 'UE_CATALOG_TRANSPORT=private-job', 'ue-s202-catalog-operator'], { encoding: 'utf8' })
    const elevatedUrl = ['post', 'gresql://postgres:', password, '@127.0.0.1:54329/ue_v2_staging'].join('')
    const elevated = runOperator(elevatedUrl)
    const elevatedBody = JSON.parse(reassembleCatalog(elevated.stdout).body)
    assert.equal(elevatedBody.rolledBack, true)
    assert.equal(elevatedBody.identity.transaction_read_only, 'on')
    assert.equal(elevatedBody.privilege.classification, 'ELEVATED')
    assert.equal(elevatedBody.privilege.readOnlyCredential, false)
    assert.equal(elevated.stdout.includes(password), false)
    const limitedUrl = ['post', 'gresql://catalog_login:', rolePassword, '@127.0.0.1:54329/ue_v2_staging'].join('')
    const limited = runOperator(limitedUrl)
    const limitedBody = JSON.parse(reassembleCatalog(limited.stdout).body)
    assert.equal(limitedBody.privilege.classification, 'LIMITED_RUNTIME')
    assert.equal(limitedBody.counts.find((item) => item.name === 'members').globalTotal, false)
    const wrongUrl = ['post', 'gresql://postgres:', password, '@127.0.0.1:54329/postgres'].join('')
    const wrong = runOperator(wrongUrl)
    const wrongBody = JSON.parse(reassembleCatalog(wrong.stdout).body)
    assert.equal(wrongBody.blocker, 'IDENTITY_REFUSED')
    rmSync(context, { recursive: true, force: true })
  } finally {
    spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
  }
})
