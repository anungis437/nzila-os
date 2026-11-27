/**
 * One owned, private-network catalogue job. It does not open a Container Apps
 * exec console, does not pass a database URL on the command line, and does not
 * call the forward-upgrade operator.
 *
 * Evidence transport: the job writes a v2 frame (exact UTF-8 bytes, base64 per
 * line, one nonce per session) to stdout. The managed environment ships job
 * stdout to its own Log Analytics workspace; the controller queries that
 * workspace with the deploy identity's existing Monitoring Contributor grant,
 * accepting only lines bound to this run's job, execution, container and image
 * digest. It does not use the replica log-stream proxy, whose replica can be gone
 * after completion and which shares the console proxy that returned HTTP 404.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  CATALOG_CONTRACT,
  CATALOG_SCHEMA,
  CONTAINER_APP,
  EVIDENCE_CHUNK_BYTES,
  EVIDENCE_FRAME,
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_CHUNKS,
  EXPECTED_DATABASE,
  EXPECTED_IMAGE,
  EXPECTED_REVISION,
  RESOURCE_GROUP,
  RUNTIME_LOGIN,
  RUNTIME_ROLE,
  SUBSCRIPTION_ID,
  buildContinuationToken,
  continuationDefect,
  reconcileCatalogSessions,
  TENANT_ID,
  parseCatalogStdout,
  revisionDefect,
  writeReport,
} from './ue-v2-staging-catalog-exec.mjs'

export const REPOSITORY = 'anungis437/nzila-os'
export const ENVIRONMENT_NAME = 'nzila-ue-v2-staging-env'
export const STAGING_HOST = 'nzila-ue-v2-staging-db-d562ba7f.postgres.database.azure.com'
export const KEY_VAULT_SECRET = 'https://nzila-ue-v2-staging-kv.vault.azure.net/secrets/database-url'
export const IDENTITY = `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.ManagedIdentity/userAssignedIdentities/nzila-ue-v2-staging-id`
export const ENVIRONMENT_ID = `/subscriptions/${SUBSCRIPTION_ID}/resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.App/managedEnvironments/${ENVIRONMENT_NAME}`
export const JOB_PURPOSE = 's202-private-catalog'
export const JOB_OWNER = 'ue-v2-staging-catalog-job'
export const OPERATOR_CONTAINER = 'catalog-operator'
export const OPERATOR_IMAGE_RE = /^nzilaventuresacr\.azurecr\.io\/nzila-os-union-eyes-v2-catalog@sha256:[a-f0-9]{64}$/
export { EVIDENCE_CHUNK_BYTES, EVIDENCE_MAX_BYTES, EVIDENCE_MAX_CHUNKS }
// One Log Analytics page: 200 lines of about 8 KB stays far under the 64 MB response limit.
export const LOG_PAGE_CHUNKS = 200
export const PROCESS_STDOUT_MAX_BYTES = 64 * 1024 * 1024
export const OBSERVE_DEADLINE_MS = 240000
export const OBSERVE_INTERVAL_MS = 5000
export const STOP_DEADLINE_MS = 60000
// Container Apps console logs usually reach the workspace within minutes.
export const INGEST_DEADLINE_MS = 15 * 60 * 1000
export const INGEST_INTERVAL_MS = 20000
export const DELETE_ATTEMPTS = 3

const TERMINAL_FAILURE = new Set(['Failed', 'Stopped', 'Cancelled', 'Degraded'])
const NOT_FOUND = /ResourceNotFound|ResourceGroupNotFound|could not be found|was not found|\(NotFound\)|Code: NotFound/i
const HEX64 = /^[a-f0-9]{64}$/
const NONCE = /^[a-f0-9]{32}$/
const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/

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

/**
 * Exact ownership: the run-derived name is necessary but not sufficient. The job
 * must also carry this run's tags, this operator image, this environment, and
 * the staging identity. Anything else is never deleted.
 */
export function ownedJobDefect(job, expected) {
  if (job?.name !== expected.name) return 'UNOWNED_JOB'
  const tags = job?.tags ?? {}
  if (tags.purpose !== JOB_PURPOSE || tags.owner !== JOB_OWNER) return 'UNOWNED_JOB'
  if (tags.runId !== expected.runId || tags.source !== expected.source) return 'UNOWNED_JOB'
  const properties = job?.properties ?? {}
  if (String(properties.environmentId ?? '').toLowerCase() !== ENVIRONMENT_ID.toLowerCase()) return 'UNOWNED_JOB'
  const containers = properties.template?.containers ?? []
  if (containers.length !== 1 || containers[0]?.name !== OPERATOR_CONTAINER || containers[0]?.image !== expected.image) return 'UNOWNED_JOB'
  const identities = Object.keys(job?.identity?.userAssignedIdentities ?? {}).map((id) => id.toLowerCase())
  if (identities.length !== 1 || identities[0] !== IDENTITY.toLowerCase()) return 'UNOWNED_JOB'
  return null
}

export function jobSpecification(options) {
  const name = jobNameForRun(options.runId)
  return {
    location: 'canadacentral',
    identity: { type: 'UserAssigned', userAssignedIdentities: { [IDENTITY]: {} } },
    tags: { purpose: JOB_PURPOSE, runId: options.runId, source: options.source, owner: JOB_OWNER },
    properties: {
      environmentId: ENVIRONMENT_ID,
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
        name: OPERATOR_CONTAINER,
        image: options.image,
        resources: { cpu: 0.5, memory: '1Gi' },
        env: [
          { name: 'UE_CATALOG_TRANSPORT', value: 'private-job' },
          { name: 'UE_CATALOG_RUN_ID', value: options.runId },
          { name: 'UE_CATALOG_SOURCE_SHA', value: options.source },
          { name: 'PGHOST', value: STAGING_HOST },
          { name: 'PGDATABASE', value: EXPECTED_DATABASE },
          { name: 'DATABASE_URL', secretRef: 'database-url' },
          ...(options.continuation ? [{ name: 'UE_CATALOG_CONTINUATION', value: options.continuation }] : []),
        ],
      }] },
    },
    name,
  }
}

