/**
 * Authority store — row writers.
 *
 * Every function takes an executor that is ALREADY inside
 * `runAuthorityTransaction`, performs exactly one authority mutation, and then
 * appends the canonical audit record covering it through the same executor. The
 * database independently enforces structure (expiry, grantor separation,
 * terminal revocation, issuance-rule ceilings, one-person-one-vote, ...) and
 * refuses COMMIT if the canonical audit record is missing.
 *
 * These are WRITERS, not policy. Who may issue, amend, suspend, revoke or lift is
 * decided by lifecycle.ts through the issuance policy; approval decisions are the
 * one exception: they are gated here by the kernel, then re-validated by the
 * database.
 */
import { randomUUID } from 'node:crypto'
import type { AuthorityRequest, Decision, MandateKind, MandateScope, ResourceType } from '../ontology'
import { auditAuthorityMutation } from './audit'
import { assertAllowed, enforceAuthority, requireCounselSession, type EnforcementDeps } from './enforce'
import { AuthorityStoreError, bindSessionActor, isPrincipalId, isUuid, type SqlExecutor } from './executor'

type Row = Record<string, unknown>

async function one(exec: SqlExecutor, sql: string, params: unknown[]): Promise<Row> {
  const row = (await exec.query<Row>(sql, params)).rows[0]
  if (!row) throw new AuthorityStoreError('NOT_FOUND', 'no matching live record in this organization')
  return row
}

export function requireUuids(...values: (string | null | undefined)[]): void {
  for (const v of values) {
    if (v !== null && v !== undefined && !isUuid(v)) throw new AuthorityStoreError('INVALID_CONTEXT', 'expected a uuid')
  }
}

export function requirePrincipals(...values: (string | null | undefined)[]): void {
  for (const v of values) {
    if (v !== null && v !== undefined && !isPrincipalId(v)) throw new AuthorityStoreError('INVALID_CONTEXT', 'expected an internal principal id')
  }
}

// ── Mandates ─────────────────────────────────────────────────────────────────

export interface InsertMandateInput {
  id?: string
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
  issuanceRuleId: string | null
  approvalRequestId?: string | null
  supersedesId?: string | null
}

export async function insertMandate(exec: SqlExecutor, i: InsertMandateInput): Promise<string> {
  requireUuids(i.organizationId, i.id, i.issuanceRuleId, i.approvalRequestId, i.supersedesId)
  requirePrincipals(i.principalUserId, i.grantedBy, i.approvedBy)
  await bindSessionActor(exec, i.grantedBy, 'mandate issuer')
  const id = i.id ?? randomUUID()
  await one(
    exec,
    `INSERT INTO ue_authority_mandates
       (id, organization_id, principal_user_id, kind, powers, scope, monetary_limit_minor, currency,
        source_instrument, granted_by, approved_by, justification, effective_at, expires_at,
        issuance_rule_id, approval_request_id, supersedes_id)
     VALUES ($1,$2,$3,$4,$5::text[],$6::jsonb,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING id`,
    [
      id, i.organizationId, i.principalUserId, i.kind, [...i.powers], JSON.stringify(i.scope ?? {}),
      i.monetaryLimitMinor ?? null, i.currency ?? null, i.sourceInstrument, i.grantedBy,
      i.approvedBy ?? null, i.justification ?? null, i.effectiveAt, i.expiresAt,
      i.issuanceRuleId, i.approvalRequestId ?? null, i.supersedesId ?? null,
    ],
  )
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'mandate.issue',
    resourceType: 'ue_authority_mandates',
    resourceId: id,
    details: { kind: i.kind, holder: i.principalUserId, issuer: i.grantedBy, ruleId: i.issuanceRuleId, supersedes: i.supersedesId ?? null },
  })
  return id
}

export type MandateStateChange = 'revoke' | 'suspend' | 'resume'

