/**
 * Authority store — mutations.
 *
 * Every function takes an executor that is ALREADY inside
 * `runAuthorityTransaction`. The database enforces structural integrity
 * (expiry, grantor separation, terminal revocation, one-person-one-vote,
 * self-approval, recusal) and records each change in ue_authority_events in the
 * same transaction. Who may ISSUE a mandate, delegation or recusal is an
 * institutional decision outside the frozen persona contracts; these functions
 * record such acts, they do not authorize them. Approval decisions are the
 * exception: they are gated by the kernel first, then re-validated by the
 * database.
 */
import type { AuthorityRequest, Decision, MandateKind, MandateScope, ResourceType } from '../ontology'
import { assertAllowed, enforceAuthority, type EnforcementDeps } from './enforce'
import { AuthorityStoreError, isUuid, type SqlExecutor } from './executor'

type Row = Record<string, unknown>

async function one(exec: SqlExecutor, sql: string, params: unknown[]): Promise<Row> {
  const row = (await exec.query<Row>(sql, params)).rows[0]
  if (!row) throw new AuthorityStoreError('NOT_FOUND', 'no matching live record in this organization')
  return row
}

function requireUuids(...values: (string | null | undefined)[]): void {
  for (const v of values) {
    if (v !== null && v !== undefined && !isUuid(v)) throw new AuthorityStoreError('INVALID_CONTEXT', 'expected a uuid')
  }
}

export interface GrantMandateInput {
  organizationId: string
  principalUserId: string
  kind: MandateKind
  powers: readonly string[]
  scope?: MandateScope
  monetaryLimitMinor?: number | null
  currency?: string | null
  sourceInstrument: string
  grantedBy: string
  approvedBy?: string | null
  justification?: string | null
  effectiveAt: Date
  expiresAt: Date
}

export async function grantMandate(exec: SqlExecutor, i: GrantMandateInput): Promise<string> {
  requireUuids(i.organizationId, i.principalUserId, i.grantedBy, i.approvedBy)
  const row = await one(
    exec,
    `INSERT INTO ue_authority_mandates
       (organization_id, principal_user_id, kind, powers, scope, monetary_limit_minor, currency,
        source_instrument, granted_by, approved_by, justification, effective_at, expires_at)
     VALUES ($1,$2,$3,$4::text[],$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [
      i.organizationId, i.principalUserId, i.kind, [...i.powers], JSON.stringify(i.scope ?? {}),
      i.monetaryLimitMinor ?? null, i.currency ?? null, i.sourceInstrument, i.grantedBy,
      i.approvedBy ?? null, i.justification ?? null, i.effectiveAt, i.expiresAt,
    ],
  )
  return String(row.id)
}

export async function revokeMandate(exec: SqlExecutor, organizationId: string, id: string, revokedBy: string): Promise<void> {
  requireUuids(organizationId, id, revokedBy)
  await one(
    exec,
    `UPDATE ue_authority_mandates SET status = 'revoked', revoked_at = now(), revoked_by = $3
     WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`,
    [organizationId, id, revokedBy],
  )
}

export interface GrantRelationshipInput {
  organizationId: string
  principalUserId: string
  resourceType: ResourceType
  resourceId: string
  relation: 'creator' | 'owner' | 'assignee' | 'collaborator' | 'represented_member'
  permissions?: readonly string[]
  privilegedAccess?: boolean
  origin: 'derived' | 'explicit'
  grantedBy?: string | null
  effectiveAt: Date
  expiresAt?: Date | null
}

export async function grantRelationship(exec: SqlExecutor, i: GrantRelationshipInput): Promise<string> {
  requireUuids(i.organizationId, i.principalUserId, i.resourceId, i.grantedBy)
  const row = await one(
    exec,
    `INSERT INTO ue_authority_resource_relationships
       (organization_id, principal_user_id, resource_type, resource_id, relation, permissions,
        privileged_access, origin, granted_by, effective_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6::text[],$7,$8,$9,$10,$11) RETURNING id`,
    [
      i.organizationId, i.principalUserId, i.resourceType, i.resourceId, i.relation, [...(i.permissions ?? [])],
      i.privilegedAccess ?? false, i.origin, i.grantedBy ?? null, i.effectiveAt, i.expiresAt ?? null,
    ],
  )
  return String(row.id)
}

export async function revokeRelationship(exec: SqlExecutor, organizationId: string, id: string, revokedBy: string): Promise<void> {
  requireUuids(organizationId, id, revokedBy)
  await one(
    exec,
    `UPDATE ue_authority_resource_relationships SET status = 'revoked', revoked_at = now(), revoked_by = $3
     WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`,
    [organizationId, id, revokedBy],
  )
}

export interface GrantDelegationInput {
  organizationId: string
  delegatorUserId: string
  delegateUserId: string
  office: string
  actions: readonly string[]
  resourceTypes: readonly ResourceType[]
  effectiveAt: Date
  expiresAt: Date
}

export async function grantDelegation(exec: SqlExecutor, i: GrantDelegationInput): Promise<string> {
  requireUuids(i.organizationId, i.delegatorUserId, i.delegateUserId)
  const row = await one(
    exec,
    `INSERT INTO ue_authority_delegations
       (organization_id, delegator_user_id, delegate_user_id, office, actions, resource_types, effective_at, expires_at)
     VALUES ($1,$2,$3,$4,$5::text[],$6::text[],$7,$8) RETURNING id`,
    [i.organizationId, i.delegatorUserId, i.delegateUserId, i.office, [...i.actions], [...i.resourceTypes], i.effectiveAt, i.expiresAt],
  )
  return String(row.id)
}

export async function revokeDelegation(exec: SqlExecutor, organizationId: string, id: string, revokedBy: string): Promise<void> {
  requireUuids(organizationId, id, revokedBy)
  await one(
    exec,
    `UPDATE ue_authority_delegations SET status = 'revoked', revoked_at = now(), revoked_by = $3
     WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`,
    [organizationId, id, revokedBy],
  )
}

export async function declareRecusal(
  exec: SqlExecutor,
  i: { organizationId: string; principalUserId: string; resourceType: ResourceType; resourceId: string; reason: string },
): Promise<string> {
  requireUuids(i.organizationId, i.principalUserId, i.resourceId)
  const row = await one(
    exec,
    `INSERT INTO ue_authority_recusals (organization_id, principal_user_id, resource_type, resource_id, reason)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [i.organizationId, i.principalUserId, i.resourceType, i.resourceId, i.reason],
  )
  return String(row.id)
}

