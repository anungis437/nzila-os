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
  parseCatalogStdout,
  redact,
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

const MARK_BEGIN = 'UE_CATALOG_BEGIN'
const MARK_END = 'UE_CATALOG_END'

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

function hashBody(text) {
  const start = text.lastIndexOf(MARK_BEGIN)
  const end = text.lastIndexOf(MARK_END)
  if (start < 0 || end < start) return null
  const body = text.slice(start + MARK_BEGIN.length, end).trim()
  return { body, digest: createHash('sha256').update(body).digest('hex') }
}

function claimedDigest(text) {
  const match = text.match(/UE_CATALOG_SHA256 ([a-f0-9]{64})/)
  return match ? match[1] : null
}

export async function executeCatalogJob(env, spawn) {
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
  const fail = (code, defect) => {
    report.defects.push(defect)
    report.verdict = defect
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
  if (created.code !== 0) return fail(1, 'JOB_CREATION_FAILED')
  report.phases.create = 'DONE'

  let cleanup
  try {
    const started = await spawn('az', ['containerapp', 'job', 'start', '-g', RESOURCE_GROUP, '-n', name, '--query', 'name', '-o', 'tsv'])
    if (started.code !== 0) return fail(5, 'JOB_EXECUTION_FAILED')
    report.phases.start = 'DONE'
    const execution = started.stdout.trim()
    report.job.execution = execution
    const shown = await spawn('az', ['containerapp', 'job', 'execution', 'show', '-g', RESOURCE_GROUP, '-n', name, '--job-execution-name', execution, '--query', 'properties.status', '-o', 'tsv'])
    const status = shown.stdout.trim()
    report.executionStatus = status
    if (status === 'Running' || status === 'Unknown') return fail(5, 'JOB_EXECUTION_TIMED_OUT')
    if (status !== 'Succeeded' && status !== 'Failed') return fail(5, 'JOB_EXECUTION_FAILED')
    report.phases.observe = 'DONE'
    const logs = await spawn('az', ['containerapp', 'job', 'logs', 'show', '-g', RESOURCE_GROUP, '-n', name, '--execution', execution, '--container', 'catalog-operator', '--tail', '200'])
    const text = redact(`${logs.stdout}\n${logs.stderr}`)
    const hashed = hashBody(text)
    const parsed = parseCatalogStdout(text)
    report.phases.capture = hashed || parsed.body ? 'DONE' : 'MISSING'
    if (!hashed || !parsed.body) return fail(5, 'EVIDENCE_MISSING')
    const claimed = claimedDigest(text)
    if (!claimed || claimed !== hashed.digest) return fail(5, 'EVIDENCE_HASH_MISMATCH')
    report.evidenceSha256 = hashed.digest
    report.catalog = parsed.body
    report.verdict = parsed.verdict
    report.phases.verify = 'DONE'
    report.catalogAccepted = parsed.verdict === 'CATALOG_COMPLETE'
    if (parsed.body?.blocker === 'IDENTITY_REFUSED') return fail(5, 'DATABASE_IDENTITY_REFUSED')
    if (parsed.body?.blocker === 'DATABASE_URL_ABSENT' || /ECONNREFUSED|connection refused/i.test(parsed.body?.error ?? '')) return fail(5, 'DATABASE_CONNECTION_REFUSED')
    if (parsed.body?.identity?.transaction_read_only !== 'on' || parsed.body?.rolledBack !== true) return fail(5, 'READ_ONLY_TRANSACTION_UNPROVEN')
    if (!parsed.ok) return fail(5, parsed.verdict)
    return { exitCode: 0, report }
  } finally {
    cleanup = await cleanupOwnedJob(spawn, { name, runId: env.GITHUB_RUN_ID, source })
    report.phases.delete = cleanup.deleted ? 'DONE' : 'FAILED'
    report.cleanup = cleanup
    if (!cleanup.deleted) report.defects.push(cleanup.defect)
  }
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
  const result = spawnSync(executable, args, { encoding: 'utf8' })
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