// ── Evidence frame v2 ────────────────────────────────────────────────────────

/** The same frame the operator writes; used for tests and capacity proofs. */
export function frameCatalog(body, options = {}) {
  const bytes = Buffer.from(String(body), 'utf8')
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const nonce = options.nonce ?? createHash('sha256').update(`${sha256}:${options.runId ?? ''}`).digest('hex').slice(0, 32)
  if (bytes.length > EVIDENCE_MAX_BYTES) return { lines: [`${EVIDENCE_FRAME} OVERFLOW ${nonce} bytes=${bytes.length} sha256=${sha256}`], sha256, nonce, overflow: true }
  const count = Math.max(1, Math.ceil(bytes.length / EVIDENCE_CHUNK_BYTES))
  const lines = [`${EVIDENCE_FRAME} BEGIN ${nonce} schema=${CATALOG_SCHEMA} run=${options.runId ?? ''} source=${options.source ?? ''} bytes=${bytes.length} sha256=${sha256} chunks=${count} chunkBytes=${EVIDENCE_CHUNK_BYTES}`]
  for (let index = 0; index < count; index += 1) {
    lines.push(`${EVIDENCE_FRAME} CHUNK ${nonce} ${index + 1}/${count} ${bytes.subarray(index * EVIDENCE_CHUNK_BYTES, (index + 1) * EVIDENCE_CHUNK_BYTES).toString('base64')}`)
  }
  lines.push(`${EVIDENCE_FRAME} END ${nonce} sha256=${sha256}`)
  return { lines, sha256, nonce, overflow: false, chunks: count, bytes: bytes.length }
}

function parseHeader(line) {
  const begin = line.match(/^UE_CATALOG_V2 BEGIN ([a-f0-9]{32}) schema=(\S+) run=([0-9]*) source=([a-f0-9]*) bytes=([0-9]+) sha256=([a-f0-9]{64}) chunks=([0-9]+) chunkBytes=([0-9]+)$/)
  if (begin) return { kind: 'BEGIN', nonce: begin[1], schema: begin[2], run: begin[3], source: begin[4], bytes: Number(begin[5]), sha256: begin[6], chunks: Number(begin[7]), chunkBytes: Number(begin[8]) }
  const end = line.match(/^UE_CATALOG_V2 END ([a-f0-9]{32}) sha256=([a-f0-9]{64})$/)
  if (end) return { kind: 'END', nonce: end[1], sha256: end[2] }
  const overflow = line.match(/^UE_CATALOG_V2 OVERFLOW ([a-f0-9]{32}) bytes=([0-9]+) sha256=([a-f0-9]{64})$/)
  if (overflow) return { kind: 'OVERFLOW', nonce: overflow[1], bytes: Number(overflow[2]), sha256: overflow[3] }
  return null
}

/**
 * Reassemble a v2 frame from bound log lines (any order, duplicates allowed).
 * Accepted only when one session's BEGIN and END agree, every chunk index is
 * present exactly once in content, every chunk is canonical base64 of the
 * declared size, and the decoded bytes match the declared length and SHA-256.
 */
export function reassembleCatalog(lines, expected = {}) {
  const fail = (defect, detail = {}) => ({ ok: false, defect, ...detail })
  const headers = []
  const chunkLines = []
  for (const raw of lines) {
    const line = String(raw).replace(/\r?\n$/, '')
    if (line.startsWith(`${EVIDENCE_FRAME} CHUNK `)) chunkLines.push(line)
    else if (line.startsWith(`${EVIDENCE_FRAME} `)) {
      const header = parseHeader(line)
      if (!header) return fail('EVIDENCE_MALFORMED')
      headers.push(header)
    }
  }
  if (headers.some((h) => h.kind === 'OVERFLOW')) return fail('EVIDENCE_TRANSPORT_EXCEEDED')
  const nonces = new Set(headers.map((h) => h.nonce))
  if (nonces.size > 1) return fail('EVIDENCE_AMBIGUOUS')
  const begin = headers.find((h) => h.kind === 'BEGIN')
  const end = headers.find((h) => h.kind === 'END')
  if (!begin) return fail('EVIDENCE_MISSING', { missing: ['BEGIN'] })
  const beginVariants = new Set(headers.filter((h) => h.kind === 'BEGIN').map((h) => JSON.stringify(h)))
  if (beginVariants.size > 1) return fail('EVIDENCE_CONFLICT')
  if (begin.schema !== CATALOG_SCHEMA) return fail('EVIDENCE_SCHEMA_MISMATCH')
  if (expected.runId !== undefined && begin.run !== String(expected.runId)) return fail('EVIDENCE_BINDING_MISMATCH')
  if (expected.source !== undefined && begin.source !== String(expected.source)) return fail('EVIDENCE_BINDING_MISMATCH')
  if (begin.chunkBytes !== EVIDENCE_CHUNK_BYTES || begin.bytes > EVIDENCE_MAX_BYTES ||
      begin.chunks !== Math.max(1, Math.ceil(begin.bytes / EVIDENCE_CHUNK_BYTES))) return fail('EVIDENCE_MALFORMED')
  const parts = new Array(begin.chunks).fill(null)
  let duplicates = 0
  for (const line of chunkLines) {
    const match = line.match(/^UE_CATALOG_V2 CHUNK ([a-f0-9]{32}) ([0-9]+)\/([0-9]+) (\S*)$/)
    if (!match) return fail('EVIDENCE_MALFORMED')
    if (match[1] !== begin.nonce) return fail('EVIDENCE_AMBIGUOUS')
    const index = Number(match[2])
    if (Number(match[3]) !== begin.chunks || index < 1 || index > begin.chunks) return fail('EVIDENCE_MALFORMED')
    if (!BASE64.test(match[4]) || match[4].length % 4 !== 0) return fail('EVIDENCE_MALFORMED')
    if (parts[index - 1] !== null) {
      if (parts[index - 1] !== match[4]) return fail('EVIDENCE_CONFLICT')
      duplicates += 1
      continue
    }
    parts[index - 1] = match[4]
  }
  const missing = []
  parts.forEach((part, index) => { if (part === null) missing.push(index + 1) })
  if (missing.length) return fail('EVIDENCE_MISSING', { missing: missing.slice(0, 50), missingCount: missing.length, expectedChunks: begin.chunks })
  if (!end) return fail('EVIDENCE_MISSING', { missing: ['END'] })
  if (end.sha256 !== begin.sha256) return fail('EVIDENCE_CONFLICT')
  const decoded = parts.map((part) => Buffer.from(part, 'base64'))
  for (let index = 0; index < decoded.length; index += 1) {
    const size = index === decoded.length - 1 ? begin.bytes - EVIDENCE_CHUNK_BYTES * (decoded.length - 1) : EVIDENCE_CHUNK_BYTES
    if (decoded[index].length !== size || decoded[index].toString('base64') !== parts[index]) return fail('EVIDENCE_MALFORMED')
  }
  const bytes = Buffer.concat(decoded)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (bytes.length !== begin.bytes || sha256 !== begin.sha256) return fail('EVIDENCE_HASH_MISMATCH')
  return { ok: true, body: bytes.toString('utf8'), bytes: bytes.length, sha256, nonce: begin.nonce, chunks: begin.chunks, duplicates }
}

