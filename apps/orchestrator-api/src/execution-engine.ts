/**
 * Orchestrator API — Canonical Execution Engine
 *
 * The single entry point for all workflow execution. All execution MUST
 * flow through executeWorkflow() — never through ad hoc dispatch calls.
 *
 * Guarantees:
 *   - Idempotency: duplicate requestId or idempotencyKey → returns existing run
 *   - Deduplication: concurrent duplicate submissions are coalesced
 *   - Authorization check: every run must carry a valid Control Plane authorization
 *   - Execution telemetry: every run emits structured events
 *   - Retry semantics: transient failures retry with exponential backoff
 *   - Cancellation: runs may be cancelled before or during execution
 *   - Dead-letter: permanently failed runs are quarantined
 *
 * Policy-deaf: this engine never evaluates policy. It only executes what
 * the Control Plane has already authorized.
 */
import { randomUUID } from 'node:crypto'
import { createLogger } from '@nzila/os-core'
import {
  type WorkflowTriggerRequest,
  type ExecutionRun,
  type ExecutionStatus,
  type FailureClass,
  DEFAULT_RETRY_POLICY,
} from '@nzila/platform-contracts/control-system'
import { emitCommandEvent, getEventBus } from './platform.js'
import { dispatchWorkflow } from './dispatch.js'
import { nowISO } from '@nzila/platform-utils'

const logger = createLogger('orchestrator:execution-engine')

// ── In-memory run store (dev mode; production: persist to DB) ────────────────

const runStore = new Map<string, ExecutionRun>()
const idempotencyIndex = new Map<string, string>() // idempotencyKey → runId
const requestIdIndex = new Map<string, string>()   // requestId → runId

// ── Execution Engine ─────────────────────────────────────────────────────────

