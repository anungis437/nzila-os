import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import {
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
} from './ue-v2-staging-catalog-exec.mjs'

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

function completeCatalog() {
  const queries = [
    query('identity', [{ version: 'PostgreSQL 16', database: 'ue_v2_staging', user: 'union_eyes_runtime', transaction_read_only: 'on' }]),
    query('migration_relations', [{ schema: 'drizzle', name: '__drizzle_migrations' }]),
    query('migration_columns', [{ table_schema: 'drizzle', table_name: '__drizzle_migrations', column_name: 'hash', data_type: 'text' }]),
    query('drizzle_rows', [{ id: 1, hash: 'abc', created_at: '2026-01-01' }]),
    query('roles', [{ rolname: 'union_eyes_runtime', rolsuper: false, rolbypassrls: false, rolcanlogin: true }]),
    query('memberships', []),
    query('relations', [{ schema: 'public', name: 'members', relkind: 'r' }]),
    query('rls', [{ schema: 'public', name: 'members', relrowsecurity: true, relforcerowsecurity: true }]),
    query('policies', []),
    query('function', [{ schema: 'user_management', name: 'auth_business_org_authorized', args: 'uuid, text[]' }]),
    query('security_definer', []),
    query('event_trigger', [{ evtname: 'ue_guard_deadline_reassignment_convergence_policy', evtenabled: 'O' }]),
    query('audit', [{ rel: 'audit_security.audit_logs', current_select: false, current_insert: false }]),
    query('audit_grants', []),
    query('sequences', []),
    query('tables', [{ schema: 'public', name: 'members' }]),
  ]
  return {
    schema: CATALOG_SCHEMA,
    rolledBack: true,
    identity: { version: 'PostgreSQL 16', database: 'ue_v2_staging', user: 'union_eyes_runtime', transaction_read_only: 'on' },
    queries,
    counts: [{ schema: 'public', name: 'members', visibleToConnectedRole: true, globalTotal: false, classification: 'OBSERVED', n: '1' }],
  }
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
  assert.equal(result.exitCode, 0)
  assert.equal(result.report.execPermission, 'EFFECTIVE_ALLOW_OBSERVED')
  assert.equal(result.report.execAttempted, true)
  assert.equal(result.report.catalog.identity.user, 'union_eyes_runtime')
  assert.equal(result.report.verdict, 'CATALOG_COMPLETE')
  assert.equal(result.report.catalog.evaluation.verdict, 'CATALOG_COMPLETE')
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
  assert.equal(run.status, 0, run.stderr)
  assert.match(run.stdout, /catalog=CATALOG_COMPLETE/)
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
  const withQuery = (id, replacement) => {
    const body = completeCatalog()
    body.queries = body.queries.map((item) => item.id === id ? replacement : item)
    return body
  }
  const classification = (body, id) => evaluateCatalogCompleteness(body).categories.flatMap((category) => category.queries ?? []).find((item) => item.id === id)?.classification

  assert.equal(verdictOf(completeCatalog()), 'CATALOG_COMPLETE')

  const empty = completeCatalog()
  empty.queries = []
  const emptyRun = await executeCatalog(liveEnv(), harness({ catalogStdout: marked(empty) }).spawn)
  assert.equal(emptyRun.exitCode, 5)
  assert.equal(emptyRun.report.verdict, 'CATALOG_PARTIAL')
  assert.equal(emptyRun.report.S2_02_PREIMAGE_COMPLETE, 'NO')

  const omitted = completeCatalog()
  omitted.queries = omitted.queries.filter((item) => !['policies', 'security_definer', 'event_trigger', 'migration_columns'].includes(item.id))
  assert.equal(verdictOf(omitted), 'CATALOG_PARTIAL')

  const verifiedLedger = withQuery('drizzle_rows', { id: 'drizzle_rows', classification: 'NOT_ATTEMPTED', reason: 'RELATION_NOT_IN_DISCOVERY' })
  verifiedLedger.queries = verifiedLedger.queries.map((item) => item.id === 'migration_relations' ? query('migration_relations', []) : item)
  assert.equal(classification(verifiedLedger, 'drizzle_rows'), 'ABSENT_VERIFIED')
  assert.equal(verdictOf(verifiedLedger), 'CATALOG_COMPLETE')

  const ledgerError = withQuery('drizzle_rows', { id: 'drizzle_rows', error: 'relation "drizzle.__drizzle_migrations" does not exist' })
  assert.equal(classification(ledgerError, 'drizzle_rows'), 'UNREADABLE')
  assert.equal(verdictOf(ledgerError), 'CATALOG_PARTIAL')

  const audit = await executeCatalog(liveEnv(), harness({ catalogStdout: marked(withQuery('audit', { id: 'audit', error: 'permission denied for relation audit_logs' })) }).spawn)
  assert.equal(audit.exitCode, 5)
  assert.equal(audit.report.verdict, 'CATALOG_PARTIAL')
  assert.equal(classification(audit.report.catalog, 'audit'), 'UNREADABLE')

  assert.equal(verdictOf(withQuery('rls', { id: 'rls', error: 'permission denied for table pg_class' })), 'CATALOG_PARTIAL')
  assert.equal(verdictOf(withQuery('event_trigger', { id: 'event_trigger', error: 'permission denied for table pg_event_trigger' })), 'CATALOG_PARTIAL')

  const absentFunction = withQuery('function', { id: 'function', rowCount: 0, rows: [] })
  const absentEvaluation = evaluateCatalogCompleteness(absentFunction)
  assert.equal(absentEvaluation.verdict, 'CATALOG_COMPLETE')
  assert.equal(classification(absentFunction, 'function'), 'ABSENT_VERIFIED')
  assert.equal(absentEvaluation.legacyObservation, 'LEGACY_TRANSITION_REQUIRED')
  assert.equal(absentEvaluation.S2_02_LEGACY_GATE, 'INDETERMINATE')
  assert.equal(absentEvaluation.S2_02_PREIMAGE_COMPLETE, 'NO')

  const wrongSchema = completeCatalog()
  wrongSchema.schema = 'ue-v2-staging-catalog/v1'
  assert.equal(verdictOf(wrongSchema), 'CATALOG_REFUSED')
  assert.equal(evaluateCatalogCompleteness(wrongSchema).reason, 'UNEXPECTED_SCHEMA_VERSION')

  const capped = completeCatalog()
  capped.counts = [{ schema: 'public', name: 'members', visibleToConnectedRole: true, globalTotal: false, classification: 'NOT_ATTEMPTED', reason: 'COUNT_BUDGET' }]
  const cap = evaluateCatalogCompleteness(capped)
  assert.equal(cap.verdict, 'CATALOG_PARTIAL')
  assert.match(cap.additionalProcedure, /NOT_ATTEMPTED/)

  const timedCount = completeCatalog()
  timedCount.counts = [{ schema: 'public', name: 'members', visibleToConnectedRole: true, globalTotal: false, classification: 'TIMED_OUT', error: 'canceling statement due to statement timeout' }]
  assert.equal(verdictOf(timedCount), 'CATALOG_PARTIAL')

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
