import { randomUUID } from 'node:crypto'
import { createLogger } from '@nzila/os-core'
import { emitCommandEvent } from './platform.js'
import { dispatchWorkflow } from './dispatch.js'
import { nowISO } from '@nzila/platform-utils'
import { type CommandRecord, type CommandStatus, PlaybookName } from './contract.js'
import {
  claimExecutionLease,
  createCommand,
  getCommandById,
  getCommandByOrgAndIdempotency,
  listCommands,
  recoverExpiredLeases,
  releaseExecutionLease,
  renewExecutionLease,
  updateCommandById,
} from './store.js'

const logger = createLogger('orchestrator:execution-engine')
const INSTANCE_ID = process.env.ORCHESTRATOR_INSTANCE_ID ?? `orch-${process.pid}`
const LEASE_MS = Number(process.env.ORCHESTRATOR_LEASE_MS ?? 30_000)
const RECOVERY_INTERVAL_MS = Number(process.env.ORCHESTRATOR_RECOVERY_INTERVAL_MS ?? 5_000)
const STUCK_THRESHOLD_MS = Number(process.env.ORCHESTRATOR_STUCK_THRESHOLD_MS ?? 120_000)

const processingRuns = new Set<string>()
let recoveryLoopStarted = false

type FailureClass = 'transient' | 'input_invalid' | 'auth_failure' | 'timeout' | 'policy_denied' | 'internal'
type ExecutionStatus = 'pending' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'timed_out' | 'dead_lettered'

interface ActorIdentity {
  actorId: string
  actorType: 'user' | 'service' | 'system' | 'break_glass'
  orgId?: string
  displayName?: string
}

interface WorkflowTriggerRequest {
  workflowId: string
  orgId: string
  requestId: string
  payload?: Record<string, unknown>
  initiatedBy: ActorIdentity
  executionContext?: {
    dryRun?: boolean
    idempotencyKey?: string
    priority?: 'low' | 'normal' | 'high' | 'critical'
    timeoutMs?: number
  }
  correlationEnvelope?: {
    requestId?: string
    correlationId?: string
    workflowId?: string
    orgId?: string
    actorId?: string
    traceId?: string
    spanId?: string
    initiatedAt?: string
  }
}

interface ExecutionRun {
  runId: string
  workflowId: string
  orgId: string
  requestId: string
  correlationId: string
  idempotencyKey: string
  initiatedBy: ActorIdentity
  status: ExecutionStatus
  dryRun: boolean
  retryCount: number
  failureClass?: FailureClass
  failureMessage?: string
  decisionId?: string
  payload: Record<string, unknown>
  result?: Record<string, unknown>
  startedAt: string
  updatedAt: string
  completedAt?: string
}

const DEFAULT_RETRY_POLICY = {
  maxAttempts: 3,
  backoffMs: 1_000,
  backoffMultiplier: 2,
  maxBackoffMs: 30_000,
  retryableFailureClasses: ['transient', 'timeout'] as FailureClass[],
}

interface StoredExecutionArgs {
  workflowId: string
  orgId: string
  requestId: string
  correlationId: string
  idempotencyKey: string
  initiatedBy: {
    actorId: string
    actorType: 'user' | 'service' | 'system' | 'break_glass'
    orgId?: string
    displayName?: string
  }
  payload: Record<string, unknown>
  dryRun: boolean
  authorizationDecisionId?: string
  retryCount: number
  result?: Record<string, unknown>
  failureClass?: FailureClass
  failureMessage?: string
}

const LEGAL_TRANSITIONS: Record<CommandStatus, readonly CommandStatus[]> = {
  pending: ['approved', 'dispatched', 'cancelled', 'failed', 'succeeded'],
  approved: ['dispatched', 'cancelled'],
  dispatched: ['running', 'cancelled', 'failed'],
  running: ['succeeded', 'failed', 'cancelled', 'dispatched'],
  succeeded: [],
  failed: ['dispatched', 'cancelled'],
  cancelled: [],
} as const

export interface ExecuteWorkflowInput extends WorkflowTriggerRequest {
  authorizationDecisionId?: string
}