// ── Log Analytics retrieval ──────────────────────────────────────────────────

const kqlString = (value) => {
  if (!/^[A-Za-z0-9._:/@-]+$/.test(String(value))) throw new Error('KQL_VALUE_REFUSED')
  return `'${value}'`
}

export function evidenceQuery(binding, select) {
  if (!Number.isFinite(Date.parse(binding.since))) throw new Error('KQL_VALUE_REFUSED')
  return [
    'ContainerAppConsoleLogs_CL',
    `| where TimeGenerated >= datetime(${new Date(binding.since).toISOString()})`,
    `| where ContainerJobName_s == ${kqlString(binding.name)} and ContainerName_s == ${kqlString(OPERATOR_CONTAINER)}`,
    `| where ContainerImage_s == ${kqlString(binding.image)} and Stream_s == 'stdout'`,
    `| where ContainerGroupName_s startswith ${kqlString(`${binding.execution}-`)}`,
    `| where Log_s startswith '${EVIDENCE_FRAME} '`,
    select,
  ].join('\n')
}

function parseRows(stdout) {
  const rows = JSON.parse(stdout)
  if (!Array.isArray(rows)) throw new Error('LOG_QUERY_UNREADABLE')
  return rows
}

async function queryWorkspace(spawn, workspace, kql) {
  const result = await spawn('az', ['monitor', 'log-analytics', 'query', '-w', workspace, '--analytics-query', kql, '-o', 'json'])
  if (result.code !== 0) return { ok: false }
  try { return { ok: true, rows: parseRows(result.stdout) } } catch { return { ok: false } }
}

export async function resolveWorkspace(spawn) {
  const shown = await spawn('az', ['containerapp', 'env', 'show', '-g', RESOURCE_GROUP, '-n', ENVIRONMENT_NAME, '--query', 'properties.appLogsConfiguration', '-o', 'json'])
  if (shown.code !== 0) return { defect: 'EVIDENCE_CHANNEL_UNAVAILABLE' }
  let config
  try { config = JSON.parse(shown.stdout) } catch { return { defect: 'EVIDENCE_CHANNEL_UNAVAILABLE' } }
  const customerId = String(config?.logAnalyticsConfiguration?.customerId ?? '')
  if (config?.destination !== 'log-analytics' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(customerId)) {
    return { defect: 'EVIDENCE_CHANNEL_UNAVAILABLE' }
  }
  return { workspace: customerId }
}

/**
 * Poll the workspace until one complete frame is ingested or the deadline passes.
 * Headers first, then a distinct-index count, then the chunks page by page.
 */
