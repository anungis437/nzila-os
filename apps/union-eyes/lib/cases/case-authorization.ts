import { and, eq, or, sql, type SQL } from 'drizzle-orm'
import { auth } from '@nzila/platform-auth/entra/server'
import { AuthOrgBindingError } from '@nzila/platform-auth/org-binding'
import { NextResponse } from 'next/server'
import type { CUPERole } from '@/lib/action-enforcer'
import { ApiError } from '@/lib/api/errors'
import { claims, claimUpdates } from '@/db/schema/claims-schema'
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context'
import { getOrganizationIdForUser, getUserRoleInOrganization } from '@/lib/organization-utils'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger'
import { caseActionAllowed, casePolicyRole } from './case-permissions'
import { liveDesignationExists } from '@/lib/triage/designations'
import { decideCase, drizzleExecutor, kernelCaseRelationshipScope } from '@/lib/authority/store/route-adapter'
import { activeMembershipSource } from '@/lib/authority/store/active-membership-source'
import type { Action, Capacity } from '@/lib/authority/ontology'

/**
 * Case access for the claims model, decided by the authority kernel (UE-CONV-E-001).
 *
 * `role` on the actor is kept only for workflow rules that NARROW what a state machine offers; it is never authority.
 * Every read and every consequential action on one case is a kernel decision against live relationships, mandates,
 * delegations, recusals, expiry and the case's classification. Seniority, role title and platform status are not inputs.
 */
export interface CaseActor {
  userId: string
  organizationId: string
  role: CUPERole
}

export type CaseKernelAction = Extract<
  Action,
  | 'case:read' | 'case:read_internal' | 'case:comment' | 'case:write_notes' | 'case:draft_action' | 'case:upload_evidence'
  | 'case:modify_document' | 'case:transition' | 'case:close' | 'case:assign' | 'case:export_sealed_evidence'
>

export async function getCaseActor(): Promise<CaseActor> {
  const { userId } = await auth()
  if (!userId) throw ApiError.unauthorized()
  const organizationId = await getOrganizationIdForUser(userId)
  // Missing organization context must never reach a query scope.
  if (!organizationId) throw ApiError.forbidden()
  const resolvedRole = await getUserRoleInOrganization(userId, organizationId)
  // Platform administration never confers customer-organization case authority: platform roles resolve to no case role.
  const role = resolvedRole && casePolicyRole(resolvedRole)
  if (!role) throw ApiError.forbidden()
  return { userId, organizationId, role }
}

/** Best-effort security evidence for a refusal; the refusal itself never depends on it. */
export async function denyCaseAction(actor: CaseActor, action: string, caseId: string, reason: string): Promise<never> {
  await auditLog({
    eventType: AuditEventType.AUTH_FAILED, severity: AuditSeverity.HIGH,
    userId: actor.userId, organizationId: actor.organizationId,
    resource: 'claims', resourceId: caseId.slice(0, 255), action,
    outcome: 'failure', details: { reason },
  })
  throw ApiError.forbidden('This action is not permitted for this case.')
}

/** The case visibility a kernel allow carries: `internal` for case handlers, `member_visible` for the member. */
export type CaseVisibility = 'internal' | 'member_visible'

const ownClaim = (alias?: 'c'): SQL => (alias ? sql`c.member_id` : sql`${claims.memberId}`)

/**
 * Pre-filter for case lists: cases the user filed, or holds a LIVE, non-recused kernel relationship to. It only narrows
 * what a list may enumerate and can never widen access: reading or changing one case still needs a full kernel decision.
 * Seniority never confers a tenant-wide read, and a triage designation is not a read (see caseTriageQueueScope).
 */
export function caseReadScope(actor: CaseActor, alias?: 'c'): SQL {
  const organizationId = alias ? sql`c.organization_id` : sql`${claims.organizationId}`
  const caseId = alias ? sql`c.claim_id` : sql`${claims.claimId}`
  return and(
    sql`${organizationId} = ${actor.organizationId}::uuid`,
    or(
      sql`${ownClaim(alias)} = ${actor.userId}`,
      kernelCaseRelationshipScope(actor.userId, caseId, organizationId),
    ),
  )!
}

