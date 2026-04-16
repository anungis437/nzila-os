/**
 * Control Plane — Governance Action State Machine
 *
 * THE AUTHORITATIVE implementation of the governance action lifecycle.
 * Enforces:
 *   1. Policy evaluation before submission
 *   2. Required approvals before execution
 *   3. Audit events at every state transition
 *   4. Evidence pack generation on execution
 *
 * State flow:
 *   draft → pending_approval → approved → executed
 *                            ↘ rejected
 *
 * An action CANNOT transition to "executed" unless all required approvals
 * are "approved". This is the primary acceptance criterion.
 *
 * All governance mutations across the platform MUST flow through this module
 * via the Control Plane API. No app may write to governance tables directly.
 */
import 'server-only'

import { platformDb } from '@nzila/db/platform'
import { createLogger } from '@nzila/os-core'
import { governanceActions, approvals, orgs } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import {
  evaluateGovernanceRequirements,
  type GovernanceActionType,
  type PolicyConfig,
  type PolicyEvaluation,
  getResolutionTemplate,
} from '@nzila/os-core'
import { buildEvidencePackFromAction } from '@nzila/os-core/evidence/builder'
import { recordAuditEvent, AUDIT_ACTIONS } from '@/lib/audit-db'

const logger = createLogger('control-plane:governance:state-machine')

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateActionInput {
  orgId: string
  actionType: GovernanceActionType
  payload: Record<string, unknown>
  createdBy: string
}

export interface SubmitActionInput {
  actionId: string
  orgId: string
  submittedBy: string
  context?: {
    totalSharesOutstanding?: number
    quantity?: number
    amount?: number
    transferRestricted?: boolean
    rofrApplies?: boolean
  }
}

export interface ApproveActionInput {
  actionId: string
  orgId: string
  approvalId: string
  decidedBy: string
  decision: 'approved' | 'rejected'
  notes?: string
}

export interface ExecuteActionInput {
  actionId: string
  orgId: string
  executedBy: string
}

export interface GovernanceError {
  code: string
  message: string
  details?: unknown
}

type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: GovernanceError }

// ── 1. Create a governance action (draft) ───────────────────────────────────

export async function createGovernanceAction(
  input: CreateActionInput,
): Promise<Result<{ id: string }>> {
  const [action] = await platformDb
    .insert(governanceActions)
    .values({
      orgId: input.orgId,
      actionType: input.actionType,
      payload: input.payload,
      status: 'draft',
      createdBy: input.createdBy,
    })
    .returning({ id: governanceActions.id })

  await recordAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: input.createdBy,
    action: AUDIT_ACTIONS.GOVERNANCE_ACTION_CREATE,
    targetType: 'governance_action',
    targetId: action.id,
    afterJson: {
      actionType: input.actionType,
      status: 'draft',
      payload: input.payload,
    },
  })

  logger.info('Governance action created', { id: action.id, orgId: input.orgId, actionType: input.actionType })

  return { ok: true, data: { id: action.id } }
}

// ── 2. Submit for approval (draft → pending_approval) ───────────────────────

