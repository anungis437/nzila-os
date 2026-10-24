/**
 * Case access for representatives, on the authority kernel.
 *
 * There is ONE authority for who may read or change a case: the kernel's explicit, governed relationships and
 * mandates (assignee, owner, collaborator), judged with the holder's capacity, institutional issuance rules, recusal,
 * expiry and revocation. This module only translates kernel decisions into the access shape routes already consume,
 * and routes collaborator grants through the kernel's governed assignment. It never derives access from
 * `grievances.union_rep_id`, from role seniority, or from the retired `grievance_case_access_assignments` table.
 *
 * Fail closed: a missing case, an unloadable fact, absent kernel storage or any contradiction yields no access.
 */
import { and, eq } from 'drizzle-orm'
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context'
import { grievances } from '@/db/schema/domains/claims/grievances'
import type { CaseAccessRole } from '@/db/schema/domains/claims/grievance-lifecycle'
import { AuthorityStoreError } from '@/lib/authority/store/executor'
import { assignCase, revokeCaseAssignment } from '@/lib/authority/store/lifecycle'
import { decideCase, drizzleExecutor, kernelDeps } from '@/lib/authority/store/route-adapter'
import type { Action } from '@/lib/authority/ontology'

export interface CaseAccessScopeInput {
  canComment?: boolean
  canUploadDocuments?: boolean
  canEditCaseNotes?: boolean
  canDraftActions?: boolean
  canViewPrivateDocuments?: boolean
}

export interface GrantCaseAccessInput extends CaseAccessScopeInput {
  organizationId: string
  grievanceId: string
  userId: string
  grantedBy: string
  accessRole: CaseAccessRole
  expiresAt?: Date | null
}

export interface EffectiveCaseAccess {
  canViewCase: boolean
  canManageAssignments: boolean
  isPrimaryOwner: boolean
  isSecondaryCollaborator: boolean
  accessRole: CaseAccessRole | 'primary_owner' | null
  canComment: boolean
  canUploadDocuments: boolean
  canEditCaseNotes: boolean
  canDraftActions: boolean
  canViewPrivateDocuments: boolean
  ownerOnly: {
    canReassignPrimary: boolean
    canCloseCase: boolean
    canRemovePrimaryAccess: boolean
    canExportSealedEvidence: boolean
  }
}

export const MAX_CASE_ACCESS_GRANT_DAYS = 365

export type CaseAccessMutationFailure = {
  ok: false
  status: 400 | 403 | 404
  code:
    | 'CASE_NOT_FOUND'
    | 'CASE_MANAGEMENT_AUTHORITY_REQUIRED'
    | 'GRANTEE_INELIGIBLE'
    | 'SELF_GRANT_FORBIDDEN'
    | 'PRIMARY_OWNER_GRANT_FORBIDDEN'
    | 'INVALID_EXPIRY'
    | 'EXPIRY_REQUIRED'
    | 'SCOPE_EXCEEDS_ROLE'
    | 'ASSIGNMENT_NOT_FOUND'
  message: string
}

export interface CaseCollaborator {
  id: string
  userId: string
  relation: 'owner' | 'assignee' | 'collaborator'
  accessRole: CaseAccessRole | 'primary_owner'
  permissions: string[]
  canComment: boolean
  canUploadDocuments: boolean
  canEditCaseNotes: boolean
  canDraftActions: boolean
  canViewPrivateDocuments: boolean
  status: 'active' | 'revoked'
  grantedBy: string | null
  grantedAt: Date
  expiresAt: Date | null
}

const NO_ACCESS: EffectiveCaseAccess = {
  canViewCase: false,
  canManageAssignments: false,
  isPrimaryOwner: false,
  isSecondaryCollaborator: false,
  accessRole: null,
  canComment: false,
  canUploadDocuments: false,
  canEditCaseNotes: false,
  canDraftActions: false,
  canViewPrivateDocuments: false,
  ownerOnly: { canReassignPrimary: false, canCloseCase: false, canRemovePrimaryAccess: false, canExportSealedEvidence: false },
}