export async function changeMandateState(
  exec: SqlExecutor,
  organizationId: string,
  id: string,
  change: MandateStateChange,
  actorUserId: string,
): Promise<void> {
  requireUuids(organizationId, id)
  requirePrincipals(actorUserId)
  await bindSessionActor(exec, actorUserId, 'mandate actor')
  const sql =
    change === 'revoke'
      ? `UPDATE ue_authority_mandates SET status = 'revoked', revoked_at = now(), revoked_by = $3
          WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`
      : change === 'suspend'
        ? `UPDATE ue_authority_mandates SET status = 'suspended'
            WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL AND status = 'active' AND $3::text IS NOT NULL RETURNING id`
        : `UPDATE ue_authority_mandates SET status = 'active'
            WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL AND status = 'suspended' AND $3::text IS NOT NULL RETURNING id`
  await one(exec, sql, [organizationId, id, actorUserId])
  await auditAuthorityMutation(exec, {
    organizationId,
    action: `mandate.${change}`,
    resourceType: 'ue_authority_mandates',
    resourceId: id,
    details: { actor: actorUserId },
  })
}

// ── Relationships ────────────────────────────────────────────────────────────

export interface InsertRelationshipInput {
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
  issuanceRuleId?: string | null
  /** Extra, non-authoritative context recorded in the audit row (for example a backfill decision reference). */
  auditDetails?: Record<string, unknown>
}

export async function insertRelationship(exec: SqlExecutor, i: InsertRelationshipInput): Promise<string> {
  requireUuids(i.organizationId, i.resourceId, i.issuanceRuleId)
  requirePrincipals(i.principalUserId, i.grantedBy)
  if (i.grantedBy) await bindSessionActor(exec, i.grantedBy, 'relationship grantor')
  const row = await one(
    exec,
    `INSERT INTO ue_authority_resource_relationships
       (organization_id, principal_user_id, resource_type, resource_id, relation, permissions,
        privileged_access, origin, granted_by, effective_at, expires_at, issuance_rule_id)
     VALUES ($1,$2,$3,$4,$5,$6::text[],$7,$8,$9,$10,$11,$12) RETURNING id`,
    [
      i.organizationId, i.principalUserId, i.resourceType, i.resourceId, i.relation, [...(i.permissions ?? [])],
      i.privilegedAccess ?? false, i.origin, i.grantedBy ?? null, i.effectiveAt, i.expiresAt ?? null, i.issuanceRuleId ?? null,
    ],
  )
  const id = String(row.id)
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'relationship.grant',
    resourceType: 'ue_authority_resource_relationships',
    resourceId: id,
    details: { relation: i.relation, holder: i.principalUserId, resourceType: i.resourceType, resourceId: i.resourceId, ...(i.auditDetails ?? {}) },
  })
  return id
}

export async function revokeRelationship(exec: SqlExecutor, organizationId: string, id: string, revokedBy: string): Promise<void> {
  requireUuids(organizationId, id)
  requirePrincipals(revokedBy)
  await bindSessionActor(exec, revokedBy, 'revoker')
  await one(
    exec,
    `UPDATE ue_authority_resource_relationships SET status = 'revoked', revoked_at = now(), revoked_by = $3
     WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`,
    [organizationId, id, revokedBy],
  )
  await auditAuthorityMutation(exec, { organizationId, action: 'relationship.revoke', resourceType: 'ue_authority_resource_relationships', resourceId: id, details: { actor: revokedBy } })
}

// ── Delegations ──────────────────────────────────────────────────────────────

export interface InsertDelegationInput {
  id?: string
  organizationId: string
  delegatorUserId: string
  delegateUserId: string
  office: string
  actions: readonly string[]
  resourceTypes: readonly ResourceType[]
  effectiveAt: Date
  expiresAt: Date
  issuanceRuleId: string | null
  approvalRequestId?: string | null
}

export async function insertDelegation(exec: SqlExecutor, i: InsertDelegationInput): Promise<string> {
  requireUuids(i.organizationId, i.id, i.issuanceRuleId, i.approvalRequestId)
  requirePrincipals(i.delegatorUserId, i.delegateUserId)
  await bindSessionActor(exec, i.delegatorUserId, 'delegator')
  const id = i.id ?? randomUUID()
  await one(
    exec,
    `INSERT INTO ue_authority_delegations
       (id, organization_id, delegator_user_id, delegate_user_id, office, actions, resource_types,
        effective_at, expires_at, issuance_rule_id, approval_request_id)
     VALUES ($1,$2,$3,$4,$5,$6::text[],$7::text[],$8,$9,$10,$11) RETURNING id`,
    [id, i.organizationId, i.delegatorUserId, i.delegateUserId, i.office, [...i.actions], [...i.resourceTypes], i.effectiveAt, i.expiresAt, i.issuanceRuleId, i.approvalRequestId ?? null],
  )
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'delegation.issue',
    resourceType: 'ue_authority_delegations',
    resourceId: id,
    details: { delegator: i.delegatorUserId, delegate: i.delegateUserId, office: i.office, ruleId: i.issuanceRuleId },
  })
  return id
}

