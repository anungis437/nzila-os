/**
 * @nzila/zonga-control-plane — Workflow Orchestrator
 *
 * Executes multi-step workflows with retry, compensation (rollback),
 * and step-level audit event emission. ALL critical operations
 * flow through this orchestrator — no bypass is permitted.
 */
import type {
  ControlPlaneContext,
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowStep,
  WorkflowStepResult,
  SystemEvent,
} from './types'
import {
  WorkflowStepStatus,
  WorkflowExecutionStatus,
  SystemEventType,
  AuditSeverity,
} from './types'
import { emitSystemEvent, buildSystemEvent } from './system-events'

// ── Workflow Registry ─────────────────────────────────────────────────────

const workflowRegistry = new Map<string, WorkflowDefinition>()

export function registerWorkflow(definition: WorkflowDefinition): void {
  if (workflowRegistry.has(definition.id)) {
    throw new Error(`Workflow ${definition.id} is already registered`)
  }
  workflowRegistry.set(definition.id, definition)
}

export function getWorkflowDefinition(id: string): WorkflowDefinition | undefined {
  return workflowRegistry.get(id)
}

export function listRegisteredWorkflows(): readonly WorkflowDefinition[] {
  return [...workflowRegistry.values()]
}

// ── Execution Engine ──────────────────────────────────────────────────────

let executionIdCounter = 0

function generateExecutionId(): string {
  executionIdCounter++
  return `wf_exec_${Date.now()}_${executionIdCounter}`
}

/**
 * Execute a workflow with full orchestration: step execution, retry, compensation.
 * Every step emits audit events. Failed workflows trigger compensation (rollback).
 */
export async function executeWorkflow(
  workflowId: string,
  context: ControlPlaneContext,
  input: Record<string, unknown>,
): Promise<WorkflowExecution> {
  const definition = workflowRegistry.get(workflowId)
  if (!definition) {
    throw new WorkflowNotFoundError(workflowId)
  }

  const executionId = generateExecutionId()
  const steps: WorkflowStep[] = definition.steps.map((stepDef) => ({
    id: stepDef.id,
    name: stepDef.name,
    status: WorkflowStepStatus.PENDING,
    retryCount: 0,
    maxRetries: stepDef.maxRetries,
  }))

  let execution: WorkflowExecution = {
    id: executionId,
    workflowId: definition.id,
    orgId: context.orgId,
    actorId: context.actorId,
    correlationId: context.correlationId,
    status: WorkflowExecutionStatus.RUNNING,
    steps,
    currentStepIndex: 0,
    input,
    startedAt: new Date(),
    retryCount: 0,
    maxRetries: definition.maxRetries,
    timeoutMs: definition.timeoutMs,
  }

  emitSystemEvent(buildSystemEvent({
    type: SystemEventType.WORKFLOW_STARTED,
    orgId: context.orgId,
    actorId: context.actorId,
    entityId: executionId,
    entityType: 'workflow_execution',
    correlationId: context.correlationId,
    workflowId: definition.id,
    workflowExecutionId: executionId,
    payload: { workflowId, input, stepCount: steps.length },
    severity: AuditSeverity.INFO,
  }))

  const completedStepOutputs: Record<string, Record<string, unknown>> = {}
  let lastOutput: Record<string, unknown> | undefined

  for (let i = 0; i < definition.steps.length; i++) {
    const stepDef = definition.steps[i]!
    const step = steps[i]!

    execution = { ...execution, currentStepIndex: i }

    const stepResult = await executeStepWithRetry(
      stepDef,
      context,
      input,
      lastOutput,
      executionId,
    )

    if (stepResult.success) {
      steps[i] = {
        ...step,
        status: WorkflowStepStatus.COMPLETED,
        completedAt: new Date(),
        output: stepResult.output,
      }
      if (stepResult.output) {
        completedStepOutputs[stepDef.id] = stepResult.output
        lastOutput = stepResult.output
      }

      emitSystemEvent(buildSystemEvent({
        type: SystemEventType.WORKFLOW_STEP_COMPLETED,
        orgId: context.orgId,
        actorId: context.actorId,
        entityId: executionId,
        entityType: 'workflow_step',
        correlationId: context.correlationId,
        workflowId: definition.id,
        workflowExecutionId: executionId,
        payload: { stepId: stepDef.id, stepName: stepDef.name, output: stepResult.output },
        severity: AuditSeverity.INFO,
      }))
    } else {
      steps[i] = {
        ...step,
        status: WorkflowStepStatus.FAILED,
        completedAt: new Date(),
        error: stepResult.error,
      }

      emitSystemEvent(buildSystemEvent({
        type: SystemEventType.WORKFLOW_STEP_FAILED,
        orgId: context.orgId,
        actorId: context.actorId,
        entityId: executionId,
        entityType: 'workflow_step',
        correlationId: context.correlationId,
        workflowId: definition.id,
        workflowExecutionId: executionId,
        payload: { stepId: stepDef.id, stepName: stepDef.name, error: stepResult.error },
        severity: AuditSeverity.ERROR,
      }))

      // Compensate — rollback all previously completed steps
      await compensateWorkflow(
        definition,
        context,
        input,
        completedStepOutputs,
        steps,
        i,
        executionId,
      )

      return {
        ...execution,
        steps,
        status: WorkflowExecutionStatus.COMPENSATED,
        completedAt: new Date(),
        error: stepResult.error,
      }
    }
  }

  emitSystemEvent(buildSystemEvent({
    type: SystemEventType.WORKFLOW_COMPLETED,
    orgId: context.orgId,
    actorId: context.actorId,
    entityId: executionId,
    entityType: 'workflow_execution',
    correlationId: context.correlationId,
    workflowId: definition.id,
    workflowExecutionId: executionId,
    payload: { input, output: lastOutput },
    severity: AuditSeverity.INFO,
  }))

  return {
    ...execution,
    steps,
    status: WorkflowExecutionStatus.COMPLETED,
    completedAt: new Date(),
    output: lastOutput,
  }
}