export interface ExecuteWorkflowResult {
  runId: string
  status: ExecutionStatus
  idempotent: boolean
  dryRun: boolean
  workflowId: string
  orgId: string
  requestId: string
  correlationId: string
  failureClass?: FailureClass
  failureMessage?: string
  startedAt: string
}

export function startExecutionRecoveryLoop(): void {
  if (recoveryLoopStarted || process.env.NODE_ENV === 'test') return
  recoveryLoopStarted = true

  void recoverAndResumeRuns()
  setInterval(() => {
    void recoverAndResumeRuns()
  }, RECOVERY_INTERVAL_MS).unref()

  logger.info('Execution recovery loop started', {
    instanceId: INSTANCE_ID,
    leaseMs: LEASE_MS,
    recoveryIntervalMs: RECOVERY_INTERVAL_MS,
  })
}

export async function executeWorkflow(
  input: ExecuteWorkflowInput,
): Promise<ExecuteWorkflowResult> {
  const correlationId = input.correlationEnvelope?.correlationId ?? randomUUID()
  const idempotencyKey = input.executionContext?.idempotencyKey
    ?? `${input.workflowId}:${input.requestId}`
  const dryRun = input.executionContext?.dryRun ?? false

  const existing = await getCommandByOrgAndIdempotency(input.orgId, idempotencyKey)
  if (existing) {
    logger.info('Duplicate idempotency submission returned existing run', {
      runId: existing.id,
      orgId: input.orgId,
      idempotencyKey,
      status: existing.status,
    })
    return toResult(existing, true)
  }

  if (!dryRun && !input.authorizationDecisionId) {
    const rejected = await createPersistedRun({
      input,
      correlationId,
      idempotencyKey,
      status: 'failed',
      failureClass: 'auth_failure',
      failureMessage: 'Workflow execution requires Control Plane authorization',
    })
    return toResult(rejected.record, rejected.duplicate)
  }

  const seededStatus: CommandStatus = dryRun ? 'pending' : 'dispatched'
  const created = await createPersistedRun({
    input,
    correlationId,
    idempotencyKey,
    status: seededStatus,
  })
  const record = created.record

  void emitCommandEvent(
    'workflow.run.created',
    {
      runId: record.id,
      workflowId: input.workflowId,
      orgId: input.orgId,
      requestId: input.requestId,
      correlationId,
      dryRun,
      authorizationDecisionId: input.authorizationDecisionId,
      initiatedBy: input.initiatedBy.actorId,
    },
    input.initiatedBy.actorId,
  )

  if (dryRun) {
    if (toExecutionStatus(record.status, parseExecutionArgs(record)) === 'succeeded') {
      return toResult(record, created.duplicate)
    }

    try {
      const succeeded = await transitionRun(record.id, 'succeeded', {
        actor: input.initiatedBy.actorId,
        setResult: { dryRun: true, validated: true },
        completed: true,
      })
      return toResult(succeeded, created.duplicate)
    } catch (error) {
      if (String(error).includes('Version conflict')) {
        const latest = await getCommandById(record.id)
        if (latest) return toResult(latest, true)
      }
      throw error
    }
  }

  startExecutionRecoveryLoop()
  void processRun(record.id)

  return toResult(record, created.duplicate)
}