/**
 * The triage queue: claims nobody holds a live owner or assignee relationship to. A live `cases` designation lets its
 * holder DISCOVER and route these; it is a subordinate policy that exposes queue metadata only (see
 * CASE_TRIAGE_COLUMNS), never the description, analysis, evidence, notes or amounts, and it grants no kernel action.
 */
export function caseTriageQueueScope(actor: CaseActor, alias?: 'c'): SQL {
  const organizationId = alias ? sql`c.organization_id` : sql`${claims.organizationId}`
  const caseId = alias ? sql`c.claim_id` : sql`${claims.claimId}`
  return and(
    sql`${organizationId} = ${actor.organizationId}::uuid`,
    liveDesignationExists(actor, 'cases'),
    sql`NOT EXISTS (
      SELECT 1 FROM ue_authority_resource_relationships r
       WHERE r.resource_type = 'case' AND r.resource_id = ${caseId} AND r.organization_id = ${organizationId}
         AND r.relation IN ('owner', 'assignee') AND r.status = 'active' AND r.revoked_at IS NULL
         AND r.effective_at <= now() AND (r.expires_at IS NULL OR r.expires_at > now()))`,
  )!
}

/** The only columns a designation exposes. */
export const CASE_TRIAGE_COLUMNS = ['claimId', 'claimNumber', 'claimType', 'status', 'priority', 'createdAt', 'filedDate'] as const

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

export interface ReadableCase {
  id: string
  claimId: string
  organizationId: string
  memberId: string | null
  /** Legacy mirror of the primary assignee. Never an authority source. */
  assignedTo: string | null
  status: string
  priority: string
  visibility: CaseVisibility
  /** The sources of authority the kernel relied on for this decision (mandate, relationship, ...), for the audit record. */
  authority: ReadonlyArray<{ kind: string; id: string; instrument: string }>
}

/**
 * Resolves one case in the caller's organization and decides `action` on it through the kernel.
 *
 * Returns null when the caller may not even read the case (indistinguishable from a missing one). When the caller may
 * read it but not perform `action`, throws a 403 and records the refusal. The decision runs on the same transaction as
 * the work that follows, so a `lock` holds the row between the decision and the write.
 */
export async function findReadableCase(
  tx: RLSTx,
  actor: CaseActor,
  reference: string,
  lock = false,
  action: CaseKernelAction = 'case:read',
): Promise<ReadableCase | null> {
  if (!reference || reference.length > 255) throw ApiError.badRequest('Invalid case reference')
  const referenceScope = UUID.test(reference) ? or(eq(claims.claimId, reference), eq(claims.claimNumber, reference)) : eq(claims.claimNumber, reference)
  const query = tx
    .select({ id: claims.id, claimId: claims.claimId, organizationId: claims.organizationId, memberId: claims.memberId, assignedTo: claims.assignedTo, status: claims.status, priority: claims.priority })
    .from(claims)
    .where(and(eq(claims.organizationId, actor.organizationId), referenceScope))
    .limit(1)
  const [claim] = await (lock ? query.for('update') : query)
  if (!claim) return null

  const decision = await decideCase(tx, { userId: actor.userId, organizationId: actor.organizationId, caseId: claim.claimId, action })
  if (decision.effect === 'allow') {
    return {
      ...claim,
      visibility: decision.scope.visibility === 'member_visible' ? 'member_visible' : 'internal',
      authority: (decision.authority ?? []).map((a) => ({ kind: a.kind, id: a.id, instrument: a.instrument })),
    }
  }
  if (action !== 'case:read') {
    const read = await decideCase(tx, { userId: actor.userId, organizationId: actor.organizationId, caseId: claim.claimId, action: 'case:read' })
    if (read.effect === 'allow') await denyCaseAction(actor, action, claim.claimId, decision.reasons[0]?.code ?? 'DENIED')
  }
  return null
}

/** Assessments and cost reserves that only the handlers of a case see; the member sees the case they filed. */
export const INTERNAL_CASE_FIELDS = ['aiScore', 'aiAnalysis', 'meritConfidence', 'precedentMatch', 'complexityScore', 'legalCosts', 'courtCosts'] as const

export function redactCaseRow<T extends Record<string, unknown>>(row: T, visibility: CaseVisibility): Partial<T> {
  if (visibility === 'internal') return row
  return Object.fromEntries(Object.entries(row).filter(([key]) => !(INTERNAL_CASE_FIELDS as readonly string[]).includes(key))) as Partial<T>
}