export async function retrieveEvidence(spawn, binding, clock, deadlineMs = INGEST_DEADLINE_MS) {
  const channel = await resolveWorkspace(spawn)
  if (channel.defect) return { ok: false, defect: channel.defect }
  const deadlineAt = clock.now() + deadlineMs
  const polls = []
  let last = { ok: false, defect: 'EVIDENCE_MISSING' }
  while (true) {
    const headers = await queryWorkspace(spawn, channel.workspace, evidenceQuery(binding,
      `| where not(Log_s startswith '${EVIDENCE_FRAME} CHUNK ') | project Log_s, ContainerGroupName_s`))
    if (!headers.ok) polls.push({ at: clock.now(), state: 'QUERY_FAILED' })
    else {
      const replicas = new Set(headers.rows.map((row) => row.ContainerGroupName_s))
      if (replicas.size > 1) return { ok: false, defect: 'EVIDENCE_AMBIGUOUS', workspace: channel.workspace, polls }
      const lines = headers.rows.map((row) => row.Log_s)
      const begin = lines.map(parseHeader).find((h) => h?.kind === 'BEGIN')
      if (lines.some((line) => line.startsWith(`${EVIDENCE_FRAME} OVERFLOW `))) return { ok: false, defect: 'EVIDENCE_TRANSPORT_EXCEEDED', workspace: channel.workspace, polls }
      const hasEnd = lines.some((line) => line.startsWith(`${EVIDENCE_FRAME} END `))
      if (begin && hasEnd) {
        // Exact distinct count; dcount() is approximate and could hold a complete frame as missing.
        const counted = await queryWorkspace(spawn, channel.workspace, evidenceQuery(binding,
          `| where Log_s startswith '${EVIDENCE_FRAME} CHUNK ${begin.nonce} ' | extend i = toint(extract(@'^UE_CATALOG_V2 CHUNK [a-f0-9]{32} ([0-9]+)/', 1, Log_s)) | distinct i | summarize n = count()`))
        const distinct = counted.ok ? Number(counted.rows[0]?.n ?? 0) : -1
        polls.push({ at: clock.now(), state: 'FRAME_SEEN', distinct, expected: begin.chunks })
        if (distinct === begin.chunks) {
          const collected = [...lines]
          let pagesOk = true
          for (let lo = 1; lo <= begin.chunks; lo += LOG_PAGE_CHUNKS) {
            const hi = Math.min(begin.chunks, lo + LOG_PAGE_CHUNKS - 1)
            const page = await queryWorkspace(spawn, channel.workspace, evidenceQuery(binding,
              `| where Log_s startswith '${EVIDENCE_FRAME} CHUNK ${begin.nonce} ' | extend i = toint(extract(@'^UE_CATALOG_V2 CHUNK [a-f0-9]{32} ([0-9]+)/', 1, Log_s)) | where i between (${lo} .. ${hi}) | project Log_s, ContainerGroupName_s`))
            if (!page.ok) { pagesOk = false; break }
            for (const row of page.rows) {
              if (row.ContainerGroupName_s !== [...replicas][0]) return { ok: false, defect: 'EVIDENCE_AMBIGUOUS', workspace: channel.workspace, polls }
              collected.push(row.Log_s)
            }
          }
          if (pagesOk) {
            last = reassembleCatalog(collected, { runId: binding.runId, source: binding.source })
            if (last.ok) return { ...last, workspace: channel.workspace, replica: [...replicas][0], polls }
            if (last.defect !== 'EVIDENCE_MISSING') return { ...last, workspace: channel.workspace, polls }
          }
        }
      } else polls.push({ at: clock.now(), state: begin ? 'END_PENDING' : 'BEGIN_PENDING' })
    }
    if (clock.now() >= deadlineAt) break
    const before = clock.now()
    await clock.sleep(clock.ingestIntervalMs ?? INGEST_INTERVAL_MS)
    if (clock.now() <= before) break
  }
  return { ...last, ok: false, defect: last.defect ?? 'EVIDENCE_MISSING', workspace: channel.workspace, polls, timedOut: true }
}

// ── Evidence contract ────────────────────────────────────────────────────────

export function evidenceManifest({ binding, evidence, catalog, evaluation, revision, capturedAt }) {
  const categories = CATALOG_CONTRACT.categories.map((category) => {
    const found = evaluation?.categories?.find((item) => item.id === category.id)
    const items = found?.queries ?? found?.items ?? []
    const captured = items.filter((item) => ['OBSERVED', 'ABSENT_VERIFIED'].includes(item.classification)).length
    return { id: category.id, accepted: Boolean(found?.accepted), observations: items.length, captured, missing: items.length - captured }
  })
  const counts = catalog?.counts ?? []
  const byClass = (value) => counts.filter((item) => item.classification === value).length
  return {
    schema: 'ue-v2-staging-catalog-evidence/v1',
    catalogSchema: CATALOG_SCHEMA,
    execution: { githubRunId: binding.runId, sourceSha: binding.source, job: binding.name, execution: binding.execution, replica: evidence.replica ?? null },
    environment: { subscription: SUBSCRIPTION_ID, tenant: TENANT_ID, resourceGroup: RESOURCE_GROUP, managedEnvironment: ENVIRONMENT_NAME, database: EXPECTED_DATABASE, revision: revision?.name ?? null, servingImage: revision?.image ?? null },
    operatorImage: binding.image,
    transport: { channel: 'log-analytics', workspace: evidence.workspace, frame: EVIDENCE_FRAME, nonce: evidence.nonce, chunks: evidence.chunks, bytes: evidence.bytes, duplicatesIgnored: evidence.duplicates },
    observedIdentity: catalog?.identity ? { database: catalog.identity.database, role: catalog.identity.user, login: catalog.identity.session_user, transactionReadOnly: catalog.identity.transaction_read_only, version: catalog.identity.version } : null,
    observedAt: catalog?.observedAt ?? null,
    capturedAt,
    sha256: evidence.sha256,
    categories,
    categoryInventory: { required: CATALOG_CONTRACT.categories.length, accepted: categories.filter((item) => item.accepted).length },
    counts: { tables: counts.length, observed: byClass('OBSERVED'), notAttempted: byClass('NOT_ATTEMPTED'), timedOut: byClass('TIMED_OUT'), unreadable: byClass('UNREADABLE') },
    verdict: evaluation?.verdict ?? 'CATALOG_UNREADABLE',
  }
}

// ── Continuation chain ───────────────────────────────────────────────────────

export const CONTINUATION_ENV_MAX_BYTES = 60000
export const SESSION_BINDING = { revision: EXPECTED_REVISION, image: EXPECTED_IMAGE }

/**
 * Load the previous session's artifacts. Every file used must be listed in the
 * prior SHA256SUMS with a matching digest; the merged catalogue and the token are
 * otherwise refused.
 */
export function loadPriorSession(directory) {
  const sumsPath = path.join(directory, 'SHA256SUMS')
  if (!existsSync(sumsPath)) return { defect: 'CONTINUATION_REJECTED', reason: 'PRIOR_SUMS_MISSING' }
  const sums = new Map(readFileSync(sumsPath, 'utf8').trim().split('\n').map((line) => line.split(/\s+/)).map(([digest, file]) => [file, digest]))
  const verified = (file) => {
    const full = path.join(directory, file)
    if (!sums.has(file) || !existsSync(full)) return null
    const bytes = readFileSync(full)
    return createHash('sha256').update(bytes).digest('hex') === sums.get(file) ? bytes.toString('utf8') : null
  }
  const merged = verified('catalog-merged.json')
  const token = verified('continuation-token.json')
  if (merged === null || token === null) return { defect: 'CONTINUATION_REJECTED', reason: 'PRIOR_ARTIFACT_UNVERIFIED' }
  try { return { merged: JSON.parse(merged), token: JSON.parse(token) } } catch { return { defect: 'CONTINUATION_REJECTED', reason: 'PRIOR_ARTIFACT_UNREADABLE' } }
}