async function processRun(runId: string): Promise<void> {
  if (processingRuns.has(runId)) return
  processingRuns.add(runId)

  try {
    let run = await getCommandById(runId)
    if (!run) return

    const runModel = toExecutionRun(run)
    if (isTerminal(runModel.status)) return

    const claimed = await claimExecutionLease({
      id: run.id,
      expectedVersion: run.version,
      owner: INSTANCE_ID,
      leaseMs: LEASE_MS,
    })
    if (claimed.conflict || !claimed.record) return

    run = claimed.record
    const args = parseExecutionArgs(run)
    if (!args) {
      await releaseExecutionLease({
        id: run.id,
        expectedVersion: run.version,
        actor: INSTANCE_ID,
        status: 'failed',
        error_message: 'Missing execution args payload',
        completed: true,
      })
      return
    }

    void emitCommandEvent(
      'workflow.run.started',
      {
        runId: run.id,
        workflowId: args.workflowId,
        orgId: args.orgId,
        correlationId: args.correlationId,
      },
      args.initiatedBy.actorId,
    )

    let attempt = args.retryCount
    while (attempt <= DEFAULT_RETRY_POLICY.maxAttempts) {
      const renewed = await renewExecutionLease({
        id: run.id,
        expectedVersion: run.version,
        owner: INSTANCE_ID,
        leaseMs: LEASE_MS,
      })
      if (renewed.conflict || !renewed.record) {
        logger.warn('Lease renewal conflict, stopping local processing', { runId: run.id })
        return
      }
      run = renewed.record

      try {
        const ok = await dispatchWorkflow({
          playbook: args.workflowId,
          correlation_id: args.correlationId,
          dry_run: false,
          args_json: JSON.stringify(args.payload),
        })

        if (!ok) {
          throw new Error(`Dispatch returned false for ${args.workflowId}`)
        }

        const success = await releaseExecutionLease({
          id: run.id,
          expectedVersion: run.version,
          actor: args.initiatedBy.actorId,
          status: 'succeeded',
          attempt_count: attempt,
          args: mergeExecutionArgs(args, {
            retryCount: attempt,
            result: { dispatched: true, attempts: attempt + 1 },
            failureClass: undefined,
            failureMessage: undefined,
          }),
          completed: true,
        })
        if (success.record) {
          void emitCommandEvent(
            'workflow.run.succeeded',
            {
              runId: success.record.id,
              workflowId: args.workflowId,
              correlationId: args.correlationId,
              attempt,
            },
            args.initiatedBy.actorId,
          )
        }
        return
      } catch (error) {
        attempt += 1
        const failureClass = classifyFailure(error)
        const retryable = DEFAULT_RETRY_POLICY.retryableFailureClasses.includes(failureClass)

        if (!retryable || attempt > DEFAULT_RETRY_POLICY.maxAttempts) {
          const deadLettered = attempt > DEFAULT_RETRY_POLICY.maxAttempts
          const terminal = await releaseExecutionLease({
            id: run.id,
            expectedVersion: run.version,
            actor: args.initiatedBy.actorId,
            status: 'failed',
            attempt_count: attempt - 1,
            error_message: String(error),
            args: mergeExecutionArgs(args, {
              retryCount: attempt - 1,
              failureClass,
              failureMessage: String(error),
              result: deadLettered ? { deadLettered: true, attempts: attempt } : undefined,
            }),
            completed: true,
          })
          if (terminal.record) {
            void emitCommandEvent(
              deadLettered ? 'workflow.run.dead_lettered' : 'workflow.run.failed',
              {
                runId: terminal.record.id,
                workflowId: args.workflowId,
                correlationId: args.correlationId,
                failureClass,
                attempt,
                error: String(error),
              },
              args.initiatedBy.actorId,
            )
          }
          return
        }

        const retrying = await transitionRun(run.id, 'running', {
          actor: args.initiatedBy.actorId,
          expectedVersion: run.version,
          setAttemptCount: attempt,
          setFailureClass: failureClass,
          setFailureMessage: String(error),
          setResult: args.result,
        })
        run = retrying
        args.retryCount = attempt
        args.failureClass = failureClass
        args.failureMessage = String(error)

        void emitCommandEvent(
          'workflow.run.step.retrying',
          {
            runId: run.id,
            workflowId: args.workflowId,
            correlationId: args.correlationId,
            attempt,
            failureClass,
          },
          args.initiatedBy.actorId,
        )

        const backoff = Math.min(
          DEFAULT_RETRY_POLICY.backoffMs * Math.pow(DEFAULT_RETRY_POLICY.backoffMultiplier, attempt - 1),
          DEFAULT_RETRY_POLICY.maxBackoffMs,
        )
        await sleep(backoff)
      }
    }
  } finally {
    processingRuns.delete(runId)
  }
}