export async function revokeDelegation(exec: SqlExecutor, organizationId: string, id: string, revokedBy: string): Promise<void> {
  requireUuids(organizationId, id)
  requirePrincipals(revokedBy)
  await bindSessionActor(exec, revokedBy, 'revoker')
  await one(
    exec,
    `UPDATE ue_authority_delegations SET status = 'revoked', revoked_at = now(), revoked_by = $3
     WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`,
    [organizationId, id, revokedBy],
  )
  await auditAuthorityMutation(exec, { organizationId, action: 'delegation.revoke', resourceType: 'ue_authority_delegations', resourceId: id, details: { actor: revokedBy } })
}

// ── Acceptance ───────────────────────────────────────────────────────────────

export async function insertAcceptance(
  exec: SqlExecutor,
  i: { organizationId: string; instrumentType: 'mandate' | 'delegation'; instrumentId: string; acceptedBy: string },
): Promise<string> {
  requireUuids(i.organizationId, i.instrumentId)
  requirePrincipals(i.acceptedBy)
  await bindSessionActor(exec, i.acceptedBy, 'accepting holder')
  const row = await one(
    exec,
    `INSERT INTO ue_authority_acceptances (organization_id, instrument_type, instrument_id, accepted_by) VALUES ($1,$2,$3,$4) RETURNING id`,
    [i.organizationId, i.instrumentType, i.instrumentId, i.acceptedBy],
  )
  const id = String(row.id)
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: `${i.instrumentType}.accept`,
    resourceType: 'ue_authority_acceptances',
    resourceId: id,
    details: { instrumentId: i.instrumentId, acceptedBy: i.acceptedBy },
  })
  return id
}

// ── Recusals ─────────────────────────────────────────────────────────────────

