import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
  RUNTIME_CONSISTENCY_CAVEAT,
  CONTAINER_APP,
  CONTAINER_NAME,
  EXPECTED_IMAGE,
  EXPECTED_REVISION,
  EXEC_ACTION,
  GROUP_ID,
  RESOURCE_GROUP,
  SUBSCRIPTION_ID,
  TENANT_ID,
  actionCovers,
  containerSource,
  execInvocation,
  revisionDefect,
  selectReplica,
  executeCatalog,
  CATALOG_CONTRACT,
  CATALOG_SCHEMA,
  parseCatalogStdout,
  evaluateCatalogCompleteness,
  principalFromAccessToken,
  roleCoversExec,
  writeReport,
  PLANE_RESPONSIBILITY,
  classifyCount,
  generateRecipientKeyPair,
  openSealedCatalog,
  reconcilePlanes,
  reconcileCatalogSessions,
  buildContinuationToken,
  sealForRecipient,
  INSTALLER_RECEIPT,
} from './ue-v2-staging-catalog-exec.mjs'
import { FIXTURE_COUNTS, FIXTURE_LEDGER, FIXTURE_RECEIPT, fixtureQuery, privilegedCatalog, runtimeCatalog, sealPrivileged } from './ue-v2-staging-catalog.fixtures.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const require = createRequire(path.join(REPO, 'package.json'))
const YAML = require('yaml')
const WORKFLOW = path.join(REPO, '.github/workflows/ue-v2-staging-catalog-exec.yml')
const TOKEN_SECRET = 'catalog-token-secret-value'

