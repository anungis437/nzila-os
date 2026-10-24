/**
 * Authority store — fact loading.
 *
 * Reads the authoritative rows (RLS-scoped AND explicitly org-filtered, as
 * defence in depth) and shapes them into the kernel's `AuthorityFacts`.
 * Membership is not stored by the kernel: it comes from a `MembershipSource`
 * port bound in Phase 2 to the canonical organization-membership relation, so
 * identity and tenancy stay owned by one system.
 *
 * Loading is fail-closed: a row that cannot be mapped faithfully throws, and the
 * enforcement wrapper turns that into a deny.
 */
import type {
  ApprovalRequestFacts,
  AuthorityFacts,
  Capacity,
  Delegation,
  DisclosureConsent,
  Mandate,
  Membership,
  Recusal,
  ResourceRef,
  ResourceRelationship,
} from '../ontology'
import { isUuid, type SqlExecutor } from './executor'

export type MembershipSource = (
  exec: SqlExecutor,
  organizationId: string,
  userIds: readonly string[],
) => Promise<readonly Membership[]>

const toDate = (value: unknown): Date => {
  const d = value instanceof Date ? value : new Date(String(value))
  if (Number.isNaN(d.getTime())) throw new Error(`unmappable timestamp: ${String(value)}`)
  return d
}
const toDateOrNull = (value: unknown): Date | null => (value === null || value === undefined ? null : toDate(value))
const arr = <T = string>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : [])

type Row = Record<string, unknown>

export const mapMandate = (r: Row): Mandate => ({
  id: String(r.id),
  organizationId: String(r.organization_id),
  principalUserId: String(r.principal_user_id),
  kind: r.kind as Mandate['kind'],
  powers: arr(r.powers),
  scope: (r.scope ?? {}) as Mandate['scope'],
  monetaryLimitMinor: r.monetary_limit_minor === null || r.monetary_limit_minor === undefined ? null : Number(r.monetary_limit_minor),
  currency: (r.currency as string | null) ?? null,
  sourceInstrument: String(r.source_instrument),
  grantedBy: String(r.granted_by),
  approvedBy: (r.approved_by as string | null) ?? null,
  justification: (r.justification as string | null) ?? null,
  status: r.status as Mandate['status'],
  effectiveAt: toDate(r.effective_at),
  expiresAt: toDateOrNull(r.expires_at),
  revokedAt: toDateOrNull(r.revoked_at),
})

export const mapRelationship = (r: Row): ResourceRelationship => ({
  id: String(r.id),
  organizationId: String(r.organization_id),
  principalUserId: String(r.principal_user_id),
  resource: { type: r.resource_type as ResourceRef['type'], id: String(r.resource_id), organizationId: String(r.organization_id) },
  relation: r.relation as ResourceRelationship['relation'],
  permissions: arr(r.permissions),
  privilegedAccess: Boolean(r.privileged_access),
  origin: r.origin as ResourceRelationship['origin'],
  grantedBy: (r.granted_by as string | null) ?? null,
  status: r.status as ResourceRelationship['status'],
  effectiveAt: toDate(r.effective_at),
  expiresAt: toDateOrNull(r.expires_at),
  revokedAt: toDateOrNull(r.revoked_at),
})

export const mapDelegation = (r: Row): Delegation => ({
  id: String(r.id),
  organizationId: String(r.organization_id),
  delegatorUserId: String(r.delegator_user_id),
  delegateUserId: String(r.delegate_user_id),
  office: String(r.office),
  actions: arr(r.actions),
  resourceTypes: arr(r.resource_types) as Delegation['resourceTypes'],
  status: r.status as Delegation['status'],
  effectiveAt: toDate(r.effective_at),
  expiresAt: toDateOrNull(r.expires_at),
  revokedAt: toDateOrNull(r.revoked_at),
})

export const mapRecusal = (r: Row): Recusal => ({
  id: String(r.id),
  organizationId: String(r.organization_id),
  principalUserId: String(r.principal_user_id),
  resource: { type: r.resource_type as ResourceRef['type'], id: String(r.resource_id), organizationId: String(r.organization_id) },
  reason: String(r.reason),
  declaredAt: toDate(r.declared_at),
  liftedAt: toDateOrNull(r.lifted_at),
  liftedBy: (r.lifted_by as string | null) ?? null,
})

export const mapConsent = (r: Row): DisclosureConsent => ({
  id: String(r.id),
  organizationId: String(r.organization_id),
  memberUserId: String(r.member_user_id),
  matterId: String(r.matter_id),
  direction: r.direction as DisclosureConsent['direction'],
  issuer: r.issuer as DisclosureConsent['issuer'],
  categories: arr(r.categories),
  recipientUserId: (r.recipient_user_id as string | null) ?? null,
  purpose: String(r.purpose),
  grantedAt: toDate(r.granted_at),
  expiresAt: toDateOrNull(r.expires_at),
  revokedAt: toDateOrNull(r.revoked_at),
})