async function recoverAndResumeRuns(): Promise<void> {
  try {
    const recovered = await recoverExpiredLeases(100)
    if (recovered.length > 0) {
      logger.warn('Recovered expired execution leases', {
        instanceId: INSTANCE_ID,
        recovered: recovered.length,
      })
    }

    const dispatched = await listCommands(200, { statuses: ['dispatched'] })
    for (const run of dispatched) {
      if (!processingRuns.has(run.id)) {
        void processRun(run.id)
      }
    }
  } catch (error) {
    logger.error('Recovery loop failure', { error })
  }
}

export async function cancelWorkflowRun(
  runId: string,
  cancelledBy: string,
): Promise<{ cancelled: boolean; reason?: string }> {
  const run = await getCommandById(runId)
  if (!run) {
    return { cancelled: false, reason: 'Run not found' }
  }

  const runModel = toExecutionRun(run)
  if (isTerminal(runModel.status)) {
    return { cancelled: false, reason: `Run is already in terminal state: ${runModel.status}` }
  }

  const cancelled = await transitionRun(run.id, 'cancelled', {
    actor: cancelledBy,
    expectedVersion: run.version,
    completed: true,
  })

  void emitCommandEvent(
    'workflow.run.cancelled',
    {
      runId: cancelled.id,
      workflowId: runModel.workflowId,
      correlationId: runModel.correlationId,
      cancelledBy,
    },
    cancelledBy,
  )

  return { cancelled: true }
}

export async function retryWorkflowRun(
  runId: string,
  requestedBy: string,
): Promise<{ retried: boolean; reason?: string; run?: ExecutionRun }> {
  const run = await getCommandById(runId)
  if (!run) return { retried: false, reason: 'Run not found' }

  const model = toExecutionRun(run)
  if (!(model.status === 'failed' || model.status === 'dead_lettered')) {
    return { retried: false, reason: `Only failed runs can be retried (current: ${model.status})` }
  }

  const args = parseExecutionArgs(run)
  if (!args) return { retried: false, reason: 'Run missing args payload' }

  const retried = await transitionRun(run.id, 'dispatched', {
    actor: requestedBy,
    expectedVersion: run.version,
    clearFailure: true,
    setResult: { retriedFromFailure: true },
  })

  void emitCommandEvent(
    'workflow.run.step.retrying',
    {
      runId: retried.id,
      workflowId: args.workflowId,
      correlationId: args.correlationId,
      requestedBy,
      manualRetry: true,
    },
    requestedBy,
  )

  startExecutionRecoveryLoop()
  void processRun(retried.id)

  return { retried: true, run: toExecutionRun(retried) }
}

export async function getWorkflowRun(runId: string): Promise<ExecutionRun | null> {
  const record = await getCommandById(runId)
  if (!record) return null
  return toExecutionRun(record)
}

export async function listWorkflowRuns(filter?: {
  orgId?: string
  workflowId?: string
  status?: ExecutionStatus
  limit?: number
}): Promise<ExecutionRun[]> {
  const cap = filter?.limit ? Math.max(filter.limit, 100) : 500
  const records = await listCommands(cap, {
    orgId: filter?.orgId,
  })

  let runs = records.map(toExecutionRun)
  if (filter?.workflowId) runs = runs.filter((r) => r.workflowId === filter.workflowId)
  if (filter?.status) runs = runs.filter((r) => r.status === filter.status)
  runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return filter?.limit ? runs.slice(0, filter.limit) : runs
}

export async function getExecutionMetrics(): Promise<{
  queueDepth: number
  p95LatencyMs: number
  failureRate: number
  totalRetries: number
  stuckCount: number
}> {
  const runs = await listWorkflowRuns({ limit: 1000 })
  const total = runs.length || 1
  const queueDepth = runs.filter((r) => r.status === 'pending' || r.status === 'queued' || r.status === 'running').length
  const failed = runs.filter((r) => r.status === 'failed' || r.status === 'dead_lettered').length
  const totalRetries = runs.reduce((sum, r) => sum + r.retryCount, 0)

  const latencies = runs
    .filter((r) => !!r.completedAt)
    .map((r) => Math.max(0, new Date(r.completedAt as string).getTime() - new Date(r.startedAt).getTime()))
    .sort((a, b) => a - b)

  const p95LatencyMs = latencies.length === 0
    ? 0
    : latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))]

  const now = Date.now()
  const stuckCount = runs.filter((r) => {
    if (r.status !== 'running') return false
    return now - new Date(r.updatedAt).getTime() > STUCK_THRESHOLD_MS
  }).length

  return {
    queueDepth,
    p95LatencyMs,
    failureRate: Math.round((failed / total) * 10_000) / 100,
    totalRetries,
    stuckCount,
  }
}