function jwt(payload) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode(payload)}.${TOKEN_SECRET}`
}

function liveEnv() {
  return {
    UE_CATALOG_EXEC_LIVE: '1',
    GITHUB_REPOSITORY: 'anungis437/nzila-os',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
  }
}

function revisionBody(image = EXPECTED_IMAGE) {
  return {
    name: EXPECTED_REVISION,
    healthState: 'Healthy',
    trafficWeight: 100,
    runningState: 'Running',
    containers: [{ name: CONTAINER_NAME, image }],
  }
}

function replicaBody() {
  return [{ name: EXPECTED_REVISION + '-77f9c', runningState: 'Running', containers: [CONTAINER_NAME] }]
}

function query(id, rows) {
  return { id, rowCount: rows.length, rows }
}

// Plane A as staging is: every runtime-plane category observable, no global totals.
function completeCatalog() {
  return runtimeCatalog()
}

function verdictOf(body) {
  return evaluateCatalogCompleteness(body).verdict
}

function deployerDefinition() {
  return [{
    roleName: 'Nzila UE V2 Staging Deployer',
    permissions: [{ actions: ['Microsoft.App/*', 'Microsoft.Authorization/*/read'], notActions: ['Microsoft.Authorization/*/write'], dataActions: [] }],
  }]
}

function harness(options = {}) {
  const calls = []
  const token = jwt({ oid: 'oid-1', appid: 'app-1', tid: TENANT_ID, password: TOKEN_SECRET })
  const spawn = async (executable, args) => {
    calls.push({ executable, args })
    if (executable === 'timeout') return options.exec ?? { code: 0, stdout: options.catalogStdout ?? '', stderr: '' }
    if (executable !== 'az') throw new Error(`UNEXPECTED_EXECUTABLE ${executable}`)
    if (args[0] === 'account' && args[1] === 'show') {
      return { code: 0, stdout: JSON.stringify({ subscriptionId: SUBSCRIPTION_ID, tenantId: TENANT_ID }), stderr: '' }
    }
    if (args[0] === 'account' && args[1] === 'get-access-token') return { code: 0, stdout: `${token}\n`, stderr: '' }
    if (args[0] === 'role' && args[1] === 'assignment') {
      return { code: 0, stdout: JSON.stringify(options.assignments ?? [{ principalId: 'oid-1', roleDefinitionName: 'Nzila UE V2 Staging Deployer', scope: GROUP_ID }]), stderr: '' }
    }
    if (args[0] === 'role' && args[1] === 'definition') return { code: 0, stdout: JSON.stringify(options.definition ?? deployerDefinition()), stderr: '' }
    if (args[0] === 'containerapp' && args[1] === 'revision') return { code: 0, stdout: JSON.stringify(options.revision ?? revisionBody()), stderr: '' }
    if (args[0] === 'containerapp' && args[1] === 'replica') return options.replicaRead ?? { code: 0, stdout: JSON.stringify(options.replicas ?? replicaBody()), stderr: '' }
    throw new Error(`UNEXPECTED ${args.join(' ')}`)
  }
  return { calls, spawn, token }
}

test('Microsoft.App/* covers exec and Reader does not', () => {
  assert.equal(actionCovers('Microsoft.App/*', EXEC_ACTION), true)
  assert.equal(actionCovers('*/read', EXEC_ACTION), false)
  assert.equal(roleCoversExec(deployerDefinition()[0]), true)
  assert.equal(roleCoversExec({ permissions: [{ actions: ['*/read'], notActions: [] }] }), false)
  assert.equal(roleCoversExec({ permissions: [{ actions: ['Microsoft.App/*'], notActions: ['Microsoft.App/containerApps/exec/action'] }] }), false)
})

test('the access-token decoder keeps only the caller identifiers', () => {
  const token = jwt({ oid: 'oid-1', appid: 'app-1', tid: TENANT_ID, password: TOKEN_SECRET })
  const caller = principalFromAccessToken(token)
  assert.deepEqual(caller, { oid: 'oid-1', appid: 'app-1', tid: TENANT_ID })
  assert.equal(JSON.stringify(caller).includes(TOKEN_SECRET), false)
})

test('a missing exec allow stops before revision and container exec', async () => {
  const { calls, spawn, token } = harness({ definition: [{ permissions: [{ actions: ['*/read'], notActions: [] }] }] })
  const result = await executeCatalog(liveEnv(), spawn)
  assert.equal(result.exitCode, 3)
  assert.equal(result.report.execPermission, 'NOT_GRANTED')
  assert.equal(result.report.execAttempted, false)
  assert.equal(calls.some((call) => call.executable === 'timeout' || call.args[0] === 'containerapp'), false)
  assert.equal(JSON.stringify(result.report).includes(token), false)
  assert.equal(JSON.stringify(result.report).includes(TOKEN_SECRET), false)
})

test('a changed image binding stops before exec', async () => {
  const { calls, spawn } = harness({ revision: revisionBody('nzilaventuresacr.azurecr.io/nzila-os-union-eyes-v2@sha256:' + 'ab'.repeat(32)) })
  const result = await executeCatalog(liveEnv(), spawn)
  assert.equal(result.exitCode, 4)
  assert.deepEqual(result.report.defects, ['REVISION_BINDING_CHANGED'])
  assert.equal(result.report.execAttempted, false)
  assert.equal(calls.some((call) => call.executable === 'timeout'), false)
  assert.equal(result.report.revision.containers[0].image.endsWith('ab'.repeat(32)), true)
})

test('one accepted binding builds one pseudo-terminal exec and parses the catalogue', async () => {
  const catalog = completeCatalog()
  const stdout = `noise\nUE_CATALOG_BEGIN\n${JSON.stringify(catalog)}\nUE_CATALOG_END\n`
  const { calls, spawn, token } = harness({ catalogStdout: stdout })
  const result = await executeCatalog(liveEnv(), spawn)
  // A runtime session alone is never a complete preimage: totals need the privileged plane.
  assert.equal(result.exitCode, 5)
  assert.equal(result.report.execPermission, 'EFFECTIVE_ALLOW_OBSERVED')
  assert.equal(result.report.execAttempted, true)
  assert.equal(result.report.catalog.identity.user, 'union_eyes_runtime')
  assert.equal(result.report.verdict, 'CATALOG_PARTIAL')
  assert.equal(result.report.catalog.evaluation.reason, 'OTHER_PLANE_REQUIRED')
  assert.equal(result.report.catalog.evaluation.planeVerdict, 'PLANE_ACCEPTED')
  assert.equal(result.report.S2_02_PREIMAGE_COMPLETE, 'NO')
  assert.equal(result.report.S2_02_LEGACY_GATE, 'INDETERMINATE')
  assert.equal(result.report.catalog.evaluation.categories.length, CATALOG_CONTRACT.categories.length)
  const exec = calls.find((call) => call.executable === 'timeout')
  assert.equal(exec.args[5].includes('eval('), false)
  assert.equal(exec.executable, 'timeout')
  assert.deepEqual(exec.args.slice(0, 5), ['90', 'script', '-q', '-e', '-c'])
  assert.match(exec.args[5], new RegExp(EXPECTED_REVISION))
  assert.match(exec.args[5], /--container/)
  assert.match(exec.args[5], /--replica/)
  assert.match(exec.args[5], new RegExp(replicaBody()[0].name))
  assert.equal(/postgres(?:ql)?:\/\/(?!\[redacted\])\S+/i.test(exec.args[5]), false)
  assert.equal(calls.filter((call) => call.executable === 'az').every((call) => call.args[0] !== 'timeout'), true)
  assert.equal(JSON.stringify(result.report).includes(token), false)
})

test('replica discovery selects only a running container of the verified revision', () => {
  const healthy = replicaBody()[0]
  const selected = selectReplica([{ ...healthy, name: healthy.name + 'z' }, healthy])
  assert.equal(selected.defect, null)
  assert.equal(selected.name, healthy.name)
  assert.equal(selected.eligibleCount, 2)
  assert.equal(selectReplica([]).defect, 'NO_REPLICA_OBSERVED')
  assert.equal(selectReplica([{ name: healthy.name, runningState: 'Running' }]).defect, 'REPLICA_FIELDS_ABSENT')
  assert.equal(selectReplica([{ ...healthy, runningState: 'Stopped' }]).defect, 'NO_ELIGIBLE_RUNNING_REPLICA')
  assert.equal(selectReplica([{ ...healthy, containers: ['different'] }]).defect, 'NO_ELIGIBLE_RUNNING_REPLICA')
  assert.equal(selectReplica([{ ...healthy, name: 'another-app--rel6a60c95c9d-1' }]).defect, 'NO_ELIGIBLE_RUNNING_REPLICA')
  assert.throws(() => execInvocation('wrong-replica'), /REPLICA_BINDING_REFUSED/)
})

test('replica list failure and no eligible replica refuse exec without retry', async () => {
  const failed = harness({ replicaRead: { code: 1, stdout: '', stderr: 'replicas unavailable' } })
  const a = await executeCatalog(liveEnv(), failed.spawn)
  assert.equal(a.exitCode, 4)
  assert.equal(a.report.execAttempted, false)
  assert.deepEqual(a.report.defects, ['REPLICA_LIST_UNREADABLE'])
  assert.equal(failed.calls.filter((call) => call.executable === 'timeout').length, 0)
  const empty = harness({ replicas: [] })
  const b = await executeCatalog(liveEnv(), empty.spawn)
  assert.equal(b.exitCode, 4)
  assert.deepEqual(b.report.defects, ['NO_REPLICA_OBSERVED'])
  assert.equal(b.report.execAttempted, false)
})

test('WebSocket 404 is classified as transport failure and never as database evidence', async () => {
  const failed = await executeCatalog(liveEnv(), harness({ exec: { code: 1, stdout: '', stderr: 'Handshake status 404 Not Found' } }).spawn)
  assert.equal(failed.exitCode, 5)
  assert.equal(failed.report.execAttempted, true)
  assert.equal(failed.report.catalog, null)
  assert.ok(failed.report.defects.includes('EXEC_WEBSOCKET_404'))
  assert.ok(failed.report.defects.includes('CATALOG_UNREADABLE'))
})

test('a revision payload without traffic weight fails closed before exec', async () => {
  const incomplete = revisionBody()
  incomplete.trafficWeight = null
  const { calls, spawn } = harness({ revision: incomplete })
  const result = await executeCatalog(liveEnv(), spawn)
  assert.equal(revisionDefect(incomplete), 'REVISION_FIELDS_ABSENT')
  assert.equal(result.exitCode, 4)
  assert.deepEqual(result.report.defects, ['REVISION_FIELDS_ABSENT'])
  assert.equal(calls.some((call) => call.executable === 'timeout'), false)
})

test('timeout, a failed exec, and a missing marker do not become a catalogue', async () => {
  const leaked = ['post', 'gresql://ue:', ['secret', 'password'].join('-'), '@db/ue_v2_staging'].join('')
  const timed = await executeCatalog(liveEnv(), harness({ exec: { code: 124, stdout: '', stderr: leaked } }).spawn)
  assert.equal(timed.exitCode, 5)
  assert.equal(timed.report.defects.includes('EXEC_TIMED_OUT'), true)
  assert.equal(timed.report.catalog, null)
  assert.equal(JSON.stringify(timed.report).includes(['secret', 'password'].join('-')), false)

  const failed = await executeCatalog(liveEnv(), harness({ exec: { code: 1, stdout: 'hello', stderr: leaked } }).spawn)
  assert.equal(failed.exitCode, 5)
  assert.equal(failed.report.defects.includes('EXEC_OUTPUT_WITHOUT_CATALOG_MARKER'), true)
  assert.equal(failed.report.transcriptTail.includes(['secret', 'password'].join('-')), false)
  assert.match(failed.report.transcriptTail, /\[redacted\]/)

  const unmarked = await executeCatalog(liveEnv(), harness({ exec: { code: 0, stdout: 'hello', stderr: '' } }).spawn)
  assert.equal(unmarked.exitCode, 5)
  assert.equal(unmarked.report.defects.includes('EXEC_OUTPUT_WITHOUT_CATALOG_MARKER'), true)
  assert.equal(unmarked.report.catalog, null)
})

test('the real launcher executes timeout for the console and az for the control plane', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-catalog-launch-'))
  const bin = path.join(directory, 'bin')
  const out = path.join(directory, 'out')
  mkdirSync(bin)
  const token = jwt({ oid: 'oid-1', appid: 'app-1', tid: TENANT_ID, password: TOKEN_SECRET })
  const revision = JSON.stringify(revisionBody())
  const definition = JSON.stringify(deployerDefinition())
  const assignments = JSON.stringify([{ principalId: 'oid-1', roleDefinitionName: 'Nzila UE V2 Staging Deployer', scope: GROUP_ID }])
  const account = JSON.stringify({ subscriptionId: SUBSCRIPTION_ID, tenantId: TENANT_ID })
  writeFileSync(path.join(bin, 'az'), `#!/bin/sh
