/**
 * Case access for representatives, on the authority kernel.
 *
 * There is ONE authority for who may read or change a case: the kernel's explicit, governed relationships and
 * mandates (assignee, owner, collaborator), judged with the holder's capacity, institutional issuance rules, recusal,
 * expiry and revocation. This module only translates kernel decisions into the access shape routes already consume,
 * and routes collaborator grants through the kernel's governed assignment. It never derives access from
 * the legacy primary-representative column, from role seniority, or from the retired pre-kernel collaborator table.
 *
 * Fail closed: a missing case, an unloadable fact, absent kernel storage or any contradiction yields no access.
 */
import { and, eq } from 'drizzle-orm'
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context'
import { grievances } from '@/db/schema/domains/claims/grievances'
import type { CaseAccessRole } from '@/db/schema/domains/claims/grievance-lifecycle'
import { AuthorityStoreError } from '@/lib/authority/store/executor'
import { assignCase, reassignCase, revokeCaseAssignment } from '@/lib/authority/store/lifecycle'
import { decideCase, drizzleExecutor, kernelDeps } from '@/lib/authority/store/route-adapter'
import type { Action } from '@/lib/authority/ontology'

export interface CaseAccessScopeInput {
  canComment?: boolean
  canUploadDocuments?: boolean
  canEditCaseNotes?: boolean
  canDraftActions?: boolean
  canModifyDocuments?: boolean
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
  canModifyDocuments: boolean
  canDiscloseToMember: boolean
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
  canModifyDocuments: boolean
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
  canModifyDocuments: false,
  canDiscloseToMember: false,
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

const EDITING_PERMISSIONS = ['write_notes', 'draft_action', 'upload_evidence', 'modify_document'] as const

function roleFor(permissions: readonly string[]): CaseAccessRole {
  if (EDITING_PERMISSIONS.some((p) => permissions.includes(p))) return 'secondary_lro'
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
  // Each capability is its own kernel decision; none is inferred from another.
  const can = {
    comment: await allowed('case:comment'),
    notes: await allowed('case:write_notes'),
    draft: await allowed('case:draft_action'),
    upload: await allowed('case:upload_evidence'),
    modify: await allowed('case:modify_document'),
    disclose: await allowed('case:disclose_to_member'),
    close: await allowed('case:close'),
    sealed: await allowed('case:export_sealed_evidence'),
    restricted: await allowed('case:read_third_party_restricted'),
    assign: await allowed('case:assign'),
  }
  const mine = await liveRelationships(tx, params.organizationId, params.grievanceId, params.userId)
  const isPrimaryOwner = mine.some((r) => r.relation === 'owner' || r.relation === 'assignee')
  const collaborator = mine.find((r) => r.relation === 'collaborator')
  const common = {
    canViewCase: true,
    canManageAssignments: can.assign,
    canComment: can.comment,
    canUploadDocuments: can.upload,
    canEditCaseNotes: can.notes,
    canDraftActions: can.draft,
    canModifyDocuments: can.modify,
    canDiscloseToMember: can.disclose,
    canViewPrivateDocuments: can.restricted,
  }
  if (isPrimaryOwner) {
    return {
      ...common,
      isPrimaryOwner: true,
      isSecondaryCollaborator: false,
      accessRole: 'primary_owner',
      ownerOnly: { canReassignPrimary: can.assign, canCloseCase: can.close, canRemovePrimaryAccess: can.assign, canExportSealedEvidence: can.sealed },
    }
  }
  return {
    ...common,
    isPrimaryOwner: false,
    isSecondaryCollaborator: Boolean(collaborator),
    accessRole: collaborator ? roleFor(permissionList(collaborator.permissions)) : null,
    ownerOnly: { canReassignPrimary: false, canCloseCase: can.close, canRemovePrimaryAccess: false, canExportSealedEvidence: can.sealed },
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
    canUploadDocuments: primary || permissions.includes('upload_evidence'),
    canEditCaseNotes: primary || permissions.includes('write_notes'),
    canDraftActions: primary || permissions.includes('draft_action'),
    canModifyDocuments: primary || permissions.includes('modify_document'),
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
  input: Pick<GrantCaseAccessInput, 'accessRole' | 'expiresAt' | 'canViewPrivateDocuments' | 'canUploadDocuments' | 'canEditCaseNotes' | 'canDraftActions' | 'canModifyDocuments'>,
  now: Date = new Date(),
): CaseAccessMutationFailure | null {
  if (input.accessRole !== 'secondary_lro' && (input.canEditCaseNotes || input.canDraftActions || input.canUploadDocuments || input.canModifyDocuments)) {
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
  input: Pick<GrantCaseAccessInput, 'accessRole' | 'canComment' | 'canUploadDocuments' | 'canEditCaseNotes' | 'canDraftActions' | 'canModifyDocuments' | 'canViewPrivateDocuments'>,
): string[] {
  const permissions = ['read', 'read_internal']
  if (input.accessRole !== 'read_only' && input.canComment !== false) permissions.push('comment')
  // Each editing capability is granted only when asked for by name, and only on a secondary LRO grant.
  if (input.accessRole === 'secondary_lro') {
    if (input.canEditCaseNotes) permissions.push('write_notes')
    if (input.canDraftActions) permissions.push('draft_action')
    if (input.canUploadDocuments) permissions.push('upload_evidence')
    if (input.canModifyDocuments) permissions.push('modify_document')
  }
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

/**
 * Makes `assigneeUserId` the case's primary representative through the kernel: a first assignment is `assignCase`, a
 * change is `reassignCase` (the outgoing relationships end and the incoming one starts in the same transaction), and
 * every step needs the issuer's `case:assign` authority under an adopted issuance rule. Returns the previous primary
 * representative, if any. Throws `AuthorityStoreError` when the kernel refuses; nothing is written in that case.
 */
export async function assignPrimaryRepresentative(
  tx: RLSTx,
  params: { organizationId: string; grievanceId: string; issuerUserId: string; assigneeUserId: string },
): Promise<{ previousUserId: string | null }> {
  const exec = drizzleExecutor(tx)
  const current = (await listCaseCollaborators(tx, params.organizationId, params.grievanceId)).filter((c) => c.relation !== 'collaborator')
  const holders = [...new Set(current.map((c) => c.userId))]
  if (holders.length === 1 && holders[0] === params.assigneeUserId) return { previousUserId: params.assigneeUserId }
  const effectiveAt = new Date(Date.now() - 1000)
  const permissions = ['read', 'read_internal', 'comment', 'write_notes', 'draft_action', 'upload_evidence', 'modify_document']
  if (holders.length === 0) {
    await assignCase(exec, kernelDeps, {
      organizationId: params.organizationId, issuerUserId: params.issuerUserId, caseId: params.grievanceId,
      assigneeUserId: params.assigneeUserId, permissions, effectiveAt,
    })
    return { previousUserId: null }
  }
  const [first, ...others] = holders
  await reassignCase(exec, kernelDeps, {
    organizationId: params.organizationId, issuerUserId: params.issuerUserId, caseId: params.grievanceId,
    outgoingUserId: first, incomingUserId: params.assigneeUserId, permissions, effectiveAt,
  })
  for (const other of others.filter((u) => u !== params.assigneeUserId)) {
    for (const rel of current.filter((c) => c.userId === other)) {
      await revokeCaseAssignment(exec, kernelDeps, { organizationId: params.organizationId, issuerUserId: params.issuerUserId, caseId: params.grievanceId, relationshipId: rel.id })
    }
  }
  return { previousUserId: first }
}