export async function liftRecusal(exec: SqlExecutor, organizationId: string, id: string, liftedBy: string): Promise<void> {
  requireUuids(organizationId, id, liftedBy)
  await one(
    exec,
    `UPDATE ue_authority_recusals SET lifted_at = now(), lifted_by = $3
     WHERE organization_id = $1 AND id = $2 AND lifted_at IS NULL RETURNING id`,
    [organizationId, id, liftedBy],
  )
}

export interface GrantConsentInput {
  organizationId: string
  memberUserId: string
  matterId: string
  direction: 'union_to_workaid' | 'workaid_to_union'
  issuer: 'member' | 'counsel'
  issuedBy: string
  categories: readonly string[]
  recipientUserId?: string | null
  purpose: string
  grantedAt: Date
  expiresAt: Date
}

export async function grantConsent(exec: SqlExecutor, i: GrantConsentInput): Promise<string> {
  requireUuids(i.organizationId, i.memberUserId, i.matterId, i.issuedBy, i.recipientUserId)
  const row = await one(
    exec,
    `INSERT INTO ue_authority_disclosure_consents
       (organization_id, member_user_id, matter_id, direction, issuer, issued_by, categories,
        recipient_user_id, purpose, granted_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::text[],$8,$9,$10,$11) RETURNING id`,
    [
      i.organizationId, i.memberUserId, i.matterId, i.direction, i.issuer, i.issuedBy, [...i.categories],
      i.recipientUserId ?? null, i.purpose, i.grantedAt, i.expiresAt,
    ],
  )
  return String(row.id)
}

export async function revokeConsent(exec: SqlExecutor, organizationId: string, id: string, revokedBy: string): Promise<void> {
  requireUuids(organizationId, id, revokedBy)
  await one(
    exec,
    `UPDATE ue_authority_disclosure_consents SET revoked_at = now(), revoked_by = $3
     WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`,
    [organizationId, id, revokedBy],
  )
}

export interface OpenApprovalInput {
  organizationId: string
  subjectType: string
  subjectId: string
  proposedBy: string
  subjectAuthorId?: string | null
  requiredApprovals: number
  riskClass: 'low' | 'medium' | 'high' | 'critical'
  namedApproverIds?: readonly string[]
  eligibleCapacities?: readonly string[]
  adverseUserIds?: readonly string[]
}

export async function openApprovalRequest(exec: SqlExecutor, i: OpenApprovalInput): Promise<string> {
  requireUuids(i.organizationId, i.subjectId, i.proposedBy, i.subjectAuthorId, ...(i.namedApproverIds ?? []), ...(i.adverseUserIds ?? []))
  const row = await one(
    exec,
    `INSERT INTO ue_authority_approval_requests
       (organization_id, subject_type, subject_id, proposed_by, subject_author_id, required_approvals, risk_class,
        named_approver_ids, eligible_capacities, adverse_user_ids)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::uuid[],$9::text[],$10::uuid[]) RETURNING id`,
    [
      i.organizationId, i.subjectType, i.subjectId, i.proposedBy, i.subjectAuthorId ?? null, i.requiredApprovals, i.riskClass,
      [...(i.namedApproverIds ?? [])], [...(i.eligibleCapacities ?? [])], [...(i.adverseUserIds ?? [])],
    ],
  )
  return String(row.id)
}

export interface RecordApprovalInput {
  organizationId: string
  approvalRequestId: string
  approverUserId: string
  decision: 'approved' | 'rejected'
  delegationId?: string | null
  rationale?: string | null
}

/**
 * Kernel first (policy), then the database (integrity under concurrency). The
 * kernel's authority line, not the caller's claim, is what is stored as the vote.
 */
export async function recordApprovalDecision(
  exec: SqlExecutor,
  deps: EnforcementDeps,
  i: RecordApprovalInput,
): Promise<{ decisionId: string; kernel: Decision }> {
  requireUuids(i.organizationId, i.approvalRequestId, i.approverUserId, i.delegationId)
  const req: AuthorityRequest = {
    principalUserId: i.approverUserId,
    organizationId: i.organizationId,
    action: 'governance:approve',
    resource: { type: 'approval_request', id: i.approvalRequestId, organizationId: i.organizationId },
    delegationId: i.delegationId ?? null,
  }
  const kernel = assertAllowed(await enforceAuthority(exec, deps, req, { authenticated: true }))
  const row = await one(
    exec,
    `INSERT INTO ue_authority_approval_decisions
       (organization_id, approval_request_id, approver_user_id, authority_line_user_id, delegation_id, decision, rationale)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [i.organizationId, i.approvalRequestId, i.approverUserId, kernel.authorityLineUserId, i.delegationId ?? null, i.decision, i.rationale ?? null],
  )
  return { decisionId: String(row.id), kernel }
}