export interface LoadFactsInput {
  organizationId: string
  principalUserId: string
  authenticated: boolean
  /** The resource being decided on; narrows relationships, recusals and consents. */
  resource?: ResourceRef
  /** Needed to resolve the delegator's office mandate and membership. */
  delegationId?: string | null
}

/**
 * Loads every fact the kernel needs to decide for one principal. Delegators of
 * the principal's live delegations are loaded too (membership, mandates,
 * recusals), because a delegate's authority is only as good as the delegator's.
 */
export async function loadAuthorityFacts(
  exec: SqlExecutor,
  membershipSource: MembershipSource,
  input: LoadFactsInput,
): Promise<AuthorityFacts> {
  const { organizationId: org, principalUserId: me } = input
  if (!isUuid(org) || !isUuid(me)) throw new Error('organizationId and principalUserId must be uuids')

  const delegations = (
    await exec.query<Row>(
      `SELECT * FROM ue_authority_delegations
       WHERE organization_id = $1 AND delegate_user_id = $2 AND status = 'active' AND revoked_at IS NULL`,
      [org, me],
    )
  ).rows.map(mapDelegation)

  const people = [...new Set([me, ...delegations.map((d) => d.delegatorUserId)])]

  const mandates = (
    await exec.query<Row>(
      `SELECT * FROM ue_authority_mandates
       WHERE organization_id = $1 AND principal_user_id = ANY($2::uuid[]) AND status = 'active' AND revoked_at IS NULL`,
      [org, people],
    )
  ).rows.map(mapMandate)

  const relationships = (
    input.resource
      ? await exec.query<Row>(
          `SELECT * FROM ue_authority_resource_relationships
           WHERE organization_id = $1 AND principal_user_id = $2 AND resource_type = $3 AND resource_id = $4
             AND status = 'active' AND revoked_at IS NULL`,
          [org, me, input.resource.type, input.resource.id],
        )
      : { rows: [] as Row[] }
  ).rows.map(mapRelationship)

  const recusals = (
    await exec.query<Row>(
      `SELECT * FROM ue_authority_recusals
       WHERE organization_id = $1 AND principal_user_id = ANY($2::uuid[]) AND lifted_at IS NULL`,
      [org, people],
    )
  ).rows.map(mapRecusal)

  const consents = (
    input.resource?.type === 'workaid_matter'
      ? await exec.query<Row>(
          `SELECT * FROM ue_authority_disclosure_consents
           WHERE organization_id = $1 AND matter_id = $2 AND revoked_at IS NULL`,
          [org, input.resource.id],
        )
      : { rows: [] as Row[] }
  ).rows.map(mapConsent)

  const memberships = await membershipSource(exec, org, people)

  return {
    principal: { userId: me, authenticated: input.authenticated },
    memberships,
    mandates,
    relationships,
    delegations,
    recusals,
    consents,
  }
}

export async function loadApprovalRequestFacts(
  exec: SqlExecutor,
  organizationId: string,
  requestId: string,
): Promise<ApprovalRequestFacts | null> {
  if (!isUuid(organizationId) || !isUuid(requestId)) return null
  const req = (
    await exec.query<Row>(`SELECT * FROM ue_authority_approval_requests WHERE organization_id = $1 AND id = $2`, [organizationId, requestId])
  ).rows[0]
  if (!req) return null
  const decisions = (
    await exec.query<Row>(
      `SELECT approver_user_id, authority_line_user_id, decision FROM ue_authority_approval_decisions
       WHERE organization_id = $1 AND approval_request_id = $2 ORDER BY decided_at, id`,
      [organizationId, requestId],
    )
  ).rows
  return {
    kind: 'approval_request',
    id: String(req.id),
    organizationId: String(req.organization_id),
    subjectType: String(req.subject_type),
    subjectId: String(req.subject_id),
    proposedBy: String(req.proposed_by),
    subjectAuthorId: (req.subject_author_id as string | null) ?? null,
    requiredApprovals: Number(req.required_approvals),
    status: req.status as ApprovalRequestFacts['status'],
    namedApproverIds: arr(req.named_approver_ids),
    eligibleCapacities: arr(req.eligible_capacities) as Capacity[],
    decisions: decisions.map((d) => ({
      approverUserId: String(d.approver_user_id),
      authorityLineUserId: String(d.authority_line_user_id),
      decision: d.decision as 'approved' | 'rejected',
    })),
    adverseUserIds: arr(req.adverse_user_ids),
    riskClass: req.risk_class as ApprovalRequestFacts['riskClass'],
  }
}