type Row = Record<string, unknown>

/** Live relationships to one case, straight from authoritative kernel storage. */
async function liveRelationships(tx: RLSTx, organizationId: string, caseId: string, userId?: string): Promise<Row[]> {
  const exec = drizzleExecutor(tx)
  return (
    await exec.query<Row>(
      `SELECT id::text AS id, principal_user_id, relation, permissions, granted_by, effective_at, expires_at
         FROM ue_authority_resource_relationships
        WHERE organization_id = $1::uuid AND resource_type = 'case' AND resource_id = $2::uuid
          AND relation IN ('owner', 'assignee', 'collaborator')
          AND status = 'active' AND revoked_at IS NULL
          AND effective_at <= now() AND (expires_at IS NULL OR expires_at > now())
          AND ($3::text IS NULL OR principal_user_id = $3::text)
        ORDER BY effective_at, id`,
      [organizationId, caseId, userId ?? null],
    )
  ).rows
}

const permissionList = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String) : typeof value === 'string' ? value.replace(/^\{|\}$/g, '').split(',').filter(Boolean) : []

function roleFor(permissions: readonly string[]): CaseAccessRole {
  if (permissions.includes('write')) return 'secondary_lro'
  return permissions.includes('comment') ? 'reviewer' : 'read_only'
}

/** The kernel's verdicts for one principal on one case, mapped to the access shape routes consume. */
export async function kernelCaseAccess(
  tx: RLSTx,
  params: { organizationId: string; grievanceId: string; userId: string },
): Promise<EffectiveCaseAccess> {
  const allowed = async (action: Action) =>
    (await decideCase(tx, { userId: params.userId, organizationId: params.organizationId, caseId: params.grievanceId, action })).effect === 'allow'

  if (!(await allowed('case:read_internal'))) return NO_ACCESS
  const canComment = await allowed('case:comment')
  const canWrite = await allowed('case:write')
  const canRestricted = await allowed('case:read_third_party_restricted')
  const canAssign = await allowed('case:assign')
  const mine = await liveRelationships(tx, params.organizationId, params.grievanceId, params.userId)
  const isPrimaryOwner = mine.some((r) => r.relation === 'owner' || r.relation === 'assignee')
  const collaborator = mine.find((r) => r.relation === 'collaborator')
  const common = {
    canViewCase: true,
    canManageAssignments: canAssign,
    canComment,
    canUploadDocuments: canWrite,
    canEditCaseNotes: canWrite,
    canDraftActions: canWrite,
    canViewPrivateDocuments: canRestricted,
  }
  if (isPrimaryOwner) {
    return {
      ...common,
      isPrimaryOwner: true,
      isSecondaryCollaborator: false,
      accessRole: 'primary_owner',
      ownerOnly: { canReassignPrimary: canAssign, canCloseCase: true, canRemovePrimaryAccess: canAssign, canExportSealedEvidence: true },
    }
  }
  return {
    ...common,
    isPrimaryOwner: false,
    isSecondaryCollaborator: Boolean(collaborator),
    accessRole: collaborator ? roleFor(permissionList(collaborator.permissions)) : null,
    ownerOnly: { canReassignPrimary: false, canCloseCase: false, canRemovePrimaryAccess: false, canExportSealedEvidence: false },
  }
}

export async function getEffectiveCaseAccess(params: {
  organizationId: string
  grievanceId: string
  userId: string
}): Promise<EffectiveCaseAccess> {
  try {
    return await withRLSContext({ organizationId: params.organizationId }, (tx) => kernelCaseAccess(tx, params))
  } catch {
    return NO_ACCESS
  }
}