export async function insertRecusal(
  exec: SqlExecutor,
  i: { organizationId: string; principalUserId: string; resourceType: ResourceType; resourceId: string; reason: string },
): Promise<string> {
  requireUuids(i.organizationId, i.resourceId)
  requirePrincipals(i.principalUserId)
  await bindSessionActor(exec, i.principalUserId, 'recusing principal')
  const row = await one(
    exec,
    `INSERT INTO ue_authority_recusals (organization_id, principal_user_id, resource_type, resource_id, reason)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [i.organizationId, i.principalUserId, i.resourceType, i.resourceId, i.reason],
  )
  const id = String(row.id)
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'recusal.declare',
    resourceType: 'ue_authority_recusals',
    resourceId: id,
    details: { principal: i.principalUserId, resourceType: i.resourceType, resourceId: i.resourceId },
  })
  return id
}

export async function liftRecusalRow(exec: SqlExecutor, organizationId: string, id: string, liftedBy: string): Promise<void> {
  requireUuids(organizationId, id)
  requirePrincipals(liftedBy)
  await bindSessionActor(exec, liftedBy, 'recusal lifter')
  await one(
    exec,
    `UPDATE ue_authority_recusals SET lifted_at = now(), lifted_by = $3
     WHERE organization_id = $1 AND id = $2 AND lifted_at IS NULL RETURNING id`,
    [organizationId, id, liftedBy],
  )
  await auditAuthorityMutation(exec, { organizationId, action: 'recusal.lift', resourceType: 'ue_authority_recusals', resourceId: id, details: { actor: liftedBy } })
}

// ── Consents ─────────────────────────────────────────────────────────────────

export interface InsertConsentInput {
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

/**
 * The issuer is always the authenticated session principal. A member-issued consent is the member's own act;
 * a counsel-issued one additionally needs a verified counsel session (see requireCounselSession).
 */
export async function insertConsent(exec: SqlExecutor, i: InsertConsentInput, deps?: Pick<EnforcementDeps, 'counsel' | 'memberships'>): Promise<string> {
  requireUuids(i.organizationId, i.matterId)
  requirePrincipals(i.memberUserId, i.issuedBy, i.recipientUserId)
  if (i.issuer === 'counsel') await requireCounselSession(exec, deps ?? ({} as Pick<EnforcementDeps, 'counsel' | 'memberships'>), { organizationId: i.organizationId, matterId: i.matterId, claimedUserId: i.issuedBy })
  else await bindSessionActor(exec, i.issuedBy, 'consent issuer')
  const row = await one(
    exec,
    `INSERT INTO ue_authority_disclosure_consents
       (organization_id, member_user_id, matter_id, direction, issuer, issued_by, categories,
        recipient_user_id, purpose, granted_at, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7::text[],$8,$9,$10,$11) RETURNING id`,
    [i.organizationId, i.memberUserId, i.matterId, i.direction, i.issuer, i.issuedBy, [...i.categories], i.recipientUserId ?? null, i.purpose, i.grantedAt, i.expiresAt],
  )
  const id = String(row.id)
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'consent.grant',
    resourceType: 'ue_authority_disclosure_consents',
    resourceId: id,
    details: { direction: i.direction, issuer: i.issuer, matterId: i.matterId },
  })
  return id
}

export async function revokeConsent(exec: SqlExecutor, organizationId: string, id: string, revokedBy: string): Promise<void> {
  requireUuids(organizationId, id)
  requirePrincipals(revokedBy)
  await bindSessionActor(exec, revokedBy, 'revoker')
  await one(
    exec,
    `UPDATE ue_authority_disclosure_consents SET revoked_at = now(), revoked_by = $3
     WHERE organization_id = $1 AND id = $2 AND revoked_at IS NULL RETURNING id`,
    [organizationId, id, revokedBy],
  )
  await auditAuthorityMutation(exec, { organizationId, action: 'consent.revoke', resourceType: 'ue_authority_disclosure_consents', resourceId: id, details: { actor: revokedBy } })
}

// ── Approval requests and decisions ──────────────────────────────────────────

export interface OpenApprovalInput {
  id?: string
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
  requireUuids(i.organizationId, i.subjectId, i.id)
  requirePrincipals(i.proposedBy, i.subjectAuthorId, ...(i.namedApproverIds ?? []), ...(i.adverseUserIds ?? []))
  await bindSessionActor(exec, i.proposedBy, 'proposer')
  const id = i.id ?? randomUUID()
  await one(
    exec,
    `INSERT INTO ue_authority_approval_requests
       (id, organization_id, subject_type, subject_id, proposed_by, subject_author_id, required_approvals, risk_class,
        named_approver_ids, eligible_capacities, adverse_user_ids)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::text[],$10::text[],$11::text[]) RETURNING id`,
    [
      id, i.organizationId, i.subjectType, i.subjectId, i.proposedBy, i.subjectAuthorId ?? null, i.requiredApprovals, i.riskClass,
      [...(i.namedApproverIds ?? [])], [...(i.eligibleCapacities ?? [])], [...(i.adverseUserIds ?? [])],
    ],
  )
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: 'approval.open',
    resourceType: 'ue_authority_approval_requests',
    resourceId: id,
    details: { subjectType: i.subjectType, subjectId: i.subjectId, proposedBy: i.proposedBy, required: i.requiredApprovals },
  })
  return id
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
  requireUuids(i.organizationId, i.approvalRequestId, i.delegationId)
  requirePrincipals(i.approverUserId)
  await bindSessionActor(exec, i.approverUserId, 'approver')
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
  const decisionId = String(row.id)
  await auditAuthorityMutation(exec, {
    organizationId: i.organizationId,
    action: `approval.${i.decision}`,
    resourceType: 'ue_authority_approval_decisions',
    resourceId: decisionId,
    details: { requestId: i.approvalRequestId, approver: i.approverUserId, authorityLine: kernel.authorityLineUserId, delegationId: i.delegationId ?? null },
  })
  return { decisionId, kernel }
}