printf '%s\\n' "$*" >> ${JSON.stringify(path.join(directory, 'az.log'))}
case "$1 $2" in
  "account show") printf '%s\\n' ${JSON.stringify(account)} ;;
  "account get-access-token") printf '%s\\n' "$UE_FAKE_TOKEN" ;;
  "role assignment") printf '%s\\n' ${JSON.stringify(assignments)} ;;
  "role definition") printf '%s\\n' ${JSON.stringify(definition)} ;;
  "containerapp revision") printf '%s\\n' ${JSON.stringify(revision)} ;;
  "containerapp replica") printf '%s\\n' ${JSON.stringify(JSON.stringify(replicaBody()))} ;;
  *) printf '%s\\n' "unexpected $*" >&2; exit 9 ;;
esac
`)
  writeFileSync(path.join(bin, 'timeout'), `#!/bin/sh
printf '%s\\n' "$*" >> ${JSON.stringify(path.join(directory, 'timeout.log'))}
if [ "$1" != 90 ]; then exit 97; fi
printf '%s\\n' 'UE_CATALOG_BEGIN'
cat "$UE_FAKE_CATALOG_FILE"
printf '%s\\n' 'UE_CATALOG_END'
`)
  chmodSync(path.join(bin, 'az'), 0o755)
  chmodSync(path.join(bin, 'timeout'), 0o755)
  const catalogFile = path.join(directory, 'catalog-body.json')
  writeFileSync(catalogFile, JSON.stringify(completeCatalog()))
  const run = spawnSync(process.execPath, [path.join(REPO, 'tooling/scripts/ue-v2-staging-catalog-exec.mjs'), '--out', out], {
    env: { ...process.env, ...liveEnv(), PATH: `${bin}:${process.env.PATH}`, UE_FAKE_TOKEN: token, UE_FAKE_CATALOG_FILE: catalogFile },
    encoding: 'utf8',
  })
  assert.equal(run.status, 5, run.stderr)
  assert.match(run.stdout, /catalog=CATALOG_PARTIAL/)
  assert.equal(run.stdout.includes('catalog=OBSERVED'), false)
  assert.match(run.stdout, /S2_02_PREIMAGE_COMPLETE=NO/)
  assert.match(run.stdout, /S2_02_LEGACY_GATE=INDETERMINATE/)
  const azLog = readFileSync(path.join(directory, 'az.log'), 'utf8')
  const timeoutLog = readFileSync(path.join(directory, 'timeout.log'), 'utf8')
  assert.equal(azLog.includes('timeout'), false)
  assert.match(azLog, /account show/)
  assert.match(azLog, /containerapp revision show/)
  assert.match(azLog, /containerapp replica list/)
  assert.match(timeoutLog, /--replica/)
  assert.match(timeoutLog, /^90 script -q -e -c az /)
  assert.match(timeoutLog, new RegExp(EXPECTED_REVISION))
  assert.equal(/postgres(?:ql)?:\/\/(?!\[redacted\])\S+/i.test(timeoutLog), false)
  const report = readFileSync(path.join(out, 'catalog.json'), 'utf8')
  assert.equal(report.includes(token), false)
  assert.equal(report.includes(TOKEN_SECRET), false)
  assert.match(report, /EFFECTIVE_ALLOW_OBSERVED/)
  rmSync(directory, { recursive: true, force: true })
})

test('the catalogue contract rejects incomplete evidence and keeps a complete session distinct from S2.02', async () => {
  const marked = (body) => `UE_CATALOG_BEGIN\n${JSON.stringify(body)}\nUE_CATALOG_END\n`
  const withQuery = (id, replacement, base = completeCatalog()) => {
    const body = structuredClone(base)
    body.queries = body.queries.map((item) => item.id === id ? replacement : item)
    return body
  }
  const classification = (body, id) => evaluateCatalogCompleteness(body).categories.flatMap((category) => category.queries ?? []).find((item) => item.id === id)?.classification
  const accepted = (body, id) => evaluateCatalogCompleteness(body).categories.find((category) => category.id === id)?.accepted

  const plane = evaluateCatalogCompleteness(completeCatalog())
  assert.equal(plane.verdict, 'CATALOG_PARTIAL')
  assert.equal(plane.planeVerdict, 'PLANE_ACCEPTED')
  assert.equal(plane.reason, 'OTHER_PLANE_REQUIRED')
  assert.deepEqual(plane.categories.filter((category) => category.classification === 'NOT_IN_PLANE').map((category) => category.id), ['migration_history', 'preservation_counts'])

  const empty = completeCatalog()
  empty.queries = []
  const emptyRun = await executeCatalog(liveEnv(), harness({ catalogStdout: marked(empty) }).spawn)
  assert.equal(emptyRun.exitCode, 5)
  assert.equal(emptyRun.report.verdict, 'CATALOG_PARTIAL')
  assert.equal(emptyRun.report.S2_02_PREIMAGE_COMPLETE, 'NO')

  const omitted = completeCatalog()
  omitted.queries = omitted.queries.filter((item) => !['policies', 'security_definer', 'event_trigger'].includes(item.id))
  assert.equal(evaluateCatalogCompleteness(omitted).planeVerdict, 'PLANE_INCOMPLETE')

  const privileged = privilegedCatalog()
  const verifiedLedger = withQuery('drizzle_rows', { id: 'drizzle_rows', classification: 'NOT_ATTEMPTED', reason: 'RELATION_NOT_IN_DISCOVERY' }, privileged)
  verifiedLedger.queries = verifiedLedger.queries.map((item) => item.id === 'migration_relations' ? fixtureQuery('migration_relations', []) : item.id === 'migration_columns' ? fixtureQuery('migration_columns', []) : item)
  assert.equal(classification(verifiedLedger, 'drizzle_rows'), 'ABSENT_VERIFIED')
  assert.equal(evaluateCatalogCompleteness(verifiedLedger).planeVerdict, 'PLANE_ACCEPTED')

  const ledgerError = withQuery('drizzle_rows', { id: 'drizzle_rows', error: 'relation "drizzle.__drizzle_migrations" does not exist' }, privileged)
  assert.equal(classification(ledgerError, 'drizzle_rows'), 'UNREADABLE')
  assert.equal(evaluateCatalogCompleteness(ledgerError).planeVerdict, 'PLANE_INCOMPLETE')

  const audit = await executeCatalog(liveEnv(), harness({ catalogStdout: marked(withQuery('audit', { id: 'audit', error: 'permission denied for relation audit_logs' })) }).spawn)
  assert.equal(audit.exitCode, 5)
  assert.equal(audit.report.verdict, 'CATALOG_PARTIAL')
  assert.equal(classification(audit.report.catalog, 'audit'), 'UNREADABLE')

  assert.equal(accepted(withQuery('rls', { id: 'rls', error: 'permission denied for table pg_class' }), 'rls_configuration'), false)
  assert.equal(accepted(withQuery('event_trigger', { id: 'event_trigger', error: 'permission denied for table pg_event_trigger' }), 'event_triggers'), false)

  const absentFunction = withQuery('function', { id: 'function', rowCount: 0, rows: [] })
  const absentEvaluation = evaluateCatalogCompleteness(absentFunction)
  assert.equal(absentEvaluation.planeVerdict, 'PLANE_ACCEPTED')
  assert.equal(classification(absentFunction, 'function'), 'ABSENT_VERIFIED')
  assert.equal(absentEvaluation.legacyObservation, 'LEGACY_TRANSITION_REQUIRED')
  assert.equal(absentEvaluation.S2_02_LEGACY_GATE, 'INDETERMINATE')
  assert.equal(absentEvaluation.S2_02_PREIMAGE_COMPLETE, 'NO')

  const wrongSchema = completeCatalog()
  wrongSchema.schema = 'ue-v2-staging-catalog/v1'
  assert.equal(verdictOf(wrongSchema), 'CATALOG_REFUSED')
  assert.equal(evaluateCatalogCompleteness(wrongSchema).reason, 'UNEXPECTED_SCHEMA_VERSION')

  const capped = privilegedCatalog()
  capped.counts[0] = { ...capped.counts[0], classification: 'NOT_ATTEMPTED', reason: 'COUNT_BUDGET', n: undefined }
  const cap = evaluateCatalogCompleteness(capped)
  assert.equal(cap.planeVerdict, 'PLANE_INCOMPLETE')
  assert.match(cap.additionalProcedure, /NOT_ATTEMPTED/)

  const timedCount = privilegedCatalog()
  timedCount.counts[0] = { ...timedCount.counts[0], classification: 'TIMED_OUT', error: 'canceling statement due to statement timeout', n: null }
  assert.equal(evaluateCatalogCompleteness(timedCount).planeVerdict, 'PLANE_INCOMPLETE')

  const mismatched = completeCatalog()
  mismatched.identity = { ...mismatched.identity, transaction_read_only: 'off' }
  mismatched.blocker = 'IDENTITY_REFUSED'
  assert.equal(verdictOf(mismatched), 'CATALOG_REFUSED')

  const rolled = completeCatalog()
  rolled.rolledBack = false
  assert.equal(verdictOf(rolled), 'CATALOG_REFUSED')
  assert.equal(evaluateCatalogCompleteness(rolled).reason, 'ROLLBACK_FAILED')

  const malformed = parseCatalogStdout('UE_CATALOG_BEGIN\n{not-json\nUE_CATALOG_END\n')
  assert.equal(malformed.verdict, 'CATALOG_UNREADABLE')
  const unmarked = parseCatalogStdout('no markers')
  assert.equal(unmarked.verdict, 'CATALOG_UNREADABLE')
  assert.equal(unmarked.blocker, 'EXEC_OUTPUT_WITHOUT_CATALOG_MARKER')
})

test('the container program resolves pg, refuses a writable transaction, and rolls back', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-catalog-'))
  const source = containerSource()
  assert.equal(/nextval\s*\(/i.test(source), false)
  assert.equal(/auth_business_org_authorized\s*\(/.test(source), false)
  assert.match(source, /BEGIN READ ONLY/)
  assert.match(source, /ROLLBACK/)
  writeFileSync(path.join(directory, 'program.cjs'), source)
  mkdirSync(path.join(directory, 'node_modules', 'pg'), { recursive: true })
  writeFileSync(path.join(directory, 'node_modules', 'pg', 'package.json'), '{"name":"pg","main":"index.js"}\n')
  writeFileSync(path.join(directory, 'node_modules', 'pg', 'index.js'), `
    class Client {
      constructor(config) { this.url = config.connectionString; this.queries = [] }
      async connect() {}
      async query(sql) {
        this.queries.push(sql)
        if (sql.includes('transaction_read_only')) return { rowCount: 1, rows: [{ version: 'PostgreSQL 16', database: 'ue_v2_staging', user: 'union_eyes_runtime', transaction_read_only: 'off' }] }
        return { rowCount: 0, rows: [] }
      }
      async end() {}
    }
    module.exports = { Client }
  `)
  const run = spawnSync(process.execPath, ['program.cjs'], {
    cwd: directory,
    env: { ...process.env, DATABASE_URL: ['post', 'gresql://union_eyes_runtime:', ['secret', 'password'].join('-'), '@db.internal/ue_v2_staging'].join('') },
    encoding: 'utf8',
  })
  assert.equal(run.stdout.includes('secret-password'), false)
  assert.equal(run.stderr.includes('secret-password'), false)
  const parsed = parseCatalogStdout(run.stdout)
  assert.equal(parsed.ok, false)
  assert.equal(parsed.body.blocker, 'IDENTITY_REFUSED')
  assert.equal(parsed.body.rolledBack, true)
  assert.equal(parsed.body.queries.some((item) => String(item.id).startsWith('count_')), false)
  rmSync(directory, { recursive: true, force: true })
})

test('a missing pg module is the container blocker and opens no connection', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-catalog-'))
  writeFileSync(path.join(directory, 'program.cjs'), containerSource())
  const run = spawnSync(process.execPath, ['program.cjs'], { cwd: directory, env: { PATH: process.env.PATH }, encoding: 'utf8' })
  const parsed = parseCatalogStdout(run.stdout)
  assert.equal(parsed.body.blocker, 'NO_IN_CONTAINER_PG_CLIENT')
  assert.equal(parsed.body.client.resolved, false)
  assert.equal(parsed.body.rolledBack, false)
  rmSync(directory, { recursive: true, force: true })
})

test('catalogue markers survive redaction and a connection string does not', () => {
  const leaked = ['post', 'gresql://ue:', ['secret', 'password'].join('-'), '@db/ue_v2_staging'].join('')
  const parsed = parseCatalogStdout(`UE_CATALOG_BEGIN\n{"schema":"ue-v2-staging-catalog/v1","blocker":"QUERY_FAILED","error":${JSON.stringify(leaked)},"rolledBack":true}\nUE_CATALOG_END\n`)
  assert.equal(parsed.ok, false)
  assert.equal(parsed.body.error.includes(['secret', 'password'].join('-')), false)
  assert.match(parsed.body.error, /\[redacted\]/)
})

test('live execution is refused off main without calling Azure', async () => {
  let called = false
  const result = await executeCatalog({ ...liveEnv(), GITHUB_REF: 'refs/heads/feature' }, () => { called = true; return { code: 0, stdout: '', stderr: '' } })
  assert.equal(called, false)
  assert.equal(result.report.defects.includes('NOT_DEFAULT_BRANCH'), true)
})

test('the workflow is manual, pinned to main, and uses the deploy environment only', () => {
  const workflow = YAML.parse(readFileSync(WORKFLOW, 'utf8'))
  assert.deepEqual(Object.keys(workflow.on), ['workflow_dispatch'])
  assert.equal(workflow.jobs.catalog.environment, 'ue-staging')
  assert.match(workflow.jobs.catalog.if, /refs\/heads\/main/)
  assert.equal(workflow.permissions.contents, 'read')
  assert.equal(workflow.permissions['id-token'], 'write')
  const text = readFileSync(WORKFLOW, 'utf8')
  assert.equal(text.includes('containerapp job'), false)
  assert.equal(text.includes('postgres flexible-server firewall'), false)
  assert.equal(text.includes('deployment group create'), false)
  assert.equal(text.includes('UE_V2_STAGING_DB_ADMIN_PASSWORD'), false)
  assert.equal(text.includes(CONTAINER_APP), false)
  const command = execInvocation(replicaBody()[0].name)
  assert.equal(command.args[5].includes('eval('), false)
  assert.equal(command.executable, 'timeout')
  assert.equal(command.args[5].includes(CONTAINER_APP), true)
  assert.equal(command.args[5].startsWith('az '), true)
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-catalog-report-'))
  const digest = writeReport(directory, { defects: [] })
  assert.equal(readFileSync(path.join(directory, 'SHA256SUMS'), 'utf8').startsWith(digest), true)
  rmSync(directory, { recursive: true, force: true })
})

const BINDING = { revision: EXPECTED_REVISION, image: EXPECTED_IMAGE, source: 'a'.repeat(40) }

test('role-visible counts are never preservation totals, whatever the operator claims', () => {
  // Run 45940281038 shape: 103 zeros counted by the runtime role under forced RLS.
  assert.equal(classifyCount({ schema: 'public', name: 'members', visibleToConnectedRole: true, globalTotal: false, classification: 'OBSERVED', n: '0' }), 'ROLE_VISIBLE_ONLY')
  assert.equal(classifyCount({ schema: 'public', name: 'members', countScope: 'ROLE_VISIBLE', globalTotal: false, classification: 'OBSERVED', n: '0' }), 'ROLE_VISIBLE_ONLY')
  assert.equal(classifyCount({ schema: 'public', name: 'claims', classification: 'PRIVILEGE_DENIED' }), 'PRIVILEGE_DENIED')
  // A GLOBAL label the session's own privilege matrix does not support is refused.
  const overclaimed = privilegedCatalog()
  overclaimed.privilege = { ...overclaimed.privilege, rolbypassrls: false }
  overclaimed.queries = overclaimed.queries.map((item) => item.id === 'privilege_matrix' ? fixtureQuery('privilege_matrix', item.rows.map((row) => ({ ...row, acts_as_owner: false }))) : item)
  const evaluation = evaluateCatalogCompleteness(overclaimed)
  const counts = evaluation.categories.find((category) => category.id === 'preservation_counts')
  assert.equal(counts.accepted, false)
  assert.deepEqual(counts.tally, { SCOPE_UNPROVEN: 2 })
  // Without a privilege matrix nothing is provably global.
  const unmapped = privilegedCatalog()
  unmapped.queries = unmapped.queries.filter((item) => item.id !== 'privilege_matrix')
  assert.equal(evaluateCatalogCompleteness(unmapped).categories.find((category) => category.id === 'preservation_counts').accepted, false)
  // The runtime plane cannot supply totals even for a table it can read.
  assert.equal(PLANE_RESPONSIBILITY.runtime.includes('preservation_counts'), false)
  assert.equal(PLANE_RESPONSIBILITY.runtime.includes('migration_history'), false)
})

test('hidden migration metadata is never verified absence', () => {
  const hidden = privilegedCatalog()
  // What information_schema returned to the runtime role: no columns for a discovered ledger.
  hidden.queries = hidden.queries.map((item) => item.id === 'migration_columns' ? fixtureQuery('migration_columns', []) : item)
  const migration = evaluateCatalogCompleteness(hidden).categories.find((category) => category.id === 'migration_history')
  assert.equal(migration.queries.find((item) => item.id === 'migration_columns').classification, 'INCONSISTENT')
  assert.equal(migration.accepted, false)
  const denied = runtimeCatalog()
  assert.equal(denied.queries.find((item) => item.id === 'drizzle_rows').classification, 'PRIVILEGE_DENIED')
  const asPrivileged = privilegedCatalog()
  asPrivileged.queries = asPrivileged.queries.map((item) => item.id === 'drizzle_rows' ? { id: 'drizzle_rows', classification: 'PRIVILEGE_DENIED', reason: 'MIGRATION_LEDGER_NOT_READABLE_BY_ROLE' } : item)
  const ledger = evaluateCatalogCompleteness(asPrivileged).categories.find((category) => category.id === 'migration_history').queries.find((item) => item.id === 'drizzle_rows')
  assert.equal(ledger.classification, 'PRIVILEGE_DENIED')
  assert.equal(ledger.accepted, false)
})

test('the privileged plane is refused unless it is the admin login in one repeatable-read, read-only transaction', () => {
  assert.equal(evaluateCatalogCompleteness(privilegedCatalog()).planeVerdict, 'PLANE_ACCEPTED')
  const readCommitted = privilegedCatalog()
  readCommitted.identity = { ...readCommitted.identity, isolation: 'read committed' }
  assert.equal(evaluateCatalogCompleteness(readCommitted).reason, 'SNAPSHOT_ISOLATION_ABSENT')
  const otherLogin = privilegedCatalog()
  otherLogin.identity = { ...otherLogin.identity, user: 'azuresu', session_user: 'azuresu' }
  assert.equal(evaluateCatalogCompleteness(otherLogin).reason, 'PRIVILEGED_LOGIN_UNEXPECTED')
  const writable = privilegedCatalog()
  writable.identity = { ...writable.identity, transaction_read_only: 'off' }
  assert.equal(evaluateCatalogCompleteness(writable).reason, 'IDENTITY_REFUSED')
  const notRolledBack = privilegedCatalog({ rolledBack: false })
  assert.equal(evaluateCatalogCompleteness(notRolledBack).reason, 'ROLLBACK_FAILED')
  for (const blocker of ['EVIDENCE_RECIPIENT_MISSING', 'PRIVILEGED_CREDENTIAL_ABSENT', 'SEALING_FAILED']) {
    assert.equal(evaluateCatalogCompleteness(privilegedCatalog({ blocker })).reason, blocker)
  }
  const unknown = privilegedCatalog({ plane: 'superuser' })
  assert.equal(evaluateCatalogCompleteness(unknown).reason, 'UNKNOWN_PLANE')
})

test('sealed privileged evidence opens only with the founder key, intact and bound to its session', () => {
  const founder = generateRecipientKeyPair()
  const stranger = generateRecipientKeyPair()
  const sealed = sealPrivileged(privilegedCatalog(), founder.publicKey)
  const text = JSON.stringify(sealed)
  for (const value of Object.values(FIXTURE_COUNTS)) assert.equal(text.includes(`"n":"${value}"`), false)
  assert.equal(text.includes(FIXTURE_LEDGER[0].hash + '"'), false)
  const unopened = evaluateCatalogCompleteness(sealed)
  assert.equal(unopened.planeVerdict, 'PLANE_CAPTURED_SEALED')
  assert.equal(unopened.categories.find((category) => category.id === 'preservation_counts').accepted, false)
  const opened = openSealedCatalog(sealed, founder.privateKeyPem)
  assert.equal(opened.run, '45999999999')
  assert.deepEqual(opened.catalog.counts.map((item) => item.n), ['41', '7'])
  assert.deepEqual(opened.catalog.queries.find((item) => item.id === 'drizzle_rows').rows, FIXTURE_LEDGER)
  assert.equal(evaluateCatalogCompleteness(opened.catalog).planeVerdict, 'PLANE_ACCEPTED')
  assert.equal(JSON.stringify(opened.catalog).includes(sealed.sealed.ciphertext), false)

  assert.throws(() => openSealedCatalog(sealed, stranger.privateKeyPem), /SEALED_FOR_ANOTHER_RECIPIENT/)
  const tampered = structuredClone(sealed)
  const bytes = Buffer.from(tampered.sealed.ciphertext, 'base64')
  bytes[0] ^= 1
  tampered.sealed.ciphertext = bytes.toString('base64')
  assert.throws(() => openSealedCatalog(tampered, founder.privateKeyPem), /SEALED_EVIDENCE_TAMPERED/)
  const rebound = structuredClone(sealed)
  rebound.observedAt = '2026-11-26T12:00:00.000Z'
  assert.throws(() => openSealedCatalog(rebound, founder.privateKeyPem), /SEALED_EVIDENCE_UNBOUND/)
  const reAad = structuredClone(sealed)
  reAad.sealed.aad = reAad.sealed.aad.replace('45999999999', '45999999998')
  assert.throws(() => openSealedCatalog(reAad, founder.privateKeyPem), /SEALED_EVIDENCE_TAMPERED/)
  // Editing the clear summary breaks the binding to the clear-summary digest in the AAD.
  const extraClearRow = structuredClone(sealed)
  extraClearRow.counts.push({ schema: 'public', name: 'ghost', countScope: 'GLOBAL', globalTotal: true, classification: 'OBSERVED', n: null, sealed: true })
  assert.throws(() => openSealedCatalog(extraClearRow, founder.privateKeyPem), /SEALED_EVIDENCE_UNBOUND/)
  // Anyone holding the public key can seal: an envelope whose values disagree with its own
  // clear summary is refused even when its AAD is well formed.
  const forged = structuredClone(sealed)
  forged.sealed = sealForRecipient(JSON.stringify({ counts: [{ schema: 'public', name: 'members', n: '41' }], ledgers: [], modificationCounters: [], settledCounters: [] }), founder.publicKey, sealed.sealed.aad)
  assert.throws(() => openSealedCatalog(forged, founder.privateKeyPem), /SEALED_(COUNTS|LEDGER|COUNTERS)_INCONSISTENT/)
  // Truncated tag, IV, salt or ciphertext are refused before any decryption is attempted.
  for (const [field, cut] of [['tag', 4], ['iv', 8], ['salt', 8]]) {
    const short = structuredClone(sealed)
    short.sealed[field] = Buffer.from(sealed.sealed[field], 'base64').subarray(0, cut).toString('base64')
    assert.throws(() => openSealedCatalog(short, founder.privateKeyPem), /SEALED_EVIDENCE_TAMPERED/, field)
  }
  const truncated = structuredClone(sealed)
  truncated.sealed.ciphertext = Buffer.from(sealed.sealed.ciphertext, 'base64').subarray(0, 32).toString('base64')
  assert.throws(() => openSealedCatalog(truncated, founder.privateKeyPem), /SEALED_EVIDENCE_TAMPERED/)
  const badTag = structuredClone(sealed)
  const tagBytes = Buffer.from(sealed.sealed.tag, 'base64')
  tagBytes[15] ^= 0x80
  badTag.sealed.tag = tagBytes.toString('base64')
  assert.throws(() => openSealedCatalog(badTag, founder.privateKeyPem), /SEALED_EVIDENCE_TAMPERED/)
  // Swapping one run's envelope into another session is refused by the AAD binding.
  const other = sealPrivileged(privilegedCatalog({ observedAt: '2026-11-26T11:30:00.000Z', snapshot: '1020:1020:' }), founder.publicKey)
  const swapped = structuredClone(sealed)
  swapped.sealed = other.sealed
  assert.throws(() => openSealedCatalog(swapped, founder.privateKeyPem), /SEALED_EVIDENCE_UNBOUND/)
  // Fresh ephemeral key, salt and IV for every envelope.
  const again = sealPrivileged(privilegedCatalog(), founder.publicKey)
  for (const field of ['ephemeralPublicKey', 'salt', 'iv']) assert.notEqual(again.sealed[field], sealed.sealed[field], field)
  const counterDrift = sealPrivileged(privilegedCatalog(), founder.publicKey, { counters: [] })
  assert.throws(() => openSealedCatalog(counterDrift, founder.privateKeyPem), /SEALED_COUNTERS_INCONSISTENT/)
  assert.throws(() => openSealedCatalog(runtimeCatalog(), founder.privateKeyPem), /NOT_A_PRIVILEGED_SESSION/)
})

function chain(first, second) {
  const token = buildContinuationToken(first, { ...BINDING, sessionId: '1' }, Date.parse(first.observedAt))
  return reconcileCatalogSessions([{ catalog: first, observedAt: first.observedAt }, { catalog: second, token, observedAt: second.observedAt, now: Date.parse(second.observedAt) }], BINDING)
}

test('privileged sessions merge only when nothing moved between them, and are never called one snapshot', () => {
  const single = reconcileCatalogSessions([{ catalog: privilegedCatalog(), observedAt: privilegedCatalog().observedAt }], BINDING)
  assert.equal(single.consistency.atomicSnapshot, true)
  assert.equal(single.consistency.basis, 'ONE_REPEATABLE_READ_TRANSACTION')

  const baseline = privilegedCatalog()
  baseline.counts[1] = { ...baseline.counts[1], classification: 'NOT_ATTEMPTED', reason: 'COUNT_BUDGET', n: undefined }
  const continuation = privilegedCatalog({ observedAt: '2026-11-26T11:05:00.000Z', snapshot: '1010:1010:' })
  continuation.counts = [continuation.counts[1]]
  const merged = chain(baseline, continuation)
  assert.equal(merged.evaluation.planeVerdict, 'PLANE_ACCEPTED')
  assert.equal(merged.consistency.atomicSnapshot, false)
  assert.equal(merged.consistency.basis, 'MULTI_SESSION_NO_CHANGE_DETECTED')
  assert.match(merged.consistency.caveat, /not one atomic snapshot/)
  assert.match(merged.consistency.caveat, /statistics reset/)
  const unsettled = structuredClone(continuation)
  unsettled.statsSettledMs = 1000
  assert.equal(chain(baseline, unsettled).reason, 'STATS_SETTLE_UNPROVEN')
  const lateWrite = structuredClone(continuation)
  lateWrite.settledModificationDigest = 'f'.repeat(64)
  assert.equal(chain(baseline, lateWrite).reason, 'DATA_DRIFT_BETWEEN_SESSIONS', 'a write visible only after the settle interval is drift')
  const policyChanged = structuredClone(continuation)
  policyChanged.queries = policyChanged.queries.map((item) => item.id === 'relation_metadata' ? fixtureQuery('relation_metadata', [{ ...item.rows[0], policy_digest: '0'.repeat(32) }]) : item)
  assert.equal(chain(baseline, policyChanged).reason, 'RELATION_METADATA_DRIFT')

  const moved = structuredClone(continuation)
  moved.modificationDigest = 'b'.repeat(64)
  assert.equal(chain(baseline, moved).reason, 'DATA_DRIFT_BETWEEN_SESSIONS')
  const migrated = structuredClone(continuation)
  migrated.queries = migrated.queries.map((item) => item.id === 'drizzle_rows' ? { ...item, rows: [...item.rows, { id: 3, hash: 'ghi', created_at: '1' }], ledgerDigest: 'c'.repeat(64) } : item)
  assert.equal(chain(baseline, migrated).reason, 'MIGRATION_DRIFT')
  const altered = structuredClone(continuation)
  altered.queries = altered.queries.map((item) => item.id === 'structure' ? fixtureQuery('structure', [{ columns: 10, digest: 'e'.repeat(32) }]) : item)
  assert.equal(chain(baseline, altered).reason, 'STRUCTURE_DRIFT')
  const crossed = runtimeCatalog({ observedAt: '2026-11-26T11:05:00.000Z' })
  assert.equal(chain(baseline, crossed).reason, 'CONTINUATION_PLANE_CHANGED')
})

test('a runtime chain claims only what it compared: no statistics, no ledger, no snapshot', () => {
  const baseline = runtimeCatalog()
  baseline.counts[1] = { ...baseline.counts[1], classification: 'NOT_ATTEMPTED', reason: 'COUNT_BUDGET', n: undefined }
  const continuation = runtimeCatalog({ observedAt: '2026-11-26T11:05:00.000Z' })
  continuation.counts = [continuation.counts[1]]
  const merged = chain(baseline, continuation)
  assert.equal(merged.evaluation.planeVerdict, 'PLANE_ACCEPTED', merged.reason)
  assert.equal(merged.consistency.basis, 'MULTI_SESSION_STRUCTURE_UNCHANGED')
  assert.equal(merged.consistency.atomicSnapshot, false)
  assert.equal(merged.consistency.caveat, RUNTIME_CONSISTENCY_CAVEAT)
  assert.doesNotMatch(merged.consistency.caveat, /REPEATABLE READ|n_tup_|statistics flush|ledger(,| and per-table) .*identical/)
  assert.match(merged.consistency.caveat, /not detected/)
  assert.match(merged.consistency.caveat, /not one atomic snapshot/)
})

test('the complete preimage needs both planes, opened, on one inventory; it is never one snapshot', () => {
  const founder = generateRecipientKeyPair()
  const runtime = { catalog: runtimeCatalog() }
  const privileged = { catalog: openSealedCatalog(sealPrivileged(privilegedCatalog(), founder.publicKey), founder.privateKeyPem).catalog }
  const complete = reconcilePlanes({ runtime, privileged })
  assert.equal(complete.verdict, 'CATALOG_COMPLETE')
  assert.equal(complete.categories.length, CATALOG_CONTRACT.categories.length)
  assert.equal(complete.categories.find((category) => category.id === 'preservation_counts').source, 'privileged')
  assert.equal(complete.categories.find((category) => category.id === 'rls_policies').source, 'runtime')
  assert.equal(complete.consistency.crossPlaneAtomic, false)
  assert.equal(complete.S2_02_PREIMAGE_COMPLETE, 'NO')

  assert.equal(reconcilePlanes({ runtime }).reason, 'PLANE_EVIDENCE_MISSING')
  assert.equal(reconcilePlanes({ runtime, privileged: { catalog: sealPrivileged(privilegedCatalog(), founder.publicKey) } }).reason, 'PRIVILEGED_EVIDENCE_SEALED')
  assert.equal(reconcilePlanes({ runtime: privileged, privileged: runtime }).reason, 'PLANE_MISMATCH')
  const grown = { catalog: privilegedCatalog({ tables: [...privilegedCatalog().queries.find((item) => item.id === 'tables').rows, { schema: 'public', name: 'new_table' }] }) }
  assert.equal(reconcilePlanes({ runtime, privileged: grown }).reason, 'PLANE_INVENTORY_DRIFT')
  const reshaped = structuredClone(privileged)
  reshaped.catalog.queries = reshaped.catalog.queries.map((item) => item.id === 'structure' ? fixtureQuery('structure', [{ columns: 10, digest: 'e'.repeat(32) }]) : item)
  assert.equal(reconcilePlanes({ runtime, privileged: reshaped }).reason, 'PLANE_STRUCTURE_DRIFT')
  const partialPosture = { catalog: runtimeCatalog() }
  partialPosture.catalog.queries = partialPosture.catalog.queries.filter((item) => item.id !== 'policies')
  const partial = reconcilePlanes({ runtime: partialPosture, privileged })
  assert.equal(partial.verdict, 'CATALOG_PARTIAL')
  assert.equal(partial.categories.find((category) => category.id === 'rls_policies').accepted, false)
  const lostCount = structuredClone(privileged)
  lostCount.catalog.counts[0] = { ...lostCount.catalog.counts[0], classification: 'TIMED_OUT', n: null }
  assert.equal(reconcilePlanes({ runtime, privileged: lostCount }).verdict, 'CATALOG_PARTIAL')
})

test('the operator program reads catalogues without schema access, gates counts on privilege, and never writes', () => {
  const program = containerSource()
  assert.equal(program.includes('to_regclass'), false)
  assert.equal(/information_schema\.columns/.test(program), false)
  assert.match(program, /BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY/)
  assert.match(program, /has_table_privilege\(current_user, c\.oid, 'SELECT'\)/)
  assert.match(program, /PRIVILEGE_DENIED/)
  assert.match(program, /SET LOCAL statement_timeout = '15s'/)
  assert.match(program, /client\.query\('ROLLBACK'\)/)
  assert.equal(/\b(INSERT INTO|UPDATE \w+ SET|DELETE FROM|TRUNCATE|ALTER |GRANT |REVOKE |CREATE |DROP |SET row_security|COPY )/i.test(program.replace(/^\s*\/\/.*$/gm, '').replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/"(?:[^"\\]|\\.)*"/g, '""')), false)
  for (const statement of program.match(/"SELECT[^"]*"/g) ?? []) assert.equal(/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|GRANT|REVOKE|DROP)\b/i.test(statement.replace(/n_tup_(ins|upd|del)|'(INSERT|UPDATE|DELETE)'/g, '')), false, statement)
  // Privileged values are scrubbed before the frame is written, whatever happened.
  assert.match(program, /Never emit a privileged value in the clear/)
  assert.ok(program.indexOf('sensitive.counts.length = 0') < program.indexOf('const body = JSON.stringify(out)'))
})

test('the installer receipt is the v2 installed state: read only by the privileged plane, sealed, and absent only when the inventory proves it', () => {
  const history = (catalog) => evaluateCatalogCompleteness(catalog).categories.find((category) => category.id === 'migration_history')
  const receiptClass = (catalog) => history(catalog).queries.find((item) => item.id === 'installer_receipt').classification
  assert.equal(INSTALLER_RECEIPT, 'public.ue_v2_bootstrap_receipt')
  assert.ok(!PLANE_RESPONSIBILITY.runtime.includes('migration_history'), 'the runtime role is revoked from the receipt; it never supplies it')

  const privileged = privilegedCatalog()
  assert.equal(receiptClass(privileged), 'OBSERVED')
  assert.equal(history(privileged).accepted, true)

  // Evidence captured before this query existed (run 46084209107) does not satisfy migration history.
  const withoutReceipt = privilegedCatalog()
  withoutReceipt.queries = withoutReceipt.queries.filter((item) => item.id !== 'installer_receipt')
  assert.equal(receiptClass(withoutReceipt), 'NOT_ATTEMPTED')
  assert.equal(history(withoutReceipt).accepted, false)
  assert.notEqual(evaluateCatalogCompleteness(withoutReceipt).planeVerdict, 'PLANE_ACCEPTED')

  const absent = (catalog) => { catalog.queries = catalog.queries.map((item) => item.id === 'installer_receipt' ? { id: 'installer_receipt', classification: 'NOT_ATTEMPTED', reason: 'RELATION_NOT_IN_INVENTORY' } : item); return catalog }
  assert.equal(receiptClass(absent(privilegedCatalog())), 'ABSENT_VERIFIED')
  // Claimed absent, but the same session's inventory lists it: not proof of anything.
  const listed = absent(privilegedCatalog())
  listed.queries = listed.queries.map((item) => item.id === 'privilege_matrix' ? { ...item, rows: [...item.rows, { schema: 'public', name: 'ue_v2_bootstrap_receipt', owner: 'uev2admin', rls: false, force: false, schema_usage: true, can_select: true, acts_as_owner: true, rls_active: false }] } : item)
  assert.equal(receiptClass(listed), 'NOT_ATTEMPTED')
  const blind = absent(privilegedCatalog())
  blind.queries = blind.queries.map((item) => item.id === 'privilege_matrix' ? { id: 'privilege_matrix', error: 'permission denied' } : item)
  assert.equal(receiptClass(blind), 'NOT_ATTEMPTED')
  const denied = privilegedCatalog()
  denied.queries = denied.queries.map((item) => item.id === 'installer_receipt' ? { id: 'installer_receipt', classification: 'PRIVILEGE_DENIED', reason: 'INSTALLER_RECEIPT_NOT_READABLE_BY_ROLE' } : item)
  assert.equal(receiptClass(denied), 'PRIVILEGE_DENIED')
  const failed = privilegedCatalog()
  failed.queries = failed.queries.map((item) => item.id === 'installer_receipt' ? { id: 'installer_receipt', error: 'relation does not exist' } : item)
  assert.equal(receiptClass(failed), 'UNREADABLE')

  const founder = generateRecipientKeyPair()
  const sealed = sealPrivileged(privilegedCatalog(), founder.publicKey)
  const text = JSON.stringify(sealed)
  assert.equal(text.includes(FIXTURE_RECEIPT[0].source_digest), false)
  assert.equal(text.includes(FIXTURE_RECEIPT[0].catalog_digest), false)
  assert.equal(receiptClass(sealed), 'SEALED')
  assert.equal(evaluateCatalogCompleteness(sealed).planeVerdict, 'PLANE_CAPTURED_SEALED')
  const opened = openSealedCatalog(sealed, founder.privateKeyPem)
  assert.deepEqual(opened.catalog.queries.find((item) => item.id === 'installer_receipt').rows, FIXTURE_RECEIPT)
  assert.equal(evaluateCatalogCompleteness(opened.catalog).planeVerdict, 'PLANE_ACCEPTED')

  // An envelope re-sealed under the same binding must still agree with the clear row count and digest.
  const counts = Object.entries(FIXTURE_COUNTS).map(([key, n]) => ({ schema: key.split('.')[0], name: key.split('.')[1], n }))
  const drizzle = { relation: 'drizzle.__drizzle_migrations', rows: FIXTURE_LEDGER }
  const forge = (ledgers) => { const forged = structuredClone(sealed); forged.sealed = sealForRecipient(JSON.stringify({ counts, ledgers, modificationCounters: [], settledCounters: [] }), founder.publicKey, sealed.sealed.aad); return forged }
  const altered = [{ ...FIXTURE_RECEIPT[0], source_digest: '3'.repeat(64) }]
  assert.throws(() => openSealedCatalog(forge([drizzle, { relation: INSTALLER_RECEIPT, rows: altered }]), founder.privateKeyPem), /SEALED_LEDGER_INCONSISTENT/)
  assert.throws(() => openSealedCatalog(forge([drizzle]), founder.privateKeyPem), /SEALED_LEDGER_INCONSISTENT/)
  assert.throws(() => openSealedCatalog(forge([drizzle, { relation: INSTALLER_RECEIPT, rows: FIXTURE_RECEIPT }, { relation: INSTALLER_RECEIPT, rows: FIXTURE_RECEIPT }]), founder.privateKeyPem), /SEALED_LEDGER_INCONSISTENT/)
  assert.throws(() => openSealedCatalog(forge([drizzle, { relation: INSTALLER_RECEIPT, rows: FIXTURE_RECEIPT }, { relation: 'public.other', rows: [] }]), founder.privateKeyPem), /SEALED_LEDGER_INCONSISTENT/)
})