/** The container needs only what it checks and the tables it still has to count. */
export function slimContinuation(token) {
  return JSON.stringify({ schema: token.schema, database: token.database, inventoryDigest: token.inventoryDigest, remaining: token.remaining,
    expiresAt: token.expiresAt, baselineSessionId: token.baselineSessionId })
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

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

async function showJob(spawn, name) {
  const shown = await spawn('az', ['containerapp', 'job', 'show', '-g', RESOURCE_GROUP, '-n', name, '-o', 'json'])
  if (shown.code !== 0) return NOT_FOUND.test(`${shown.stdout}\n${shown.stderr}`) ? { absent: true } : { unreadable: true }
  try { return { job: JSON.parse(shown.stdout) } } catch { return { unreadable: true } }
}

/** Every execution of the owned job must be terminal before deletion; stop live ones once. */
async function settleExecutions(spawn, name, clock) {
  const listed = await spawn('az', ['containerapp', 'job', 'execution', 'list', '-g', RESOURCE_GROUP, '-n', name, '--query', '[].{name:name,status:properties.status}', '-o', 'json'])
  if (listed.code !== 0) return { settled: false, reason: 'EXECUTIONS_UNREADABLE' }
  let executions
  try { executions = JSON.parse(listed.stdout) } catch { return { settled: false, reason: 'EXECUTIONS_UNREADABLE' } }
  for (const execution of executions.filter((item) => !isTerminal(item.status))) {
    const stopped = await spawn('az', ['containerapp', 'job', 'stop', '-g', RESOURCE_GROUP, '-n', name, '--job-execution-name', execution.name, '-o', 'none'])
    if (stopped.code !== 0) return { settled: false, reason: 'STOP_FAILED', execution: execution.name }
    const after = await pollExecution(spawn, { name, execution: execution.name }, clock, clock.stopDeadlineMs ?? STOP_DEADLINE_MS)
    if (!isTerminal(after.status)) return { settled: false, reason: 'EXECUTION_STILL_RUNNING', execution: execution.name }
  }
  return { settled: true, executions: executions.length }
}

/**
 * Delete only the exactly owned job, only after its executions are terminal, and
 * prove absence with an explicit not-found. Any doubt holds the resource and
 * yields an actionable cleanup incident; it never widens the delete.
 */
export async function cleanupOwnedJob(spawn, expected, clock = { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)), intervalMs: OBSERVE_INTERVAL_MS }) {
  const incident = (defect, reason) => ({ deleted: false, defect, reason, incident: { job: expected.name, resourceGroup: RESOURCE_GROUP,
    action: `Verify ownership tags (purpose=${JOB_PURPOSE}, runId=${expected.runId}), stop any running execution, then delete only this job.` } })
  const first = await showJob(spawn, expected.name)
  if (first.absent) return { deleted: true, defect: null, absent: true }
  if (first.unreadable) return incident('JOB_CLEANUP_UNPROVEN', 'JOB_UNREADABLE')
  const ownership = ownedJobDefect(first.job, expected)
  if (ownership) return incident('JOB_CLEANUP_FAILED', ownership)
  const settled = await settleExecutions(spawn, expected.name, clock)
  if (!settled.settled) return incident('JOB_CLEANUP_UNPROVEN', settled.reason)
  for (let attempt = 1; attempt <= DELETE_ATTEMPTS; attempt += 1) {
    const removed = await spawn('az', ['containerapp', 'job', 'delete', '-g', RESOURCE_GROUP, '-n', expected.name, '--yes', '-o', 'none'])
    const after = await showJob(spawn, expected.name)
    if (after.absent) return { deleted: true, defect: null, attempts: attempt }
    if (after.job && ownedJobDefect(after.job, expected)) return incident('JOB_CLEANUP_FAILED', 'OWNERSHIP_CHANGED')
    if (removed.code === 0 && after.unreadable) return incident('JOB_CLEANUP_UNPROVEN', 'ABSENCE_UNPROVEN')
    await clock.sleep(clock.intervalMs)
  }
  return incident('JOB_CLEANUP_FAILED', 'DELETE_DID_NOT_COMPLETE')
}

async function reconcileCreatedJob(spawn, expected, clock) {
  const shown = await showJob(spawn, expected.name)
  if (shown.absent) return { deleted: false, defect: null, absent: true }
  if (shown.unreadable) return { deleted: false, defect: 'JOB_CLEANUP_UNPROVEN', reason: 'JOB_UNREADABLE' }
  if (ownedJobDefect(shown.job, expected)) return { deleted: false, defect: 'JOB_NAME_CONFLICT', reason: 'UNOWNED_JOB' }
  return cleanupOwnedJob(spawn, expected, clock)
}