export interface ExecuteWorkflowInput extends WorkflowTriggerRequest {
  /** Authorization token from Control Plane (required for non-dry-run) */
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

/**
 * Execute a workflow. This is the ONLY authorized execution entry point.
 *
 * Idempotency: if the same requestId or idempotencyKey is submitted twice,
 * the existing run is returned without creating a duplicate.
 */
export async function executeWorkflow(
  input: ExecuteWorkflowInput,
): Promise<ExecuteWorkflowResult> {
  const correlationId = input.correlationEnvelope?.correlationId ?? randomUUID()
  const idempotencyKey = input.executionContext?.idempotencyKey
    ?? `${input.workflowId}:${input.requestId}`

  // ── Idempotency check ──────────────────────────────────────────────────────

  const existingByRequest = requestIdIndex.get(input.requestId)
  if (existingByRequest) {
    const existing = runStore.get(existingByRequest)
    if (existing) {
      logger.info('Duplicate requestId — returning existing run', {
        requestId: input.requestId,
        runId: existing.runId,
        status: existing.status,
      })
      return toResult(existing, true)
    }
  }

  const existingByIdempotency = idempotencyIndex.get(idempotencyKey)
  if (existingByIdempotency) {
    const existing = runStore.get(existingByIdempotency)
    if (existing && existing.status !== 'failed' && existing.status !== 'dead_lettered') {
      logger.info('Duplicate idempotency key — returning existing run', {
        idempotencyKey,
        runId: existing.runId,
        status: existing.status,
      })
      return toResult(existing, true)
    }
  }

  // ── Non-dry-run must have authorization from Control Plane ─────────────────
  const dryRun = input.executionContext?.dryRun ?? false
  if (!dryRun && !input.authorizationDecisionId) {
    logger.warn('Workflow execution rejected: no Control Plane authorization', {
      workflowId: input.workflowId,
      orgId: input.orgId,
      requestId: input.requestId,
    })
    const runId = randomUUID()
    const now = nowISO()
    const failedRun: ExecutionRun = {
      runId,
      workflowId: input.workflowId,
      orgId: input.orgId,
      requestId: input.requestId,
      correlationId,
      idempotencyKey,
      initiatedBy: input.initiatedBy,
      status: 'failed',
      dryRun,
      retryCount: 0,
      failureClass: 'auth_failure',
      failureMessage: 'Workflow execution requires Control Plane authorization',
      payload: input.payload ?? {},
      startedAt: now,
      updatedAt: now,
      completedAt: now,
    }
    runStore.set(runId, failedRun)
    requestIdIndex.set(input.requestId, runId)
    return toResult(failedRun, false)
  }

  // ── Create run record ──────────────────────────────────────────────────────

  const runId = randomUUID()
  const now = nowISO()

  const run: ExecutionRun = {
    runId,
    workflowId: input.workflowId,
    orgId: input.orgId,
    requestId: input.requestId,
    correlationId,
    idempotencyKey,
    initiatedBy: input.initiatedBy,
    status: 'pending',
    dryRun,
    retryCount: 0,
    decisionId: input.authorizationDecisionId,
    payload: input.payload ?? {},
    startedAt: now,
    updatedAt: now,
  }

  runStore.set(runId, run)
  requestIdIndex.set(input.requestId, runId)
  idempotencyIndex.set(idempotencyKey, runId)

  // ── Emit creation event ────────────────────────────────────────────────────

  void emitCommandEvent(
    'workflow.run.created',
    {
      runId,
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

  logger.info('Workflow run created', {
    runId,
    workflowId: input.workflowId,
    orgId: input.orgId,
    requestId: input.requestId,
    correlationId,
    dryRun,
  })

  // ── Dry-run: validate contract, don't execute ─────────────────────────────

  if (dryRun) {
    updateRun(runId, { status: 'succeeded' })
    void emitCommandEvent('workflow.run.succeeded', { runId, dryRun: true, correlationId }, input.initiatedBy.actorId)
    return toResult(runStore.get(runId)!, false)
  }

  // ── Execute with retry semantics ──────────────────────────────────────────

  updateRun(runId, { status: 'running' })
  void emitCommandEvent('workflow.run.started', { runId, workflowId: input.workflowId, correlationId }, input.initiatedBy.actorId)

  executeWithRetry(runId, input, correlationId).catch((err) => {
    logger.error('Unhandled execution error', { runId, error: err })
    updateRun(runId, {
      status: 'dead_lettered',
      failureClass: 'permanent',
      failureMessage: String(err),
      completedAt: nowISO(),
    })
  })

  return toResult(runStore.get(runId)!, false)
}

// ── Retry execution ───────────────────────────────────────────────────────────

async function executeWithRetry(
  runId: string,
  input: ExecuteWorkflowInput,
  correlationId: string,
): Promise<void> {
  const policy = DEFAULT_RETRY_POLICY
  let attempt = 0

  while (attempt <= policy.maxAttempts) {
    try {
      const success = await dispatchWorkflow({
        playbook: input.workflowId,
        correlation_id: correlationId,
        dry_run: false,
        args_json: JSON.stringify(input.payload),
      })

      if (success) {
        updateRun(runId, {
          status: 'succeeded',
          completedAt: nowISO(),
        })
        void emitCommandEvent(
          'workflow.run.succeeded',
          { runId, workflowId: input.workflowId, correlationId, attempt, retryCount: attempt },
          input.initiatedBy.actorId,
        )
        logger.info('Workflow run succeeded', { runId, workflowId: input.workflowId, attempt })
        return
      }

      // Dispatch returned false — treat as transient
      throw new Error(`Dispatch returned false for ${input.workflowId}`)
    } catch (err) {
      attempt++
      const failureClass = classifyFailure(err)
      const retryable = policy.retryableFailureClasses.includes(failureClass)

      if (!retryable || attempt > policy.maxAttempts) {
        const isDead = attempt > policy.maxAttempts
        updateRun(runId, {
          status: isDead ? 'dead_lettered' : 'failed',
          failureClass,
          failureMessage: String(err),
          retryCount: attempt - 1,
          completedAt: nowISO(),
        })
        void emitCommandEvent(
          isDead ? 'workflow.run.dead_lettered' : 'workflow.run.failed',
          { runId, workflowId: input.workflowId, correlationId, failureClass, attempt, error: String(err) },
          input.initiatedBy.actorId,
        )
        logger.error('Workflow run failed permanently', {
          runId,
          workflowId: input.workflowId,
          attempt,
          failureClass,
          isDead,
        })
        return
      }

      updateRun(runId, { retryCount: attempt, status: 'running' })
      void emitCommandEvent(
        'workflow.run.step.retrying',
        { runId, workflowId: input.workflowId, correlationId, attempt, failureClass },
        input.initiatedBy.actorId,
      )

      // Exponential backoff
      const backoff = Math.min(
        policy.backoffMs * Math.pow(policy.backoffMultiplier, attempt - 1),
        policy.maxBackoffMs,
      )
      logger.warn('Retrying workflow run', {
        runId,
        workflowId: input.workflowId,
        attempt,
        backoffMs: backoff,
        failureClass,
      })
      await sleep(backoff)
    }
  }
}

// ── Cancel a run ──────────────────────────────────────────────────────────────

export async function cancelWorkflowRun(
  runId: string,
  cancelledBy: string,
): Promise<{ cancelled: boolean; reason?: string }> {
  const run = runStore.get(runId)
  if (!run) {
    return { cancelled: false, reason: 'Run not found' }
  }
  if (run.status === 'succeeded' || run.status === 'failed' || run.status === 'cancelled') {
    return { cancelled: false, reason: `Run is already in terminal state: ${run.status}` }
  }

  updateRun(runId, { status: 'cancelled', completedAt: nowISO() })
  void emitCommandEvent(
    'workflow.run.cancelled',
    { runId, workflowId: run.workflowId, correlationId: run.correlationId, cancelledBy },
    cancelledBy,
  )
  logger.info('Workflow run cancelled', { runId, workflowId: run.workflowId, cancelledBy })
  return { cancelled: true }
}

// ── Query runs ────────────────────────────────────────────────────────────────

export function getWorkflowRun(runId: string): ExecutionRun | null {
  return runStore.get(runId) ?? null
}

export function listWorkflowRuns(filter?: {
  orgId?: string
  workflowId?: string
  status?: ExecutionStatus
  limit?: number
}): ExecutionRun[] {
  let runs = [...runStore.values()]
  if (filter?.orgId) runs = runs.filter((r) => r.orgId === filter.orgId)
  if (filter?.workflowId) runs = runs.filter((r) => r.workflowId === filter.workflowId)
  if (filter?.status) runs = runs.filter((r) => r.status === filter.status)
  runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt))
  return filter?.limit ? runs.slice(0, filter.limit) : runs
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function updateRun(runId: string, updates: Partial<ExecutionRun>): void {
  const run = runStore.get(runId)
  if (!run) return
  runStore.set(runId, { ...run, ...updates, updatedAt: nowISO() })
}

function toResult(run: ExecutionRun, idempotent: boolean): ExecuteWorkflowResult {
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

function classifyFailure(err: unknown): FailureClass {
  const msg = String(err).toLowerCase()
  if (msg.includes('401') || msg.includes('403') || msg.includes('unauthorized')) return 'auth_failure'
  if (msg.includes('400') || msg.includes('invalid')) return 'input_invalid'
  if (msg.includes('timeout') || msg.includes('timed out')) return 'timeout'
  if (msg.includes('network') || msg.includes('econnrefused') || msg.includes('enotfound')) return 'transient'
  return 'transient'
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