function toCollaborator(r: Row): CaseCollaborator {
  const permissions = permissionList(r.permissions)
  const primary = r.relation === 'owner' || r.relation === 'assignee'
  return {
    id: String(r.id),
    userId: String(r.principal_user_id),
    relation: r.relation as CaseCollaborator['relation'],
    accessRole: primary ? 'primary_owner' : roleFor(permissions),
    permissions,
    canComment: primary || permissions.includes('comment'),
    canUploadDocuments: primary || permissions.includes('write'),
    canEditCaseNotes: primary || permissions.includes('write'),
    canDraftActions: primary || permissions.includes('write'),
    canViewPrivateDocuments: primary || permissions.includes('read_third_party_restricted'),
    status: 'active',
    grantedBy: (r.granted_by as string | null) ?? null,
    grantedAt: new Date(String(r.effective_at)),
    expiresAt: r.expires_at ? new Date(String(r.expires_at)) : null,
  }
}

/** The people holding live case relationships, for the roster the case's own handlers may see. */
export async function listCaseCollaborators(tx: RLSTx, organizationId: string, grievanceId: string): Promise<CaseCollaborator[]> {
  return (await liveRelationships(tx, organizationId, grievanceId)).map(toCollaborator)
}

/** Principals holding a live owner, assignee or collaborator relationship to the case. */
export async function assignedCaseRepresentativeIds(organizationId: string, caseId: string): Promise<string[]> {
  return withRLSContext({ organizationId }, async (tx) => [...new Set((await listCaseCollaborators(tx, organizationId, caseId)).map((c) => c.userId))])
}

/** Validates grant terms independent of who is asking. Pure so the policy can be exercised without a database. */
export function validateCaseAccessGrantTerms(
  input: Pick<GrantCaseAccessInput, 'accessRole' | 'expiresAt' | 'canViewPrivateDocuments' | 'canUploadDocuments' | 'canEditCaseNotes' | 'canDraftActions'>,
  now: Date = new Date(),
): CaseAccessMutationFailure | null {
  if (input.accessRole !== 'secondary_lro' && (input.canEditCaseNotes || input.canDraftActions || input.canUploadDocuments)) {
    return { ok: false, status: 400, code: 'SCOPE_EXCEEDS_ROLE', message: 'Only a secondary LRO grant may carry editing, drafting or upload rights.' }
  }
  const requiresExpiry = input.accessRole !== 'secondary_lro' || input.canViewPrivateDocuments === true
  if (!input.expiresAt) {
    return requiresExpiry
      ? { ok: false, status: 400, code: 'EXPIRY_REQUIRED', message: 'Reviewer, read-only and private-document grants must expire.' }
      : null
  }
  const ms = input.expiresAt.getTime()
  if (Number.isNaN(ms) || ms <= now.getTime() || ms > now.getTime() + MAX_CASE_ACCESS_GRANT_DAYS * 86_400_000) {
    return { ok: false, status: 400, code: 'INVALID_EXPIRY', message: `Expiry must be in the future and within ${MAX_CASE_ACCESS_GRANT_DAYS} days.` }
  }
  return null
}

/** The kernel permissions a collaborator grant carries; the kernel intersects them with its own ceiling. */
export function collaboratorPermissions(
  input: Pick<GrantCaseAccessInput, 'accessRole' | 'canComment' | 'canUploadDocuments' | 'canEditCaseNotes' | 'canDraftActions' | 'canViewPrivateDocuments'>,
): string[] {
  const permissions = ['read', 'read_internal']
  if (input.accessRole !== 'read_only' && input.canComment !== false) permissions.push('comment')
  if (input.accessRole === 'secondary_lro' && (input.canEditCaseNotes || input.canDraftActions || input.canUploadDocuments)) permissions.push('write')
  if (input.canViewPrivateDocuments) permissions.push('read_third_party_restricted')
  return permissions
}

const failure = (status: 400 | 403 | 404, code: CaseAccessMutationFailure['code'], message: string): CaseAccessMutationFailure => ({ ok: false, status, code, message })