export async function executeCatalogJob(env, spawn, options = {}) {
  const report = {
    schema: 'ue-v2-staging-catalog-job/v2',
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
    ingestIntervalMs: options.ingestIntervalMs ?? INGEST_INTERVAL_MS,
    stopDeadlineMs: options.stopDeadlineMs ?? STOP_DEADLINE_MS,
  }
  const addDefect = (defect) => { if (defect && !report.defects.includes(defect)) report.defects.push(defect) }
  const fail = (code, defect) => {
    addDefect(defect)
    report.verdict = defect
    report.catalogAccepted = false
    return { exitCode: code, report }
  }
  if (env.UE_CATALOG_JOB_LIVE !== '1' || env.GITHUB_REPOSITORY !== REPOSITORY || env.GITHUB_REF !== 'refs/heads/main' || env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
    return fail(1, 'WRONG_ENVIRONMENT')
  }
  if (!/^[a-f0-9]{40}$/.test(String(env.GITHUB_SHA ?? ''))) return fail(1, 'WRONG_ENVIRONMENT')
  if (assertStagingTarget(env.UE_CATALOG_TARGET ? JSON.parse(env.UE_CATALOG_TARGET) : { resourceGroup: RESOURCE_GROUP, database: EXPECTED_DATABASE, host: STAGING_HOST })) {
    return fail(1, 'WRONG_ENVIRONMENT')
  }
  report.phases.preflight = 'DONE'

  const account = await spawn('az', ['account', 'show', '--query', '{subscriptionId:id,tenantId:tenantId}', '-o', 'json'])
  if (account.code !== 0) return fail(1, 'WRONG_SUBSCRIPTION')
  let accountBody
  try { accountBody = JSON.parse(account.stdout) } catch { return fail(1, 'WRONG_SUBSCRIPTION') }
  if (accountBody.subscriptionId !== SUBSCRIPTION_ID) return fail(1, 'WRONG_SUBSCRIPTION')
  if (accountBody.tenantId !== TENANT_ID) return fail(1, 'WRONG_TENANT')
  const imageDefect = operatorImageDefect(env.OPERATOR_IMAGE)
  if (imageDefect) return fail(1, imageDefect)
  const revision = await spawn('az', ['containerapp', 'revision', 'show', '-g', RESOURCE_GROUP, '-n', CONTAINER_APP, '--revision', EXPECTED_REVISION, '--query', '{name:name,healthState:properties.healthState,trafficWeight:properties.trafficWeight,containers:properties.template.containers[].{name:name,image:image}}', '-o', 'json'])
  if (revision.code !== 0) return fail(4, 'REVISION_BINDING_CHANGED')
  let revisionBody
  try { revisionBody = JSON.parse(revision.stdout) } catch { return fail(4, 'REVISION_BINDING_CHANGED') }
  if (revisionDefect(revisionBody)) return fail(4, 'REVISION_BINDING_CHANGED')
  const secrets = await spawn('az', ['containerapp', 'show', '-g', RESOURCE_GROUP, '-n', CONTAINER_APP, '--query', 'properties.configuration.secrets[].name', '-o', 'json'])
  let secretNames = []
  try { secretNames = secrets.code === 0 ? JSON.parse(secrets.stdout) : [] } catch { secretNames = [] }
  if (!secretNames.includes('database-url')) return fail(1, 'RUNTIME_SECRET_UNAVAILABLE')
  // The evidence channel is checked before any job exists, so a missing channel creates nothing.
  const channel = await resolveWorkspace(spawn)
  if (channel.defect) return fail(1, channel.defect)
  let continuation = null
  if (options.prior) {
    if (options.prior.defect) return fail(1, options.prior.defect)
    const defect = continuationDefect(options.prior.token, { ...SESSION_BINDING, source: env.GITHUB_SHA }, clock.now())
    if (defect) return fail(1, defect)
    continuation = slimContinuation(options.prior.token)
    if (Buffer.byteLength(continuation) > CONTINUATION_ENV_MAX_BYTES) return fail(1, 'CONTINUATION_TOO_LARGE')
    report.continuation = { baselineSessionId: options.prior.token.baselineSessionId, remaining: options.prior.token.remaining.length, inventoryDigest: options.prior.token.inventoryDigest }
  }
  report.phases.validate = 'DONE'
  report.revision = { name: revisionBody.name, image: EXPECTED_IMAGE }

  const name = jobNameForRun(env.GITHUB_RUN_ID)
  const source = env.GITHUB_SHA
  const expectedJob = { name, runId: env.GITHUB_RUN_ID, source, image: env.OPERATOR_IMAGE }
  const preexisting = await showJob(spawn, name)
  if (!preexisting.absent) return fail(1, preexisting.unreadable ? 'JOB_STATE_UNREADABLE' : 'JOB_NAME_CONFLICT')
  const spec = jobSpecification({ image: env.OPERATOR_IMAGE, runId: env.GITHUB_RUN_ID, source, continuation })
  const serialized = JSON.stringify(spec)
  if (/postgres(?:ql)?:\/\//i.test(serialized) || serialized.includes('PGPASSWORD') || serialized.includes('UE_V2_STAGING_DB_ADMIN_PASSWORD')) {
    return fail(1, 'JOB_CREATION_FAILED')
  }
  const directory = mkdtempSync(path.join(tmpdir(), 'ue-catalog-job-'))
  const manifest = path.join(directory, 'job.json')
  writeFileSync(manifest, serialized)
  report.job = { name, source, purpose: JOB_PURPOSE }
  const since = new Date(clock.now() - 10 * 60 * 1000).toISOString()
  const created = await spawn('az', ['containerapp', 'job', 'create', '-g', RESOURCE_GROUP, '-n', name, '--yaml', manifest, '-o', 'none'])
  rmSync(directory, { recursive: true, force: true })
  if (created.code !== 0) {
    report.phases.create = 'FAILED'
    const reconciliation = await reconcileCreatedJob(spawn, expectedJob, clock)
    report.cleanup = reconciliation
    addDefect(reconciliation.defect)
    return fail(1, 'JOB_CREATION_FAILED')
  }
  const createdJob = await showJob(spawn, name)
  if (!createdJob.job || ownedJobDefect(createdJob.job, expectedJob)) {
    report.phases.create = 'UNPROVEN'
    const reconciliation = await reconcileCreatedJob(spawn, expectedJob, clock)
    report.cleanup = reconciliation
    addDefect(reconciliation.defect)
    return fail(1, 'JOB_CREATION_FAILED')
  }
  report.phases.create = 'DONE'

  let result
  let release = true
  try {
    const started = await spawn('az', ['containerapp', 'job', 'start', '-g', RESOURCE_GROUP, '-n', name, '--query', 'name', '-o', 'tsv'])
    const execution = started.stdout.trim()
    if (started.code !== 0 || !execution.startsWith(`${name}-`)) {
      result = fail(5, 'JOB_EXECUTION_FAILED')
    } else {
      report.phases.start = 'DONE'
      report.job.execution = execution
      let observed = await pollExecution(spawn, { name, execution }, clock, options.deadlineMs ?? OBSERVE_DEADLINE_MS)
      report.executionObservations = observed.observations
      if (observed.timedOut) {
        const stopped = await spawn('az', ['containerapp', 'job', 'stop', '-g', RESOURCE_GROUP, '-n', name, '--job-execution-name', execution, '-o', 'none'])
        report.stop = { code: stopped.code }
        if (stopped.code === 0) {
          const afterStop = await pollExecution(spawn, { name, execution }, clock, clock.stopDeadlineMs)
          report.executionObservations = report.executionObservations.concat(afterStop.observations)
          observed = afterStop
        }
      }
      report.executionStatus = observed.status
      if (!isTerminal(observed.status)) {
        release = false
        report.phases.observe = 'TIMED_OUT'
        report.phases.delete = 'HELD'
        report.cleanup = { deleted: false, defect: 'JOB_CLEANUP_UNPROVEN', reason: 'EXECUTION_STILL_RUNNING', incident: { job: name, execution, resourceGroup: RESOURCE_GROUP,
          action: 'The execution could not be proven terminated. Stop it, confirm a terminal status, then delete only this owned job.' } }
        addDefect('JOB_CLEANUP_UNPROVEN')
        result = fail(5, 'JOB_EXECUTION_TIMED_OUT')
      } else {
        report.phases.observe = 'DONE'
        const binding = { name, execution, image: env.OPERATOR_IMAGE, runId: env.GITHUB_RUN_ID, source, since }
        const evidence = await retrieveEvidence(spawn, binding, clock, options.ingestDeadlineMs ?? INGEST_DEADLINE_MS)
        report.evidence = { channel: 'log-analytics', workspace: evidence.workspace ?? null, polls: evidence.polls?.length ?? 0,
          chunks: evidence.chunks ?? null, bytes: evidence.bytes ?? null, sha256: evidence.sha256 ?? null, replica: evidence.replica ?? null,
          ...(evidence.ok ? {} : { defect: evidence.defect, missingCount: evidence.missingCount ?? null }) }
        if (!evidence.ok) {
          report.phases.capture = 'MISSING'
          addDefect(evidence.defect)
          result = fail(5, observed.status === 'Succeeded' ? evidence.defect : 'JOB_EXECUTION_FAILED')
        } else {
          report.phases.capture = 'DONE'
          report.evidenceSha256 = evidence.sha256
          report.evidenceBody = evidence.body
          const parsed = parseCatalogStdout(`UE_CATALOG_BEGIN\n${evidence.body}\nUE_CATALOG_END\n`)
          if (parsed?.body) report.catalog = parsed.body
          if (parsed?.verdict) report.diagnostics = parsed.verdict
          report.manifest = evidenceManifest({ binding: { ...binding, image: env.OPERATOR_IMAGE }, evidence, catalog: parsed?.body,
            evaluation: parsed?.body?.evaluation, revision: report.revision, capturedAt: new Date(clock.now()).toISOString() })
          if (observed.status !== 'Succeeded') result = fail(5, 'JOB_EXECUTION_FAILED')
          else if (!parsed?.body) result = fail(5, 'CATALOG_OUTPUT_UNREADABLE')
          else {
            report.phases.verify = 'DONE'
            const body = parsed.body
            if (body.blocker === 'IDENTITY_REFUSED' || body.identity?.user !== RUNTIME_ROLE || body.identity?.session_user !== RUNTIME_LOGIN) result = fail(5, 'DATABASE_IDENTITY_REFUSED')
            else if (body.blocker === 'DATABASE_URL_ABSENT' || /ECONNREFUSED|connection refused/i.test(body.error ?? '')) result = fail(5, 'DATABASE_CONNECTION_REFUSED')
            else if (body.identity?.transaction_read_only !== 'on' || body.rolledBack !== true) result = fail(5, 'READ_ONLY_TRANSACTION_UNPROVEN')
            // The evidence is claimed for the limited runtime role: an elevated login or role, or any RLS bypass, is refused.
            else if (body.privilege?.classification !== 'LIMITED_RUNTIME' || body.privilege?.rolbypassrls !== false || body.privilege?.rolsuper !== false) result = fail(5, 'DATABASE_PRIVILEGE_UNEXPECTED')
            else if (options.prior) {
              // A continuation session carries only the remaining counts; its verdict is the reconciled chain's.
              const reconciled = reconcileCatalogSessions([
                { catalog: options.prior.merged, observedAt: options.prior.merged.lastObservedAt ?? options.prior.merged.observedAt },
                { catalog: body, token: options.prior.token, observedAt: body.observedAt, now: clock.now() },
              ], { ...SESSION_BINDING, source: source })
              if (!reconciled.catalog) result = fail(5, reconciled.reason ?? 'CONTINUATION_REJECTED')
              else {
                const merged = { ...reconciled.catalog, lastObservedAt: body.observedAt, sessions: [...(options.prior.merged.sessions ?? [options.prior.merged.observedAt]), body.observedAt] }
                report.mergedCatalog = merged
                report.continuationToken = buildContinuationToken(merged, { ...SESSION_BINDING, source, sessionId: options.prior.token.baselineSessionId }, clock.now())
                report.verdict = reconciled.verdict
                report.catalogAccepted = reconciled.verdict === 'CATALOG_COMPLETE'
                report.manifest = { ...report.manifest, verdict: reconciled.verdict, chain: { sessions: merged.sessions, baselineSessionId: options.prior.token.baselineSessionId },
                  counts: evidenceManifest({ binding: { ...binding, image: env.OPERATOR_IMAGE }, evidence, catalog: merged, evaluation: reconciled.evaluation, revision: report.revision }).counts }
                result = report.catalogAccepted ? { exitCode: 0, report } : fail(5, reconciled.verdict)
              }
            } else {
              report.mergedCatalog = { ...body, lastObservedAt: body.observedAt, sessions: [body.observedAt] }
              report.continuationToken = buildContinuationToken(body, { ...SESSION_BINDING, source, sessionId: env.GITHUB_RUN_ID }, clock.now())
              report.verdict = parsed.verdict
              report.catalogAccepted = parsed.verdict === 'CATALOG_COMPLETE'
              result = parsed.ok ? { exitCode: 0, report } : fail(5, parsed.verdict)
            }
          }
        }
      }
    }
  } finally {
    if (release) {
      const cleanup = await cleanupOwnedJob(spawn, expectedJob, clock)
      report.phases.delete = cleanup.deleted ? 'DONE' : 'FAILED'
      report.cleanup = cleanup
      if (!cleanup.deleted) {
        report.catalogAccepted = false
        addDefect(cleanup.defect)
        if (result && result.exitCode === 0) result.exitCode = 6
      }
    }
  }
  return result
}

