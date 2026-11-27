/**
 * One owned, private-network catalogue job. It does not open a Container Apps
 * exec console, does not pass a database URL on the command line, and does not
 * call the forward-upgrade operator.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  CONTAINER_APP,
  EXPECTED_DATABASE,
  EXPECTED_IMAGE,
  EXPECTED_REVISION,
  RESOURCE_GROUP,
  SUBSCRIPTION_ID,
  TENANT_ID,
  EVIDENCE_CHUNK_CHARS,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_CHUNKS,
  parseCatalogStdout,
  revisionDefect,
  writeReport,
} from './ue-v2-staging-catalog-exec.mjs'

export const REPOSITORY = 'anungis437/nzila-os'
export const ENVIRONMENT_NAME = 'nzila-ue-v2-staging-env'
export const STAGING_HOST = 'nzila-ue-v2-staging-db-d562ba7f.postgres.database.azure.com'
export const KEY_VAULT_SECRET = 'https://nzila-ue-v2-staging-kv.vault.azure.net/secrets/database-url'
export const IDENTITY = `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/nzila-ue-v2-staging-id`
export const JOB_PURPOSE = 's202-private-catalog'
export const OPERATOR_IMAGE_RE = /^nzilaventuresacr\.azurecr\.io\/nzila-os-union-eyes-v2-catalog@sha256:[a-f0-9]{64}$/
export { EVIDENCE_CHUNK_CHARS, EVIDENCE_MAX_BYTES, EVIDENCE_MAX_CHUNKS }
export const AZ_LOG_TAIL_MAX = 300
export const EVIDENCE_LINE_BUDGET = 4096
export const EVIDENCE_TAIL_LINES = AZ_LOG_TAIL_MAX
export const LOG_STDOUT_MAX_BYTES = 1024 * 1024
export const OBSERVE_DEADLINE_MS = 240000
export const OBSERVE_INTERVAL_MS = 5000
export const STOP_DEADLINE_MS = 30000

const MARK_BEGIN = 'UE_CATALOG_BEGIN'
const MARK_END = 'UE_CATALOG_END'
const TERMINAL_FAILURE = new Set(['Failed', 'Stopped', 'Cancelled', 'Degraded'])

export function jobNameForRun(runId) {
  if (!/^[0-9]{1,12}$/.test(String(runId ?? ''))) throw new Error('RUN_ID_REFUSED')
  const name = `ue-s202-cat-${runId}`
  if (name.length > 32) throw new Error('JOB_NAME_REFUSED')
  return name
}

export function assertStagingTarget(target) {
  const group = String(target?.resourceGroup ?? '')
  const database = String(target?.database ?? '')
  const host = String(target?.host ?? '')
  if (group !== RESOURCE_GROUP || /prod/i.test(group)) return 'WRONG_ENVIRONMENT'
  if (database !== EXPECTED_DATABASE || /prod/i.test(database)) return 'WRONG_ENVIRONMENT'
  if (host !== STAGING_HOST || /prod/i.test(host)) return 'WRONG_ENVIRONMENT'
  return null
}

export function operatorImageDefect(image) {
  if (image === EXPECTED_IMAGE || !OPERATOR_IMAGE_RE.test(String(image ?? ''))) return 'OPERATOR_IMAGE_UNQUALIFIED'
  return null
}

export function ownedJobDefect(job, expected) {
  if (job?.name !== expected.name) return 'UNOWNED_JOB'
  if (job?.tags?.purpose !== JOB_PURPOSE) return 'UNOWNED_JOB'
  if (job?.tags?.runId !== expected.runId) return 'UNOWNED_JOB'
  if (job?.tags?.source !== expected.source) return 'UNOWNED_JOB'
  return null
}

export function jobSpecification(options) {
  const name = jobNameForRun(options.runId)
  return {
    location: 'canadacentral',
    identity: { type: 'UserAssigned', userAssignedIdentities: { [IDENTITY]: {} } },
    tags: { purpose: JOB_PURPOSE, runId: options.runId, source: options.source, owner: 'ue-v2-staging-catalog-job' },
    properties: {
      environmentId: `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.App/managedEnvironments/${ENVIRONMENT_NAME}`,
      workloadProfileName: 'Consumption',
      configuration: {
        triggerType: 'Manual',
        replicaTimeout: 300,
        replicaRetryLimit: 0,
        manualTriggerConfig: { parallelism: 1, replicaCompletionCount: 1 },
        registries: [{ server: 'nzilaventuresacr.azurecr.io', identity: IDENTITY }],
        secrets: [{ name: 'database-url', keyVaultUrl: KEY_VAULT_SECRET, identity: IDENTITY }],
      },
      template: { containers: [{
        name: 'catalog-operator',
        image: options.image,
        resources: { cpu: 0.5, memory: '1Gi' },
        env: [
          { name: 'UE_CATALOG_TRANSPORT', value: 'private-job' },
          { name: 'UE_CATALOG_RUN_ID', value: options.runId },
          { name: 'PGHOST', value: STAGING_HOST },
          { name: 'PGDATABASE', value: EXPECTED_DATABASE },
          { name: 'DATABASE_URL', secretRef: 'database-url' },
        ],
      }] },
    },
    name,
  }
}

export function frameCatalog(body) {
  const json = String(body)
  const digest = createHash('sha256').update(json).digest('hex')
  if (json.length > EVIDENCE_MAX_BYTES || Math.ceil(json.length / EVIDENCE_CHUNK_CHARS) > EVIDENCE_MAX_CHUNKS) {
    return { text: `UE_CATALOG_FRAME v1 chunks=0 sha256=${digest} bytes=${json.length} overflow=1\n`, digest, overflow: true }
  }
  const count = Math.max(1, Math.ceil(json.length / EVIDENCE_CHUNK_CHARS))
  const lines = []
  for (let index = 0; index < count; index += 1) {
    const line = `UE_CATALOG_CHUNK ${index + 1}/${count} ${json.slice(index * EVIDENCE_CHUNK_CHARS, (index + 1) * EVIDENCE_CHUNK_CHARS)}`
    if (line.length > EVIDENCE_LINE_BUDGET) throw new Error('EVIDENCE_LINE_BUDGET')
    lines.push(line)
  }
  lines.push(`UE_CATALOG_FRAME v1 chunks=${count} sha256=${digest} bytes=${json.length}`, MARK_END, `UE_CATALOG_SHA256 ${digest}`)
  if (lines.length > AZ_LOG_TAIL_MAX) {
    return { text: `UE_CATALOG_FRAME v1 chunks=0 sha256=${digest} bytes=${json.length} overflow=1\n`, digest, overflow: true }
  }
  return { text: `${lines.join('\n')}\n`, digest, overflow: false, chunks: count }
}

export function reassembleCatalog(text) {
  const frame = String(text).match(/UE_CATALOG_FRAME v1 chunks=(\d+) sha256=([a-f0-9]{64}) bytes=(\d+)( overflow=1)?/)
  if (!frame) return { ok: false, defect: 'EVIDENCE_MISSING' }
  if (frame[4] || Number(frame[3]) > EVIDENCE_MAX_BYTES) return { ok: false, defect: 'EVIDENCE_TRANSPORT_EXCEEDED' }
  const total = Number(frame[1])
  const expected = frame[2]
  if (!Number.isInteger(total) || total < 1 || total > EVIDENCE_MAX_CHUNKS) return { ok: false, defect: 'EVIDENCE_TRANSPORT_EXCEEDED' }
  const parts = new Array(total).fill(null)
  for (const line of String(text).split('\n')) {
    const match = line.match(/UE_CATALOG_CHUNK (\d+)\/(\d+) (.*)$/)
    if (!match) continue
    const index = Number(match[1])
    if (Number(match[2]) !== total || index < 1 || index > total) return { ok: false, defect: 'EVIDENCE_MISSING' }
    if (parts[index - 1] != null && parts[index - 1] !== match[3]) return { ok: false, defect: 'EVIDENCE_HASH_MISMATCH' }
    parts[index - 1] = match[3]
  }
  if (!String(text).includes(MARK_END) || parts.some((part) => part == null)) return { ok: false, defect: 'EVIDENCE_MISSING' }
  const body = parts.join('')
  const digest = createHash('sha256').update(body).digest('hex')
  if (digest !== expected || body.length !== Number(frame[3])) return { ok: false, defect: 'EVIDENCE_HASH_MISMATCH' }
  return { ok: true, body, digest }
}

function isTerminal(status) {
  return status === 'Succeeded' || TERMINAL_FAILURE.has(status)
}

async function pollExecution(spawn, target, clock, deadlineMs) {
  const deadlineAt = clock.now() + deadlineMs
  const observations = []
  let status = 'Unknown'
  while (clock.now() <= deadlineAt) {
    const shown = await spawn('az', ['containerapp', 'job', 'execution', 'show', '-g', RESOURCE_GROUP, '-n', target.name, '--job-execution-name', target.execution, '--query', 'properties.status', '-o', 'tsv'])
    if (shown.code !== 0) {
      observations.push({ status: 'UNREAD', at: clock.now() })
    } else {
      status = shown.stdout.trim()
      observations.push({ status, at: clock.now() })
      if (isTerminal(status)) return { status, observations, timedOut: false }
    }
    if (clock.now() >= deadlineAt) break
    const before = clock.now()
    await clock.sleep(clock.intervalMs)
    if (clock.now() <= before) break
  }
  return { status, observations, timedOut: true }
}

async function reconcileCreatedJob(spawn, expected) {
  const shown = await spawn('az', ['containerapp', 'job', 'show', '-g', RESOURCE_GROUP, '-n', expected.name, '-o', 'json'])
  if (shown.code !== 0) {
    if (/not found|ResourceNotFound/i.test(`${shown.stdout}\n${shown.stderr}`)) return { deleted: false, defect: null, absent: true }
    return { deleted: false, defect: 'JOB_CLEANUP_UNPROVEN' }
  }
  let job
  try { job = JSON.parse(shown.stdout) } catch { return { deleted: false, defect: 'JOB_CLEANUP_UNPROVEN' } }
  if (ownedJobDefect(job, expected)) return { deleted: false, defect: null, reason: 'UNOWNED_JOB' }
  return cleanupOwnedJob(spawn, expected)
}

export async function executeCatalogJob(env, spawn, options = {}) {
  const report = {
    schema: 'ue-v2-staging-catalog-job/v1',
    defects: [],
    phases: { preflight: 'NOT_RUN', validate: 'NOT_RUN', create: 'NOT_RUN', start: 'NOT_RUN', observe: 'NOT_RUN', capture: 'NOT_RUN', verify: 'NOT_RUN', delete: 'NOT_RUN' },
    S2_02_PREIMAGE_COMPLETE: 'NO',
    S2_02_LEGACY_GATE: 'INDETERMINATE',
    catalogAccepted: false,
    job: null,
    catalog: null,
  }
  const clock = {
    now: options.now ?? (() => Date.now()),
    sleep: options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms))),
    intervalMs: options.intervalMs ?? OBSERVE_INTERVAL_MS,
  }
  const fail = (code, defect) => {
    if (defect && !report.defects.includes(defect)) report.defects.push(defect)
    report.verdict = defect
    report.catalogAccepted = false
    return { exitCode: code, report }
  }
  if (env.UE_CATALOG_JOB_LIVE !== '1' || env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
    return fail(1, 'WRONG_ENVIRONMENT')
  }
  const targetDefect = assertStagingTarget({ resourceGroup: RESOURCE_GROUP, database: EXPECTED_DATABASE, host: STAGING_HOST })
  if (targetDefect) return fail(1, targetDefect)
  if (assertStagingTarget(env.UE_CATALOG_TARGET ? JSON.parse(env.UE_CATALOG_TARGET) : { resourceGroup: RESOURCE_GROUP, database: EXPECTED_DATABASE, host: STAGING_HOST })) {
    return fail(1, 'WRONG_ENVIRONMENT')
  }
  report.phases.preflight = 'DONE'

  const account = await spawn('az', ['account', 'show', '--query', '{subscriptionId:id,tenantId:tenantId}', '-o', 'json'])
  if (account.code !== 0) return fail(1, 'WRONG_SUBSCRIPTION')
  const accountBody = JSON.parse(account.stdout)
  if (accountBody.subscriptionId !== SUBSCRIPTION_ID) return fail(1, 'WRONG_SUBSCRIPTION')
  if (accountBody.tenantId !== TENANT_ID) return fail(1, 'WRONG_TENANT')
  const imageDefect = operatorImageDefect(env.OPERATOR_IMAGE)
  if (imageDefect) return fail(1, imageDefect)
  const revision = await spawn('az', ['containerapp', 'revision', 'show', '-g', RESOURCE_GROUP, '-n', CONTAINER_APP, '--revision', EXPECTED_REVISION, '--query', '{name:name,healthState:properties.healthState,trafficWeight:properties.trafficWeight,containers:properties.template.containers[].{name:name,image:image}}', '-o', 'json'])
  if (revision.code !== 0) return fail(4, 'REVISION_BINDING_CHANGED')
  const revisionBody = JSON.parse(revision.stdout)
  if (revisionDefect(revisionBody)) return fail(4, 'REVISION_BINDING_CHANGED')
  const secrets = await spawn('az', ['containerapp', 'show', '-g', RESOURCE_GROUP, '-n', CONTAINER_APP, '--query', 'properties.configuration.secrets[].name', '-o', 'json'])
  if (secrets.code !== 0 || !JSON.parse(secrets.stdout).includes('database-url')) return fail(1, 'RUNTIME_SECRET_UNAVAILABLE')
  report.phases.validate = 'DONE'
  report.revision = { name: revisionBody.name, image: EXPECTED_IMAGE }

  const name = jobNameForRun(env.GITHUB_RUN_ID)
  const source = env.GITHUB_SHA
  const spec = jobSpecification({ image: env.OPERATOR_IMAGE, runId: env.GITHUB_RUN_ID, source })
  const serialized = JSON.stringify(spec)
  if (/postgres(?:ql)?:\/\//i.test(serialized) || serialized.includes('PGPASSWORD') || serialized.includes('UE_V2_STAGING_DB_ADMIN_PASSWORD')) {
    return fail(1, 'JOB_CREATION_FAILED')
  }
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-catalog-job-'))
  const manifest = path.join(directory, 'job.json')
  writeFileSync(manifest, serialized)
  report.job = { name, source, purpose: JOB_PURPOSE }
  const created = await spawn('az', ['containerapp', 'job', 'create', '-g', RESOURCE_GROUP, '-n', name, '--yaml', manifest, '-o', 'none'])
  rmSync(directory, { recursive: true, force: true })
  const expectedJob = { name, runId: env.GITHUB_RUN_ID, source }
  if (created.code !== 0) {
    report.phases.create = 'FAILED'
    const reconciliation = await reconcileCreatedJob(spawn, expectedJob)
    report.cleanup = reconciliation
    if (reconciliation.defect) report.defects.push(reconciliation.defect)
    return fail(1, 'JOB_CREATION_FAILED')
  }
  report.phases.create = 'DONE'

  let result
  let release = false
  try {
    const started = await spawn('az', ['containerapp', 'job', 'start', '-g', RESOURCE_GROUP, '-n', name, '--query', 'name', '-o', 'tsv'])
    if (started.code !== 0) {
      const reconciliation = await reconcileCreatedJob(spawn, expectedJob)
      report.cleanup = reconciliation
      if (reconciliation.defect) report.defects.push(reconciliation.defect)
      result = fail(5, 'JOB_EXECUTION_FAILED')
    } else {
      report.phases.start = 'DONE'
      const execution = started.stdout.trim()
      report.job.execution = execution
      let observed = await pollExecution(spawn, { name, execution }, clock, options.deadlineMs ?? OBSERVE_DEADLINE_MS)
      report.executionObservations = observed.observations
      if (observed.timedOut) {
        const stopped = await spawn('az', ['containerapp', 'job', 'stop', '-g', RESOURCE_GROUP, '-n', name, '--job-execution-name', execution, '-o', 'none'])
        report.stop = { code: stopped.code }
        if (stopped.code === 0) {
          const afterStop = await pollExecution(spawn, { name, execution }, clock, options.stopDeadlineMs ?? STOP_DEADLINE_MS)
          report.executionObservations = report.executionObservations.concat(afterStop.observations)
          observed = afterStop
        }
      }
      report.executionStatus = observed.status
      if (!isTerminal(observed.status)) {
        report.phases.observe = 'TIMED_OUT'
        report.phases.delete = 'HELD'
        report.cleanup = { deleted: false, defect: 'JOB_CLEANUP_UNPROVEN', reason: 'EXECUTION_STILL_RUNNING', name }
        report.defects.push('JOB_CLEANUP_UNPROVEN')
        result = fail(5, 'JOB_EXECUTION_TIMED_OUT')
      } else {
        release = true
        report.phases.observe = 'DONE'
        const logs = await spawn('az', ['containerapp', 'job', 'logs', 'show', '-g', RESOURCE_GROUP, '-n', name, '--execution', execution, '--container', 'catalog-operator', '--tail', String(EVIDENCE_TAIL_LINES)])
        if (logs.transport === 'STDOUT_LIMIT' || logs.code !== 0) {
          if (!report.defects.includes('EVIDENCE_TRANSPORT_EXCEEDED')) report.defects.push('EVIDENCE_TRANSPORT_EXCEEDED')
          result = fail(5, observed.status === 'Succeeded' ? 'EVIDENCE_TRANSPORT_EXCEEDED' : 'JOB_EXECUTION_FAILED')
        } else {
          const assembled = reassembleCatalog(logs.stdout)
          const parsed = assembled.ok ? parseCatalogStdout(`${MARK_BEGIN}\n${assembled.body}\n${MARK_END}\n`) : null
          report.phases.capture = parsed?.body ? 'DONE' : 'MISSING'
          if (assembled.digest) report.evidenceSha256 = assembled.digest
          if (parsed?.body) report.catalog = parsed.body
          if (parsed?.verdict) report.diagnostics = parsed.verdict
          if (observed.status !== 'Succeeded') {
            if (assembled.defect) report.defects.push(assembled.defect)
            result = fail(5, 'JOB_EXECUTION_FAILED')
          } else if (!assembled.ok) {
            result = fail(5, assembled.defect)
          } else {
            report.verdict = parsed.verdict
            report.phases.verify = 'DONE'
            report.catalogAccepted = parsed.verdict === 'CATALOG_COMPLETE'
            if (parsed.body?.blocker === 'IDENTITY_REFUSED') result = fail(5, 'DATABASE_IDENTITY_REFUSED')
            else if (parsed.body?.blocker === 'DATABASE_URL_ABSENT' || /ECONNREFUSED|connection refused/i.test(parsed.body?.error ?? '')) result = fail(5, 'DATABASE_CONNECTION_REFUSED')
            else if (parsed.body?.identity?.transaction_read_only !== 'on' || parsed.body?.rolledBack !== true) result = fail(5, 'READ_ONLY_TRANSACTION_UNPROVEN')
            else if (!parsed.ok) result = fail(5, parsed.verdict)
            else result = { exitCode: 0, report }
          }
        }
      }
    }
  } finally {
    if (release) {
      const cleanup = await cleanupOwnedJob(spawn, expectedJob)
      report.phases.delete = cleanup.deleted ? 'DONE' : 'FAILED'
      report.cleanup = cleanup
      if (!cleanup.deleted) {
        report.catalogAccepted = false
        if (!report.defects.includes(cleanup.defect)) report.defects.push(cleanup.defect)
        if (result && result.exitCode === 0) result.exitCode = 6
      }
    }
  }
  return result
}

export async function cleanupOwnedJob(spawn, expected) {
  const shown = await spawn('az', ['containerapp', 'job', 'show', '-g', RESOURCE_GROUP, '-n', expected.name, '-o', 'json'])
  if (shown.code !== 0) return { deleted: false, defect: 'JOB_CLEANUP_UNPROVEN' }
  let job
  try { job = JSON.parse(shown.stdout) } catch { return { deleted: false, defect: 'JOB_CLEANUP_UNPROVEN' } }
  const ownership = ownedJobDefect(job, expected)
  if (ownership) return { deleted: false, defect: 'JOB_CLEANUP_FAILED', reason: ownership }
  const removed = await spawn('az', ['containerapp', 'job', 'delete', '-g', RESOURCE_GROUP, '-n', expected.name, '--yes', '-o', 'none'])
  if (removed.code !== 0) return { deleted: false, defect: 'JOB_CLEANUP_FAILED' }
  const after = await spawn('az', ['containerapp', 'job', 'show', '-g', RESOURCE_GROUP, '-n', expected.name, '-o', 'json'])
  if (after.code === 0) return { deleted: false, defect: 'JOB_CLEANUP_UNPROVEN' }
  return { deleted: true, defect: null }
}

export function launch(executable, args) {
  const result = spawnSync(executable, args, { encoding: 'utf8', maxBuffer: LOG_STDOUT_MAX_BYTES })
  if (result.error) {
    const limited = result.error.code === 'ENOBUFS' || result.error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'
    return { code: result.status ?? 1, stdout: '', stderr: limited ? 'STDOUT_LIMIT' : String(result.error.message), transport: limited ? 'STDOUT_LIMIT' : 'SPAWN_ERROR' }
  }
  return { code: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (invoked) {
  const outFlag = process.argv.indexOf('--out')
  const directory = outFlag >= 0 ? process.argv[outFlag + 1] : ''
  if (!directory) {
    console.error('CATALOG_OUTPUT_REQUIRED')
    process.exit(1)
  }
  const result = await executeCatalogJob(process.env, launch)
  if (result.report.cleanup && !result.report.cleanup.deleted && !result.report.defects.includes(result.report.cleanup.defect)) {
    result.report.defects.push(result.report.cleanup.defect)
  }
  mkdirSync(directory, { recursive: true })
  const digest = writeReport(directory, result.report)
  console.log(`catalog=${result.report.verdict ?? 'CATALOG_REFUSED'} sha256=${digest} defects=${result.report.defects.join(',')} S2_02_PREIMAGE_COMPLETE=NO`)
  process.exit(result.report.defects.includes('JOB_CLEANUP_FAILED') || result.report.defects.includes('JOB_CLEANUP_UNPROVEN') ? 6 : result.exitCode)
}