export async function submitGovernanceAction(
  input: SubmitActionInput,
): Promise<Result<{ evaluation: PolicyEvaluation; approvalIds: string[] }>> {
  const [action] = await platformDb
    .select()
    .from(governanceActions)
    .where(and(eq(governanceActions.orgId, input.orgId), eq(governanceActions.id, input.actionId)))
    .limit(1)

  if (!action) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Governance action not found' } }
  }
  if (action.status !== 'draft') {
    return {
      ok: false,
      error: { code: 'INVALID_STATE', message: `Cannot submit: action is "${action.status}", expected "draft"` },
    }
  }

  const [entity] = await platformDb
    .select({ policyConfig: orgs.policyConfig })
    .from(orgs)
    .where(eq(orgs.id, input.orgId))
    .limit(1)

  const policyConfig = (entity?.policyConfig ?? {}) as Partial<PolicyConfig>

  // Policy evaluation — this is the gate that only the Control Plane runs
  const evaluation = evaluateGovernanceRequirements(
    action.actionType as GovernanceActionType,
    input.context ?? {},
    policyConfig,
  )

  if (evaluation.blockers.length > 0) {
    return {
      ok: false,
      error: {
        code: 'POLICY_BLOCKED',
        message: 'Action blocked by policy engine',
        details: { blockers: evaluation.blockers, evaluation },
      },
    }
  }

  const approvalIds: string[] = []

  for (const req of evaluation.requirements) {
    if (req.kind === 'notice' || req.kind === 'filing') continue

    const [approval] = await platformDb
      .insert(approvals)
      .values({
        orgId: input.orgId,
        subjectType: 'governance_action',
        subjectId: input.actionId,
        approvalType: req.kind === 'board_approval' ? 'board' : 'shareholder',
        threshold: req.threshold?.toString() ?? null,
        status: 'pending',
      })
      .returning({ id: approvals.id })

    approvalIds.push(approval.id)

    await recordAuditEvent({
      orgId: input.orgId,
      actorClerkUserId: input.submittedBy,
      action: AUDIT_ACTIONS.APPROVAL_CREATE,
      targetType: 'approval',
      targetId: approval.id,
      afterJson: {
        subjectType: 'governance_action',
        subjectId: input.actionId,
        approvalType: req.kind,
        threshold: req.threshold,
      },
    })
  }

  await platformDb
    .update(governanceActions)
    .set({
      status: 'pending_approval',
      requirements: evaluation as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(and(eq(governanceActions.orgId, input.orgId), eq(governanceActions.id, input.actionId)))

  await recordAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: input.submittedBy,
    action: AUDIT_ACTIONS.GOVERNANCE_ACTION_SUBMIT,
    targetType: 'governance_action',
    targetId: input.actionId,
    beforeJson: { status: 'draft' },
    afterJson: {
      status: 'pending_approval',
      requirements: evaluation.requirements.map((r) => r.kind),
      approvalIds,
    },
  })

  logger.info('Governance action submitted', { id: input.actionId, orgId: input.orgId, approvalCount: approvalIds.length })

  return { ok: true, data: { evaluation, approvalIds } }
}

// ── 3. Decide on an approval ─────────────────────────────────────────────────

export async function decideApproval(
  input: ApproveActionInput,
): Promise<Result<{ actionStatus: string }>> {
  const [approval] = await platformDb
    .select()
    .from(approvals)
    .where(and(eq(approvals.orgId, input.orgId), eq(approvals.id, input.approvalId)))
    .limit(1)

  if (!approval) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Approval not found' } }
  }
  if (approval.status !== 'pending') {
    return {
      ok: false,
      error: { code: 'INVALID_STATE', message: `Approval already decided: "${approval.status}"` },
    }
  }

  await platformDb
    .update(approvals)
    .set({
      status: input.decision,
      decidedAt: new Date(),
      notes: input.notes ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(approvals.orgId, input.orgId), eq(approvals.id, input.approvalId)))

  await recordAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: input.decidedBy,
    action: AUDIT_ACTIONS.APPROVAL_DECIDE,
    targetType: 'approval',
    targetId: input.approvalId,
    beforeJson: { status: 'pending' },
    afterJson: { status: input.decision, notes: input.notes },
  })

  const allApprovals = await platformDb
    .select()
    .from(approvals)
    .where(and(eq(approvals.orgId, input.orgId), eq(approvals.subjectType, 'governance_action')))

  const hasRejection = allApprovals.some((a) => a.status === 'rejected')
  const allApproved = allApprovals.every((a) => a.status === 'approved')

  let newActionStatus: string

  if (hasRejection) {
    newActionStatus = 'rejected'
  } else if (allApproved) {
    newActionStatus = 'approved'
  } else {
    return { ok: true, data: { actionStatus: 'pending_approval' } }
  }

  await platformDb
    .update(governanceActions)
    .set({ status: newActionStatus as 'approved' | 'rejected', updatedAt: new Date() })
    .where(and(eq(governanceActions.orgId, input.orgId), eq(governanceActions.id, input.actionId)))

  await recordAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: input.decidedBy,
    action:
      newActionStatus === 'approved'
        ? AUDIT_ACTIONS.GOVERNANCE_ACTION_APPROVE
        : AUDIT_ACTIONS.GOVERNANCE_ACTION_REJECT,
    targetType: 'governance_action',
    targetId: input.actionId,
    beforeJson: { status: 'pending_approval' },
    afterJson: { status: newActionStatus },
  })

  logger.info('Governance action decision', { id: input.actionId, orgId: input.orgId, newStatus: newActionStatus })

  return { ok: true, data: { actionStatus: newActionStatus } }
}