/** Cleanup-only mode for interrupted runs: same ownership, settle and absence rules. */
export async function cleanupForRun(env, spawn, clock) {
  const name = jobNameForRun(env.GITHUB_RUN_ID)
  const expected = { name, runId: env.GITHUB_RUN_ID, source: env.GITHUB_SHA, image: env.OPERATOR_IMAGE }
  const cleanup = await cleanupOwnedJob(spawn, expected, clock)
  return { schema: 'ue-v2-staging-catalog-cleanup/v1', job: name, ...cleanup }
}

export function writeJobArtifacts(directory, report) {
  mkdirSync(directory, { recursive: true })
  const { evidenceBody, mergedCatalog, continuationToken, ...rest } = report
  const extra = []
  const put = (file, text) => { writeFileSync(path.join(directory, file), text); extra.push(`${createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex')}  ${file}`) }
  if (typeof evidenceBody === 'string') { put('catalog-evidence.json', evidenceBody); rest.evidenceFile = 'catalog-evidence.json' }
  if (report.manifest) put('evidence-manifest.json', `${JSON.stringify(report.manifest, null, 2)}\n`)
  if (mergedCatalog) put('catalog-merged.json', `${JSON.stringify(mergedCatalog)}\n`)
  if (continuationToken) { put('continuation-token.json', `${JSON.stringify(continuationToken, null, 2)}\n`); rest.continuationRemaining = continuationToken.remaining.length }
  const digest = writeReport(directory, rest)
  writeFileSync(path.join(directory, 'SHA256SUMS'), `${[`${digest}  catalog.json`, ...extra].join('\n')}\n`)
  return digest
}

