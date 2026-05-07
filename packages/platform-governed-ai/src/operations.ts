/**
 * @nzila/platform-governed-ai — Operations
 *
 * Execute governed AI operations: policy pre-check → model invocation →
 * evidence grounding → decision record → audit persistence.
 */
import type {
  AIRunRecord,
  AIRunRequest,
  AIRunStore,
  AIModelProvider,
  PolicyEvaluator,
  EvidenceItem,
} from './types'
import { AIRunStatuses } from './types'
import type { OntologyEntityType } from '@nzila/platform-ontology'

// ── ID Generation ───────────────────────────────────────────────────────────

let idCounter = 0
function generateId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  idCounter++
  return `00000000-0000-0000-0000-${String(idCounter).padStart(12, '0')}`
}

// ── Execute Governed AI Run ─────────────────────────────────────────────────

export interface ExecuteAIRunOptions {
  store: AIRunStore
  provider: AIModelProvider
  policyEvaluator: PolicyEvaluator
  request: AIRunRequest
  evidence?: readonly EvidenceItem[]
  context?: Record<string, unknown>
}

/**
 * Execute a governed AI operation:
 * 1. Evaluate policy constraints
 * 2. If any policy blocks, reject with REJECTED_BY_POLICY
 * 3. Invoke the model
 * 4. Persist the AI run record
 */
export async function executeGovernedAIRun(
  options: ExecuteAIRunOptions,
): Promise<AIRunRecord> {
  const {
    store,
    provider,
    policyEvaluator,
    request,
    evidence = [],
    context = {},
  } = options

  const startTime = performance.now()
  const now = new Date().toISOString()

  // Step 1: Evaluate policies
  const policyConstraints = await policyEvaluator.evaluate(
    request.tenantId,
    request.operationType as AIRunRecord['operationType'],
    request.entityType as OntologyEntityType,
    request.input,
  )

  const blocked = policyConstraints.filter((p) => !p.satisfied)
  if (blocked.length > 0) {
    const run: AIRunRecord = {
      id: generateId(),
      tenantId: request.tenantId,
      operationType: request.operationType as AIRunRecord['operationType'],
      status: AIRunStatuses.REJECTED_BY_POLICY,
      modelId: request.modelId,
      modelVersion: provider.modelVersion,
      entityType: request.entityType as OntologyEntityType,
      resourceId: request.resourceId,
      input: request.input,
      output: null,
      confidence: null,
      evidence,
      policyConstraints,
      reasoning: `Blocked by policies: ${blocked.map((b) => b.policyName).join(', ')}`,
      latencyMs: performance.now() - startTime,
      createdAt: now,
      completedAt: new Date().toISOString(),
      requestedBy: request.requestedBy,
    }
    await store.persistRun(run)
    return run
  }

  // Step 2: Invoke the model
  try {
    const result = await provider.invoke(request.input, context)
    const latencyMs = performance.now() - startTime

    const run: AIRunRecord = {
      id: generateId(),
      tenantId: request.tenantId,
      operationType: request.operationType as AIRunRecord['operationType'],
      status: AIRunStatuses.COMPLETED,
      modelId: request.modelId,
      modelVersion: provider.modelVersion,
      entityType: request.entityType as OntologyEntityType,
      resourceId: request.resourceId,
      input: request.input,
      output: result.output,
      confidence: result.confidence,
      evidence,
      policyConstraints,
      reasoning: result.reasoning,
      tokenUsage: result.tokenUsage,
      latencyMs,
      createdAt: now,
      completedAt: new Date().toISOString(),
      requestedBy: request.requestedBy,
    }
    await store.persistRun(run)
    return run
  } catch (error) {
    const latencyMs = performance.now() - startTime
    const run: AIRunRecord = {
      id: generateId(),
      tenantId: request.tenantId,
      operationType: request.operationType as AIRunRecord['operationType'],
      status: AIRunStatuses.FAILED,
      modelId: request.modelId,
      modelVersion: provider.modelVersion,
      entityType: request.entityType as OntologyEntityType,
      resourceId: request.resourceId,
      input: request.input,
      output: null,
      confidence: null,
      evidence,
      policyConstraints,
      reasoning:
        error instanceof Error ? error.message : 'Unknown error',
      latencyMs,
      createdAt: now,
      completedAt: new Date().toISOString(),
      requestedBy: request.requestedBy,
    }
    await store.persistRun(run)
    return run
  }
}

// ── Get AI Run History ──────────────────────────────────────────────────────

export async function getAIRunHistory(
  store: AIRunStore,
  entityType: OntologyEntityType,
  resourceId: string,
): Promise<readonly AIRunRecord[]> {
  return store.getRunsByEntity(entityType, resourceId)
}

// ── Get AI Run by ID ────────────────────────────────────────────────────────

export async function getAIRun(
  store: AIRunStore,
  runId: string,
): Promise<AIRunRecord | undefined> {
  return store.getRun(runId)
}