// ── 4. Execute a governance action (approved → executed) ────────────────────

/**
 * THE CRITICAL GATE: Refuses to execute unless status is "approved" and
 * all approval records are "approved". Defense-in-depth on execution.
 */
export async function executeGovernanceAction(
  input: ExecuteActionInput,
): Promise<
  Result<{
    resolution: { title: string; bodyMarkdown: string } | null
    evidencePackRequest: ReturnType<typeof buildEvidencePackFromAction> | null
  }>
> {
  const [action] = await platformDb
    .select()
    .from(governanceActions)
    .where(and(eq(governanceActions.orgId, input.orgId), eq(governanceActions.id, input.actionId)))
    .limit(1)

  if (!action) {
    return { ok: false, error: { code: 'NOT_FOUND', message: 'Governance action not found' } }
  }
  if (action.status !== 'approved') {
    return {
      ok: false,
      error: {
        code: 'INVALID_STATE',
        message: `Cannot execute: action is "${action.status}", expected "approved". ` +
          'All required approvals must be granted before execution.',
      },
    }
  }

  // Double-check all approvals (defense in depth)
  const allApprovals = await platformDb
    .select()
    .from(approvals)
    .where(and(eq(approvals.orgId, input.orgId), eq(approvals.subjectType, 'governance_action')))

  const unapproved = allApprovals.filter((a) => a.status !== 'approved')
  if (unapproved.length > 0) {
    return {
      ok: false,
      error: {
        code: 'APPROVALS_INCOMPLETE',
        message: `${unapproved.length} approval(s) not yet granted`,
        details: unapproved.map((a) => ({ id: a.id, status: a.status })),
      },
    }
  }

  const payload = action.payload as Record<string, string>

  let resolution: { title: string; bodyMarkdown: string } | null = null
  try {
    resolution = getResolutionTemplate(action.actionType, payload) ?? null
  } catch {
    // Template may not exist for this action type — acceptable
  }

  let evidencePackRequest: ReturnType<typeof buildEvidencePackFromAction> | null = null
  try {
    evidencePackRequest = buildEvidencePackFromAction({
      actionId: action.id,
      actionType: action.actionType,
      orgId: action.orgId,
      executedBy: input.executedBy,
      resolutionDocument: resolution
        ? {
            filename: `resolution-${action.id.slice(0, 8)}.md`,
            buffer: Buffer.from(resolution.bodyMarkdown),
            contentType: 'text/markdown',
          }
        : undefined,
    })
  } catch {
    logger.warn('Evidence pack generation skipped', { actionId: action.id })
  }

  await platformDb
    .update(governanceActions)
    .set({ status: 'executed', updatedAt: new Date() })
    .where(and(eq(governanceActions.orgId, input.orgId), eq(governanceActions.id, input.actionId)))

  await recordAuditEvent({
    orgId: input.orgId,
    actorClerkUserId: input.executedBy,
    action: AUDIT_ACTIONS.GOVERNANCE_ACTION_EXECUTE,
    targetType: 'governance_action',
    targetId: input.actionId,
    beforeJson: { status: 'approved' },
    afterJson: {
      status: 'executed',
      hasResolution: !!resolution,
      hasEvidencePack: !!evidencePackRequest,
    },
  })

  logger.info('Governance action executed', { id: input.actionId, orgId: input.orgId })

  return { ok: true, data: { resolution, evidencePackRequest } }
}