export function launch(executable, args) {
  const result = spawnSync(executable, args, { encoding: 'utf8', maxBuffer: PROCESS_STDOUT_MAX_BYTES })
  if (result.error) {
    const limited = result.error.code === 'ENOBUFS' || result.error.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER'
    return { code: result.status ?? 1, stdout: '', stderr: limited ? 'STDOUT_LIMIT' : String(result.error.message), transport: limited ? 'STDOUT_LIMIT' : 'SPAWN_ERROR' }
  }
  return { code: result.status ?? 1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
}

/** Build-time smoke: the real image's entrypoint must resolve pg and frame its refusal without a database. */
export function verifyImageSmoke(stdout, expected) {
  const lines = String(stdout).split('\n').filter((line) => line.startsWith(`${EVIDENCE_FRAME} `))
  const evidence = reassembleCatalog(lines, expected)
  if (!evidence.ok) return { ok: false, defect: evidence.defect }
  const body = JSON.parse(evidence.body)
  if (body.client?.resolved !== true || body.runtime?.uid !== 1001 || body.blocker !== 'DATABASE_URL_ABSENT') return { ok: false, defect: 'OPERATOR_IMAGE_SMOKE_FAILED', body }
  if (!/^\/app\/node_modules\/pg\//.test(String(body.runtime?.pgPath ?? '')) || body.runtime?.entry !== '/app/ue-catalog/operator.cjs') return { ok: false, defect: 'OPERATOR_IMAGE_SMOKE_FAILED', body }
  return { ok: true, runtime: body.runtime }
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (invoked) {
  const flag = (name) => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : '' }
  if (process.argv.includes('--verify-image-smoke')) {
    const { readFileSync } = await import('node:fs')
    const verdict = verifyImageSmoke(readFileSync(flag('--verify-image-smoke'), 'utf8'), { runId: process.env.GITHUB_RUN_ID, source: process.env.GITHUB_SHA })
    console.log(JSON.stringify(verdict))
    process.exit(verdict.ok ? 0 : 1)
  }
  const directory = flag('--out')
  if (!directory) {
    console.error('CATALOG_OUTPUT_REQUIRED')
    process.exit(1)
  }
  if (process.argv.includes('--cleanup-only')) {
    const receipt = await cleanupForRun(process.env, launch, { now: () => Date.now(), sleep: (ms) => new Promise((r) => setTimeout(r, ms)), intervalMs: OBSERVE_INTERVAL_MS })
    mkdirSync(directory, { recursive: true })
    writeFileSync(path.join(directory, 'cleanup.json'), `${JSON.stringify(receipt, null, 2)}\n`)
    console.log(`cleanup job=${receipt.job} deleted=${receipt.deleted} defect=${receipt.defect ?? 'none'}`)
    process.exit(receipt.deleted ? 0 : 6)
  }
  const prior = process.env.UE_CATALOG_PRIOR_DIR ? loadPriorSession(process.env.UE_CATALOG_PRIOR_DIR) : undefined
  const result = await executeCatalogJob(process.env, launch, { prior })
  const digest = writeJobArtifacts(directory, result.report)
  console.log(`catalog=${result.report.verdict ?? 'CATALOG_REFUSED'} sha256=${digest} defects=${result.report.defects.join(',')} S2_02_PREIMAGE_COMPLETE=NO`)
  process.exit(result.report.defects.some((defect) => defect === 'JOB_CLEANUP_FAILED' || defect === 'JOB_CLEANUP_UNPROVEN') ? 6 : result.exitCode)
}