/**
 * Who may open a case. Opening is not access to anyone else's case (the creator relationship is derived and nothing
 * else follows from it), so it asks only for an ACTIVE canonical membership with the right functional capacity:
 * `member` (a member filing their own matter), `handler` (staff opening a matter), `bulk` (an office-bearer importing
 * many on behalf of members). A role is eligibility here, never access to an existing case.
 */
const FILING_CAPACITIES: Record<'member' | 'handler' | 'bulk', readonly Capacity[]> = {
  member: ['member', 'steward', 'chief_steward', 'officer', 'executive'],
  handler: ['steward', 'chief_steward', 'officer', 'executive'],
  bulk: ['officer', 'executive'],
}

export async function requireCaseFilingCapacity(tx: RLSTx, who: { userId: string; organizationId: string }, mode: keyof typeof FILING_CAPACITIES): Promise<void> {
  const rows = await activeMembershipSource(drizzleExecutor(tx), who.organizationId, [who.userId])
  const membership = rows.find((m) => m.userId === who.userId && m.organizationId === who.organizationId && m.status === 'active')
  if (!membership || !membership.capacities.some((c) => FILING_CAPACITIES[mode].includes(c))) throw ApiError.forbidden()
}

/** The same capacity test as a boolean, for routes that answer a refusal in their own envelope. */
export async function hasCaseFilingCapacity(who: { userId: string; organizationId: string }, mode: keyof typeof FILING_CAPACITIES): Promise<boolean> {
  try {
    await withRLSContext({ organizationId: who.organizationId }, (tx) => requireCaseFilingCapacity(tx, who, mode))
    return true
  } catch (error) {
    if (error instanceof ApiError) return false
    throw error
  }
}

/** A kernel decision for one action on one case (a grievance or a claim), as a throw: 403 unless the kernel allows. */
export async function requireKernelCaseAction(tx: RLSTx, who: { userId: string; organizationId: string }, caseId: string, action: CaseKernelAction): Promise<void> {
  const decision = await decideCase(tx, { userId: who.userId, organizationId: who.organizationId, caseId, action })
  if (decision.effect !== 'allow') throw ApiError.forbidden('This action is not permitted for this case.')
}

/** Null or unknown visibility is not an affirmative grant: only the decision's own visibility widens what history is shown. */
export function caseHistoryVisibility(visibility: CaseVisibility): SQL {
  if (visibility === 'internal') return or(eq(claimUpdates.visibilityScope, 'member'), eq(claimUpdates.visibilityScope, 'staff'))!
  return and(eq(claimUpdates.isInternal, false), eq(claimUpdates.visibilityScope, 'member'))!
}

export async function caseAssigneeEligible(tx: RLSTx, actor: CaseActor, assigneeId: string): Promise<boolean> {
  if (currentStateContextEnabled()) {
    // The predicate checks the actual business session and the target's private
    // live membership. A request userId is never promoted to an auth identity.
    const [row] = await tx.execute(sql`SELECT public.ue_case_assignee_authorized(${assigneeId},${actor.organizationId}::uuid) AS allowed`)
    return row?.allowed === true
  }
  const rows = await tx.execute(sql`SELECT role FROM public.organization_members
    WHERE organization_id=${actor.organizationId}::uuid AND user_id=${assigneeId}
      AND status='active' AND deleted_at IS NULL LIMIT 1`)
  const role = typeof rows[0]?.role === 'string' ? casePolicyRole(rows[0].role) : null
  return !!role && caseActionAllowed('note_add_internal', role)
}

export function caseAuthorizationResponse(error: unknown): NextResponse | null {
  if (error instanceof AuthOrgBindingError)
    return NextResponse.json({ error: error.code === 'ROLE_REQUIRED' ? 'FORBIDDEN' : 'AUTH_REQUIRED' },
      { status: error.code === 'ROLE_REQUIRED' ? 403 : 401 })
  if (!(error instanceof ApiError)) return null
  const statuses: Record<string, number> = { AUTH_REQUIRED: 401, FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION_ERROR: 400 }
  const status = statuses[error.code]
  return status ? NextResponse.json({ error: error.code, message: error.message }, { status }) : null
}
