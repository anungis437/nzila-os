/**
 * Nzila OS — Governance Action State Machine
 *
 * This is the server-side gate that enforces:
 *   1. Policy engine evaluation before submission
 *   2. Required approvals before execution
 *   3. Audit events at every state transition
 *   4. Evidence pack generation on execution
 *   5. Entity scope enforced end-to-end
 *
 * State flow:
 *   draft → pending_approval → approved → executed
 *                            ↘ rejected
 *
 * A governance action CANNOT transition to "executed" unless all
 * required approvals are in "approved" status. This is the #1
 * acceptance test for the backbone.
 */
// Platform DB for governance state machine — complex multi-table operations
// with explicit audit via recordAuditEvent()
import { platformDb } from '@nzila/db/platform'
import {
  governanceActions,
  approvals,
  entities,
} from '@nzila/db/schema'
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

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateActionInput {
  entityId: string
  actionType: GovernanceActionType
  payload: Record<string, unknown>
  createdBy: string // clerk_user_id
}

export interface SubmitActionInput {
  actionId: string
  entityId: string
  submittedBy: string
  /** Context for policy evaluation (shares outstanding, amount, etc.) */
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
  entityId: string
  approvalId: string
  decidedBy: string
  decision: 'approved' | 'rejected'
  notes?: string
}