function mergeExecutionArgs(
  args: StoredExecutionArgs,
  updates: {
    retryCount?: number
    result?: Record<string, unknown>
    failureClass?: FailureClass
    failureMessage?: string
  },
): Record<string, unknown> {
  return {
    ...args,
    retryCount: updates.retryCount ?? args.retryCount,
    result: updates.result ?? args.result,
    failureClass: updates.failureClass,
    failureMessage: updates.failureMessage,
  }
}

async function createPersistedRun(params: {
  input: ExecuteWorkflowInput
  correlationId: string
  idempotencyKey: string
  status: CommandStatus
  failureClass?: FailureClass
  failureMessage?: string
}): Promise<{ record: CommandRecord; duplicate: boolean }> {
  const { input, correlationId, idempotencyKey, status, failureClass, failureMessage } = params

  const args: StoredExecutionArgs = {
    workflowId: input.workflowId,
    orgId: input.orgId,
    requestId: input.requestId,
    correlationId,
    idempotencyKey,
    initiatedBy: input.initiatedBy,
    payload: input.payload ?? {},
    dryRun: input.executionContext?.dryRun ?? false,
    authorizationDecisionId: input.authorizationDecisionId,
    retryCount: 0,
    failureClass,
    failureMessage,
  }

  const requestedId = randomUUID()
  const record = await createCommand({
    id: requestedId,
    org_id: input.orgId,
    correlation_id: correlationId,
    idempotency_key: idempotencyKey,
    playbook: PlaybookName.parse(input.workflowId),
    status,
    version: 1,
    attempt_count: 0,
    dry_run: args.dryRun,
    requested_by: input.initiatedBy.actorId,
    args: args as unknown as Record<string, unknown>,
    run_id: null,
    run_url: null,
    error_message: failureMessage ?? null,
    execution_owner: null,
    lease_expires_at: null,
    last_heartbeat_at: null,
    started_at: null,
    completed_at: null,
  })

  return {
    record,
    duplicate: record.id !== requestedId,
  }
}

async function transitionRun(
  runId: string,
  nextStatus: CommandStatus,
  opts: {
    actor: string
    expectedVersion?: number
    setAttemptCount?: number
    setFailureClass?: FailureClass
    setFailureMessage?: string
    setResult?: Record<string, unknown>
    clearFailure?: boolean
    completed?: boolean
  },
): Promise<CommandRecord> {
  for (let i = 0; i < 4; i += 1) {
    const current = await getCommandById(runId)
    if (!current) {
      throw new Error(`Run ${runId} not found`) 
    }

    if (!isLegalTransition(current.status, nextStatus)) {
      throw new Error(`Illegal lifecycle transition ${current.status} -> ${nextStatus}`)
    }

    const args = parseExecutionArgs(current)
    const nextArgs = args
      ? mergeExecutionArgs(args, {
        retryCount: opts.setAttemptCount,
        failureClass: opts.clearFailure ? undefined : opts.setFailureClass,
        failureMessage: opts.clearFailure ? undefined : opts.setFailureMessage,
        result: opts.setResult,
      })
      : current.args

    const update = await updateCommandById({
      id: current.id,
      status: nextStatus,
      expectedVersion: opts.expectedVersion ?? current.version,
      actor: opts.actor,
      args: nextArgs,
      attempt_count: opts.setAttemptCount,
      error_message: opts.clearFailure ? null : (opts.setFailureMessage ?? current.error_message),
      completed_at: opts.completed ? nowISO() : undefined,
      eventType: nextStatus,
    })

    if (update.record) {
      return update.record
    }
  }

  throw new Error(`Version conflict while transitioning run ${runId} to ${nextStatus}`)
}

