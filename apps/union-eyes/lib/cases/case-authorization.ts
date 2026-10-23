import { and, eq, or, sql, type SQL } from 'drizzle-orm'
import { auth } from '@nzila/platform-auth/entra/server'
import { AuthOrgBindingError } from '@nzila/platform-auth/org-binding'
import { NextResponse } from 'next/server'
import type { CUPEAction, CUPERole, ActionContext } from '@/lib/action-enforcer'
import { canPerformAction } from '@/lib/action-enforcer'
import { ApiError } from '@/lib/api/errors'
import { claims, claimUpdates } from '@/db/schema/claims-schema'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { getOrganizationIdForUser, getUserRoleInOrganization } from '@/lib/organization-utils'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger'
import { caseActionAllowed, casePolicyRole } from './case-permissions'

export interface CaseActor {
  userId: string
  organizationId: string
  role: CUPERole
}

export async function getCaseActor(): Promise<CaseActor> {
  const { userId } = await auth()
  if (!userId) throw ApiError.unauthorized()
  const organizationId = await getOrganizationIdForUser(userId)
  // Missing organization context must never reach a query scope.
  if (!organizationId) throw ApiError.forbidden()
  const resolvedRole = await getUserRoleInOrganization(userId, organizationId)
  const role = resolvedRole && casePolicyRole(resolvedRole,
    ['app_owner','system_admin','platform_lead'].includes(resolvedRole))
  if (!role) throw ApiError.forbidden()
  return { userId, organizationId, role }
}

export async function denyCaseAction(actor: CaseActor, action: CUPEAction, caseId: string, reason: string): Promise<never> {
  await auditLog({
    eventType: AuditEventType.AUTH_FAILED, severity: AuditSeverity.HIGH,
    userId: actor.userId, organizationId: actor.organizationId,
    resource: 'claims', resourceId: caseId.slice(0,255), action,
    outcome: 'failure', details: { reason },
  })
  throw ApiError.forbidden('This action is not permitted for this case.')
}

export async function requireCaseAction(actor: CaseActor, action: CUPEAction, caseId: string, context?: ActionContext): Promise<void> {
  const result=canPerformAction(action,actor.role,context)
  if (!result.allowed) await denyCaseAction(actor,action,caseId,result.reason)
}

/** Staff may read assigned cases; broader reads require the existing case_read_any gate. */
export function caseReadScope(actor: CaseActor, alias?: 'c'): SQL {
  const organizationId=alias ? sql`c.organization_id` : sql`${claims.organizationId}`
  const memberId=alias ? sql`c.member_id` : sql`${claims.memberId}`
  const assignedTo=alias ? sql`c.assigned_to` : sql`${claims.assignedTo}`
  const tenant=eq(organizationId,actor.organizationId)
  if (caseActionAllowed('case_read_any',actor.role)) return tenant
  const own=eq(memberId,actor.userId)
  return and(tenant,caseActionAllowed('note_add_internal',actor.role)
    ? or(own,eq(assignedTo,actor.userId)) : own)!
}

export async function findReadableCase(tx: RLSTx, actor: CaseActor, reference: string, lock=false) {
  if (!reference || reference.length>255) throw ApiError.badRequest('Invalid case reference')
  const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(reference)
  const referenceScope=uuid ? or(eq(claims.claimId,reference),eq(claims.claimNumber,reference)) : eq(claims.claimNumber,reference)
  const query=tx.select({id:claims.id,claimId:claims.claimId,organizationId:claims.organizationId,
    memberId:claims.memberId,assignedTo:claims.assignedTo,status:claims.status,priority:claims.priority})
    .from(claims).where(and(caseReadScope(actor),referenceScope)).limit(1)
  const [claim]=await (lock ? query.for('update') : query)
  return claim??null
}

/** Null or unknown visibility is not an affirmative grant to an ordinary member. */
export function caseHistoryVisibility(actor: CaseActor): SQL | undefined {
  if (actor.role==='admin'||actor.role==='platform_admin') return undefined
  if (caseActionAllowed('note_add_internal',actor.role))
    return or(eq(claimUpdates.visibilityScope,'member'),eq(claimUpdates.visibilityScope,'staff'))
  return and(eq(claimUpdates.isInternal,false),eq(claimUpdates.visibilityScope,'member'))
}

export async function caseAssigneeEligible(tx: RLSTx, actor: CaseActor, assigneeId: string): Promise<boolean> {
  if (currentStateContextEnabled()) {
    // The predicate checks the actual business session and the target's private
    // live membership. A request userId is never promoted to an auth identity.
    const [row]=await tx.execute(sql`SELECT public.ue_case_assignee_authorized(${assigneeId},${actor.organizationId}::uuid) AS allowed`)
    return row?.allowed===true
  }
  const rows=await tx.execute(sql`SELECT role FROM public.organization_members
    WHERE organization_id=${actor.organizationId}::uuid AND user_id=${assigneeId}
      AND status='active' AND deleted_at IS NULL LIMIT 1`)
  const role=typeof rows[0]?.role==='string' ? casePolicyRole(rows[0].role) : null
  return !!role && caseActionAllowed('note_add_internal',role)
}

export function caseAuthorizationResponse(error: unknown): NextResponse | null {
  if (error instanceof AuthOrgBindingError)
    return NextResponse.json({error:error.code==='ROLE_REQUIRED'?'FORBIDDEN':'AUTH_REQUIRED'},
      {status:error.code==='ROLE_REQUIRED'?403:401})
  if (!(error instanceof ApiError)) return null
  const statuses:Record<string,number>={AUTH_REQUIRED:401,FORBIDDEN:403,NOT_FOUND:404,VALIDATION_ERROR:400}
  const status=statuses[error.code]
  return status ? NextResponse.json({error:error.code,message:error.message},{status}) : null
}