export interface ExecuteActionInput {
  actionId: string
  entityId: string
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
      entityId: input.entityId,
      actionType: input.actionType,
      payload: input.payload,
      status: 'draft',
      createdBy: input.createdBy,
    })
    .returning({ id: governanceActions.id })

  await recordAuditEvent({
    entityId: input.entityId,
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

  return { ok: true, data: { id: action.id } }
}

// ── 2. Submit for approval (draft → pending_approval) ───────────────────────

/**
 * Evaluates the policy engine and creates approval records.
 * Transitions action from `draft` → `pending_approval`.
 *
 * This is a GATE: if the policy engine returns blockers, the action
 * stays in draft and the blockers are returned.
 */
export async function submitGovernanceAction(
  input: SubmitActionInput,
): Promise<Result<{ evaluation: PolicyEvaluation; approvalIds: string[] }>> {
  // 1. Load the action
  const [action] = await platformDb
    .select()
    .from(governanceActions)
    .where(and(eq(governanceActions.entityId, input.entityId), eq(governanceActions.id, input.actionId)))
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

  // 2. Load entity policy config
  const [entity] = await platformDb
    .select({ policyConfig: entities.policyConfig })
    .from(entities)
    .where(eq(entities.id, input.entityId))
    .limit(1)

  const policyConfig = (entity?.policyConfig ?? {}) as Partial<PolicyConfig>

  // 3. Evaluate policy engine
  const evaluation = evaluateGovernanceRequirements(
    action.actionType as GovernanceActionType,
    input.context ?? {},
    policyConfig,
  )

  // 4. Check blockers
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

  // 5. Create approval records for each requirement
  const approvalIds: string[] = []

  for (const req of evaluation.requirements) {
    if (req.kind === 'notice' || req.kind === 'filing') continue // tracked separately

    const [approval] = await platformDb
      .insert(approvals)
      .values({
        entityId: input.entityId,
        subjectType: 'governance_action',
        subjectId: input.actionId,
        approvalType: req.kind === 'board_approval' ? 'board' : 'shareholder',
        threshold: req.threshold?.toString() ?? null,
        status: 'pending',
      })
      .returning({ id: approvals.id })

    approvalIds.push(approval.id)

    await recordAuditEvent({
      entityId: input.entityId,
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

  // 6. Update action status + store evaluation
  await platformDb
    .update(governanceActions)
    .set({
      status: 'pending_approval',
      requirements: evaluation as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(and(eq(governanceActions.entityId, input.entityId), eq(governanceActions.id, input.actionId)))

  await recordAuditEvent({
    entityId: input.entityId,
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

  return { ok: true, data: { evaluation, approvalIds } }
}

// ── 3. Decide on an approval ────────────────────────────────────────────────

/**
 * Record an approval/rejection decision.
 * If all approvals are now approved, auto-transitions action to "approved".
 * If any approval is rejected, action transitions to "rejected".
 */
export async function decideApproval(
  input: ApproveActionInput,
): Promise<Result<{ actionStatus: string }>> {
  // 1. Update the approval
  const [approval] = await platformDb
    .select()
    .from(approvals)
    .where(and(eq(approvals.entityId, input.entityId), eq(approvals.id, input.approvalId)))
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
    .where(and(eq(approvals.entityId, input.entityId), eq(approvals.id, input.approvalId)))

  await recordAuditEvent({
    entityId: input.entityId,
    actorClerkUserId: input.decidedBy,
    action: AUDIT_ACTIONS.APPROVAL_DECIDE,
    targetType: 'approval',
    targetId: input.approvalId,
    beforeJson: { status: 'pending' },
    afterJson: { status: input.decision, notes: input.notes },
  })

  // 2. Check all approvals for this action
  const allApprovals = await platformDb
    .select()
    .from(approvals)
    .where(and(eq(approvals.entityId, input.entityId), eq(approvals.subjectType, 'governance_action')))

  const hasRejection = allApprovals.some((a) => a.status === 'rejected')
  const allApproved = allApprovals.every((a) => a.status === 'approved')

  let newActionStatus: string

  if (hasRejection) {
    newActionStatus = 'rejected'
  } else if (allApproved) {
    newActionStatus = 'approved'
  } else {
    // Some still pending
    return { ok: true, data: { actionStatus: 'pending_approval' } }
  }

  // 3. Transition the governance action
  await platformDb
    .update(governanceActions)
    .set({ status: newActionStatus as 'approved' | 'rejected', updatedAt: new Date() })
    .where(and(eq(governanceActions.entityId, input.entityId), eq(governanceActions.id, input.actionId)))

  await recordAuditEvent({
    entityId: input.entityId,
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

  return { ok: true, data: { actionStatus: newActionStatus } }
}

// ── 4. Execute a governance action (approved → executed) ────────────────────

/**
 * THE CRITICAL GATE: Execute a governance action.
 *
 * This function REFUSES to execute unless:
 *   - Action status is "approved"
 *   - All approvals are in "approved" state
 *
 * On execution:
 *   - Generates a resolution artifact (markdown)
 *   - Builds an evidence pack request
 *   - Records audit events
 *   - Transitions to "executed"
 *
 * Note: The actual Blob upload + evidence pack persistence is handled
 * by the evidence-index CLI job or a follow-up pipeline step.
 * This function returns the evidence pack request for the caller.
 */
export async function executeGovernanceAction(
  input: ExecuteActionInput,
): Promise<
  Result<{
    resolution: { title: string; bodyMarkdown: string } | null
    evidencePackRequest: ReturnType<typeof buildEvidencePackFromAction> | null
  }>
> {
  // 1. Load and validate action state
  const [action] = await platformDb
    .select()
    .from(governanceActions)
    .where(and(eq(governanceActions.entityId, input.entityId), eq(governanceActions.id, input.actionId)))
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

  // 2. Double-check all approvals (defense in depth)
  const allApprovals = await platformDb
    .select()
    .from(approvals)
    .where(and(eq(approvals.entityId, input.entityId), eq(approvals.subjectType, 'governance_action')))

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

  // 3. Generate resolution artifact (markdown)
  let resolution: { title: string; bodyMarkdown: string } | null = null
  const payload = action.payload as Record<string, string>
  try {
    resolution = getResolutionTemplate(action.actionType, payload) ?? null
  } catch {
    // Template may not exist for this action type — that's OK
  }

  // 4. Build evidence pack request
  let evidencePackRequest: ReturnType<typeof buildEvidencePackFromAction> | null = null
  try {
    evidencePackRequest = buildEvidencePackFromAction({
      actionId: action.id,
      actionType: action.actionType,
      entityId: action.entityId,
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
    // Evidence pack build is best-effort; log and continue
    console.warn('[GOVERNANCE] Evidence pack build failed for action', action.id)
  }

  // 5. Transition to executed
  const now = new Date()
  await platformDb
    .update(governanceActions)
    .set({
      status: 'executed',
      executedAt: now,
      updatedAt: now,
    })
    .where(and(eq(governanceActions.entityId, input.entityId), eq(governanceActions.id, input.actionId)))

  // 6. Audit event
  await recordAuditEvent({
    entityId: input.entityId,
    actorClerkUserId: input.executedBy,
    action: AUDIT_ACTIONS.GOVERNANCE_ACTION_EXECUTE,
    targetType: 'governance_action',
    targetId: input.actionId,
    beforeJson: { status: 'approved' },
    afterJson: {
      status: 'executed',
      executedAt: now.toISOString(),
      hasResolution: !!resolution,
      hasEvidencePack: !!evidencePackRequest,
    },
  })

  return {
    ok: true,
    data: { resolution, evidencePackRequest },
  }
}

// ── Utility: get action with its approvals ──────────────────────────────────

export async function getGovernanceActionWithApprovals(
  actionId: string,
  entityId: string,
) {
  const [action] = await platformDb
    .select()
    .from(governanceActions)
    .where(and(eq(governanceActions.entityId, entityId), eq(governanceActions.id, actionId)))
    .limit(1)

  if (!action) return null

  const actionApprovals = await platformDb
    .select()
    .from(approvals)
    .where(and(eq(approvals.entityId, entityId), eq(approvals.subjectType, 'governance_action')))

  return { ...action, approvals: actionApprovals }
}