function parseExecutionArgs(record: CommandRecord): StoredExecutionArgs | null {
  const args = record.args as Partial<StoredExecutionArgs>
  if (!args || typeof args !== 'object') return null
  if (!args.workflowId || !args.orgId || !args.requestId || !args.correlationId) return null

  return {
    workflowId: args.workflowId,
    orgId: args.orgId,
    requestId: args.requestId,
    correlationId: args.correlationId,
    idempotencyKey: args.idempotencyKey ?? `${args.workflowId}:${args.requestId}`,
    initiatedBy: args.initiatedBy ?? {
      actorId: record.requested_by,
      actorType: 'service',
      orgId: args.orgId,
    },
    payload: args.payload ?? {},
    dryRun: args.dryRun ?? record.dry_run,
    authorizationDecisionId: args.authorizationDecisionId,
    retryCount: args.retryCount ?? record.attempt_count,
    result: args.result,
    failureClass: args.failureClass,
    failureMessage: args.failureMessage,
  }
}

function toExecutionRun(record: CommandRecord): ExecutionRun {
  const args = parseExecutionArgs(record)
  const now = nowISO()
  const fallbackInitiatedBy: ActorIdentity = {
    actorId: record.requested_by || 'system',
    actorType: 'service',
    orgId: args?.orgId ?? record.org_id,
  }

  const status = toExecutionStatus(record.status, args)
  const startedAt = record.started_at ?? record.created_at ?? now
  const updatedAt = record.updated_at ?? startedAt

  return {
    runId: record.id,
    workflowId: args?.workflowId ?? record.playbook,
    orgId: args?.orgId ?? record.org_id,
    requestId: args?.requestId ?? record.correlation_id,
    correlationId: args?.correlationId ?? record.correlation_id,
    idempotencyKey: args?.idempotencyKey ?? record.idempotency_key,
    initiatedBy: args?.initiatedBy ?? fallbackInitiatedBy,
    status,
    dryRun: args?.dryRun ?? record.dry_run,
    retryCount: args?.retryCount ?? record.attempt_count,
    failureClass: args?.failureClass,
    failureMessage: args?.failureMessage ?? record.error_message ?? undefined,
    decisionId: args?.authorizationDecisionId,
    payload: args?.payload ?? {},
    result: args?.result,
    startedAt,
    updatedAt,
    completedAt: record.completed_at ?? undefined,
  }
}

function toResult(record: CommandRecord, idempotent: boolean): ExecuteWorkflowResult {
  const run = toExecutionRun(record)
  return {
    runId: run.runId,
    status: run.status,
    idempotent,
    dryRun: run.dryRun,
    workflowId: run.workflowId,
    orgId: run.orgId,
    requestId: run.requestId,
    correlationId: run.correlationId,
    failureClass: run.failureClass,
    failureMessage: run.failureMessage,
    startedAt: run.startedAt,
  }
}

function toExecutionStatus(status: CommandStatus, args?: StoredExecutionArgs | null): ExecutionStatus {
  if (status === 'pending' || status === 'approved') return 'pending'
  if (status === 'dispatched') return 'queued'
  if (status === 'running') return 'running'
  if (status === 'succeeded') return 'succeeded'
  if (status === 'failed') {
    const deadLettered =
      !!args?.result
      && typeof args.result === 'object'
      && args.result !== null
      && Boolean((args.result as Record<string, unknown>).deadLettered)
    return deadLettered ? 'dead_lettered' : 'failed'
  }
  if (status === 'cancelled') return 'cancelled'
  return 'failed'
}

function isLegalTransition(from: CommandStatus, to: CommandStatus): boolean {
  if (from === to) return true
  return LEGAL_TRANSITIONS[from].includes(to)
}

function isTerminal(status: ExecutionStatus): boolean {
  return status === 'succeeded' || status === 'failed' || status === 'cancelled' || status === 'dead_lettered'
}

function classifyFailure(error: unknown): FailureClass {
  const msg = String(error).toLowerCase()
  if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized')) return 'auth_failure'
  if (msg.includes('400') || msg.includes('invalid')) return 'input_invalid'
  if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout'
  if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('enotfound')) return 'transient'
  return 'transient'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