function mapStoreError(error: unknown): CaseAccessMutationFailure | null {
  if (!(error instanceof AuthorityStoreError)) return null
  if (/CAPACITY_NOT_ELIGIBLE|ELIGIB/i.test(error.message)) {
    return failure(400, 'GRANTEE_INELIGIBLE', 'Grantee is not an active representative in this organization.')
  }
  if (/SELF_APPROVAL|SEGREGATION|self/i.test(error.message)) return failure(403, 'SELF_GRANT_FORBIDDEN', 'A case access grant cannot target the grantor.')
  if (error.code === 'DENIED' || error.code === 'PRECONDITION') {
    return failure(403, 'CASE_MANAGEMENT_AUTHORITY_REQUIRED', 'The kernel did not authorize this change: case:assign authority under an adopted issuance rule is required.')
  }
  if (error.code === 'NOT_FOUND') return failure(404, 'ASSIGNMENT_NOT_FOUND', 'Access assignment not found.')
  return null
}

/**
 * Collaborator grants are a governed case assignment: the issuer needs the kernel's `case:assign` authority under an
 * active issuance rule, the grantee must be an eligible, conflict-free representative, and the kernel audits the grant
 * in the same transaction. Seniority and primary-owner status alone confer nothing.
 */
export async function grantCaseAccessGuarded(
  input: GrantCaseAccessInput,
): Promise<{ ok: true; access: CaseCollaborator } | CaseAccessMutationFailure> {
  if (input.userId === input.grantedBy) return failure(403, 'SELF_GRANT_FORBIDDEN', 'A case access grant cannot target the grantor.')
  const terms = validateCaseAccessGrantTerms(input)
  if (terms) return terms
  try {
    return await withRLSContext({ organizationId: input.organizationId }, async (tx) => {
      const [found] = await tx
        .select({ id: grievances.id })
        .from(grievances)
        .where(and(eq(grievances.organizationId, input.organizationId), eq(grievances.id, input.grievanceId)))
        .limit(1)
      if (!found) return failure(404, 'CASE_NOT_FOUND', 'Grievance not found.')
      const existing = await liveRelationships(tx, input.organizationId, input.grievanceId, input.userId)
      if (existing.some((r) => r.relation === 'owner' || r.relation === 'assignee')) {
        return failure(400, 'PRIMARY_OWNER_GRANT_FORBIDDEN', 'The primary owner already holds full access.')
      }
      const id = await assignCase(drizzleExecutor(tx), kernelDeps, {
        organizationId: input.organizationId,
        issuerUserId: input.grantedBy,
        caseId: input.grievanceId,
        assigneeUserId: input.userId,
        relation: 'collaborator',
        permissions: collaboratorPermissions(input),
        effectiveAt: new Date(Date.now() - 1000),
        expiresAt: input.expiresAt ?? null,
        auditDetails: { accessRole: input.accessRole },
      })
      const granted = (await listCaseCollaborators(tx, input.organizationId, input.grievanceId)).find((c) => c.id === id)
      if (!granted) throw new AuthorityStoreError('PRECONDITION', 'the grant was recorded but is not live')
      return { ok: true as const, access: granted }
    })
  } catch (error) {
    const mapped = mapStoreError(error)
    if (mapped) return mapped
    throw error
  }
}

export async function revokeCaseAccessGuarded(params: {
  organizationId: string
  grievanceId: string
  assignmentId: string
  actorId: string
}): Promise<{ ok: true; before: CaseCollaborator; updated: CaseCollaborator } | CaseAccessMutationFailure> {
  try {
    return await withRLSContext({ organizationId: params.organizationId }, async (tx) => {
      const before = (await listCaseCollaborators(tx, params.organizationId, params.grievanceId)).find(
        (c) => c.id === params.assignmentId && c.relation === 'collaborator',
      )
      if (!before) return failure(404, 'ASSIGNMENT_NOT_FOUND', 'Access assignment not found.')
      await revokeCaseAssignment(drizzleExecutor(tx), kernelDeps, {
        organizationId: params.organizationId,
        issuerUserId: params.actorId,
        caseId: params.grievanceId,
        relationshipId: params.assignmentId,
      })
      return { ok: true as const, before, updated: { ...before, status: 'revoked' as const } }
    })
  } catch (error) {
    const mapped = mapStoreError(error)
    if (mapped) return mapped
    throw error
  }
}
