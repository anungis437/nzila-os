import { randomUUID } from 'node:crypto'
import type { AgentWorkflow, WorkflowStep, WorkflowStatus } from './types'
import { recordAuditEvent } from '@nzila/platform-governance'
import { isVerifiedOutcomeFor, serializeOutcomeProof, type VerifiedOutcomeProof } from './outcome-proof'

export function createWorkflow(params: {
  name: string
  triggerEvent: string
  app: string
  orgId: string
  steps: Array<{ name: string }>
}): AgentWorkflow {
  const workflow: AgentWorkflow = {
    id: randomUUID(),
    name: params.name,
    triggerEvent: params.triggerEvent,
    app: params.app,
    orgId: params.orgId,
    status: 'pending',
    steps: params.steps.map((s) => ({
      id: randomUUID(),
      name: s.name,
      status: 'pending' as WorkflowStatus,
    })),
    createdAt: new Date().toISOString(),
  }
  recordAuditEvent({
    eventType: 'workflow_created',
    actor: 'agent-workflow-runner',
    orgId: params.orgId,
    app: params.app,
    policyResult: 'pass',
    commitHash: 'runtime',
    details: { workflowId: workflow.id, workflowName: params.name, triggerEvent: params.triggerEvent },
  })
  return workflow
}

/**
 * FAIL CLOSED: neither a policy assertion nor arbitrary step output proves a
 * result. Completion requires a runtime-minted, scope-bound independent proof.
 * The proof's trusted verifier must be configured by the host, not the agent.
 */
export function executeStep(
  workflow: AgentWorkflow,
  stepId: string,
  params: {
    policyCheck?: { policyId: string; result: 'allow' | 'deny' | 'requires_approval' }
    verifiedOutcome?: VerifiedOutcomeProof
    output?: Record<string, unknown>
  },
): AgentWorkflow {
  const target = workflow.steps.find(step => step.id === stepId)
  if (!target) throw new Error('Workflow step does not exist')
  if (target.status === 'completed') {
    throw new Error('Completed steps are immutable; a new workflow revision is required')
  }
  const policyAllows = params.policyCheck?.result === 'allow' &&
    Boolean(params.policyCheck.policyId)
  const evidenceValid = isVerifiedOutcomeFor(params.verifiedOutcome, workflow, stepId)
  const completes = policyAllows && evidenceValid
  const reason = !policyAllows
    ? 'Explicit policy ALLOW is required'
    : !evidenceValid
      ? 'Independent outcome proof is required'
      : undefined
  const updatedSteps: WorkflowStep[] = workflow.steps.map((step) => {
    if (step.id !== stepId) return step
    if (!completes) return {
      ...step,
      status: 'blocked',
      policyCheck: params.policyCheck,
      error: reason,
    }
    return {
      ...step,
      status: 'completed',
      policyCheck: params.policyCheck,
      outcomeEvidence: serializeOutcomeProof(params.verifiedOutcome!),
      output: params.output,
      error: undefined,
    }
  })
  const allCompleted = updatedSteps.length > 0 && updatedSteps.every(s => s.status === 'completed')
  const anyFailed = updatedSteps.some(s => s.status === 'failed')
  const anyBlocked = updatedSteps.some(s => s.status === 'blocked')
  let status: WorkflowStatus = 'running'
  if (allCompleted) status = 'completed'
  else if (anyFailed) status = 'failed'
  else if (anyBlocked) status = 'blocked'
  emitStepAuditEvent(workflow, stepId, completes ? 'pass' : 'fail', {
    stepStatus: updatedSteps.find(s => s.id === stepId)?.status,
    workflowStatus: status,
    policyCheck: params.policyCheck,
    verificationRef: completes ? params.verifiedOutcome?.evidence.verificationRef : undefined,
    failureReason: reason,
  })
  return {
    ...workflow,
    steps: updatedSteps,
    status,
    completedAt: allCompleted ? new Date().toISOString() : undefined,
  }
}

function emitStepAuditEvent(
  workflow: AgentWorkflow,
  stepId: string,
  policyResult: 'pass' | 'fail' | 'warn',
  details: Record<string, unknown>,
): void {
  recordAuditEvent({
    eventType: 'workflow_step_executed',
    actor: 'agent-workflow-runner',
    orgId: workflow.orgId,
    app: workflow.app,
    policyResult,
    commitHash: 'runtime',
    details: { workflowId: workflow.id, stepId, ...details },
  })
}