/**
 * Execute a single step with retry logic.
 */
async function executeStepWithRetry(
  stepDef: WorkflowDefinition['steps'][number],
  context: ControlPlaneContext,
  input: Record<string, unknown>,
  previousOutput: Record<string, unknown> | undefined,
  executionId: string,
): Promise<WorkflowStepResult> {
  let lastError: string | undefined
  for (let attempt = 0; attempt <= stepDef.maxRetries; attempt++) {
    try {
      const result = await stepDef.execute(context, input, previousOutput)
      if (result.success) {
        return result
      }
      if (!result.shouldRetry) {
        return result
      }
      lastError = result.error
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }
  }
  return { success: false, error: lastError ?? 'Step failed after all retries' }
}

/**
 * Run compensation (rollback) for all completed steps in reverse order.
 */
async function compensateWorkflow(
  definition: WorkflowDefinition,
  context: ControlPlaneContext,
  input: Record<string, unknown>,
  completedOutputs: Record<string, Record<string, unknown>>,
  steps: WorkflowStep[],
  failedAtIndex: number,
  executionId: string,
): Promise<void> {
  emitSystemEvent(buildSystemEvent({
    type: SystemEventType.WORKFLOW_COMPENSATING,
    orgId: context.orgId,
    actorId: context.actorId,
    entityId: executionId,
    entityType: 'workflow_execution',
    correlationId: context.correlationId,
    payload: { failedAtStep: failedAtIndex },
    severity: AuditSeverity.WARNING,
  }))

  // Compensate in reverse order
  for (let i = failedAtIndex - 1; i >= 0; i--) {
    const stepDef = definition.steps[i]!
    if (!stepDef.compensate) {
      steps[i] = { ...steps[i]!, status: WorkflowStepStatus.SKIPPED }
      continue
    }

    try {
      const stepOutput = completedOutputs[stepDef.id] ?? {}
      await stepDef.compensate(context, input, stepOutput)
      steps[i] = { ...steps[i]!, status: WorkflowStepStatus.COMPENSATED }
    } catch (err) {
      // Compensation failure is critical — log but continue compensating other steps
      steps[i] = {
        ...steps[i]!,
        status: WorkflowStepStatus.FAILED,
        error: `Compensation failed: ${err instanceof Error ? err.message : String(err)}`,
      }
    }
  }

  emitSystemEvent(buildSystemEvent({
    type: SystemEventType.WORKFLOW_COMPENSATED,
    orgId: context.orgId,
    actorId: context.actorId,
    entityId: executionId,
    entityType: 'workflow_execution',
    correlationId: context.correlationId,
    payload: {
      compensatedSteps: steps.filter((s) => s.status === WorkflowStepStatus.COMPENSATED).length,
      failedCompensations: steps.filter(
        (s) => s.status === WorkflowStepStatus.FAILED && s.error?.startsWith('Compensation'),
      ).length,
    },
    severity: AuditSeverity.WARNING,
  }))
}

// ── Error Types ───────────────────────────────────────────────────────────

export class WorkflowNotFoundError extends Error {
  constructor(public readonly workflowId: string) {
    super(`Workflow not found: ${workflowId}`)
    this.name = 'WorkflowNotFoundError'
  }
}

export class WorkflowBypassError extends Error {
  constructor(
    public readonly operation: string,
    public readonly requiredWorkflow: string,
  ) {
    super(
      `Operation "${operation}" must be executed through workflow "${requiredWorkflow}". Direct execution is prohibited.`,
    )
    this.name = 'WorkflowBypassError'
  }
}
