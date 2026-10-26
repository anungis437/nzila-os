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
import { assessMandate } from '../common'
import type { IssuanceApproval, IssuanceRule } from '../issuance'
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
import { isPrincipalId, isUuid, parsePgTextArray, type SqlExecutor } from './executor'

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
const arr = <T = string>(value: unknown): T[] => parsePgTextArray(value) as unknown as T[]

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
  requiresAcceptance: Boolean(r.requires_acceptance),
  acceptedAt: toDateOrNull(r.accepted_at),
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
  requiresAcceptance: Boolean(r.requires_acceptance),
  acceptedAt: toDateOrNull(r.accepted_at),
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
  /** Evaluation time, used to decide which mandates are live enough to confer appointment capacity. */
  now?: Date
}

/**
 * Appointment-only capacities are earned by a LIVE mandate, never by a role
 * label. They remain eligibility only: the mandate is still what grants access.
 */
function withAppointmentCapacities(
  memberships: readonly Membership[],
  mandates: readonly Mandate[],
  me: string,
  org: string,
  now: Date,
): Membership[] {
  const earned = new Set<Capacity>()
  for (const m of mandates) {
    if (m.principalUserId !== me || !assessMandate(m, org, now).effective) continue
    if (m.kind === 'financial' && m.powers.includes('audit')) earned.add('auditor')
    if (m.kind === 'governance_review') earned.add('governance_reviewer')
  }
  if (earned.size === 0) return [...memberships]
  return memberships.map((mem) =>
    mem.userId === me && mem.organizationId === org
      ? { ...mem, capacities: [...new Set<Capacity>([...mem.capacities, ...earned])] }
      : mem,
  )
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
  if (!isUuid(org) || !isPrincipalId(me)) throw new Error('organizationId must be a uuid and principalUserId a valid internal principal id')

  const delegations = (
    await exec.query<Row>(
      `SELECT d.*, (SELECT a.accepted_at FROM ue_authority_acceptances a
                     WHERE a.organization_id = d.organization_id AND a.instrument_type = 'delegation' AND a.instrument_id = d.id) AS accepted_at
         FROM ue_authority_delegations d
        WHERE d.organization_id = $1 AND d.delegate_user_id = $2 AND d.status = 'active' AND d.revoked_at IS NULL`,
      [org, me],
    )
  ).rows.map(mapDelegation)

  const people = [...new Set([me, ...delegations.map((d) => d.delegatorUserId)])]

  const mandates = (
    await exec.query<Row>(
      `SELECT m.*, (SELECT a.accepted_at FROM ue_authority_acceptances a
                     WHERE a.organization_id = m.organization_id AND a.instrument_type = 'mandate' AND a.instrument_id = m.id) AS accepted_at
         FROM ue_authority_mandates m
        WHERE m.organization_id = $1 AND m.principal_user_id = ANY($2::text[]) AND m.status = 'active' AND m.revoked_at IS NULL`,
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
       WHERE organization_id = $1 AND principal_user_id = ANY($2::text[]) AND lifted_at IS NULL`,
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

  const memberships = withAppointmentCapacities(
    await membershipSource(exec, org, people),
    mandates,
    me,
    org,
    input.now ?? new Date(),
  )

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

/** Kernel-owned relationships of one principal on one resource (derived relationships come from resource loaders). */
export async function loadRelationships(
  exec: SqlExecutor,
  organizationId: string,
  principalUserId: string,
  resourceType: ResourceRef['type'],
  resourceId: string,
): Promise<ResourceRelationship[]> {
  return (
    await exec.query<Row>(
      `SELECT * FROM ue_authority_resource_relationships
        WHERE organization_id = $1 AND principal_user_id = $2 AND resource_type = $3 AND resource_id = $4
          AND status = 'active' AND revoked_at IS NULL`,
      [organizationId, principalUserId, resourceType, resourceId],
    )
  ).rows.map(mapRelationship)
}

const mapRule = (r: Row): IssuanceRule => ({
  id: String(r.id),
  organizationId: String(r.organization_id),
  domain: r.domain as IssuanceRule['domain'],
  operation: r.operation as IssuanceRule['operation'],
  issuerCapacities: arr(r.issuer_capacities) as Capacity[],
  issuerMandateKind: (r.issuer_mandate_kind as IssuanceRule['issuerMandateKind']) ?? null,
  issuerMandatePower: (r.issuer_mandate_power as string | null) ?? null,
  allowedPowers: arr(r.allowed_powers),
  maxTermDays: r.max_term_days === null || r.max_term_days === undefined ? null : Number(r.max_term_days),
  requiresAcceptance: Boolean(r.requires_acceptance),
  requiredIndependentApprovals: Number(r.required_independent_approvals),
  version: Number(r.version),
  status: r.status as IssuanceRule['status'],
  sourceInstrument: String(r.source_instrument),
  draftedBy: String(r.drafted_by),
  approvedBy: arr(r.approved_by),
})

/** The single ACTIVE rule for a domain and operation, or null. Draft and retired rules are never returned. */
export async function loadActiveIssuanceRule(
  exec: SqlExecutor,
  organizationId: string,
  domain: IssuanceRule['domain'],
  operation: IssuanceRule['operation'],
): Promise<IssuanceRule | null> {
  if (!isUuid(organizationId)) return null
  const rows = (
    await exec.query<Row>(
      `SELECT * FROM ue_authority_issuance_rules
        WHERE organization_id = $1 AND domain = $2 AND operation = $3 AND status = 'active'`,
      [organizationId, domain, operation],
    )
  ).rows
  // The unique partial index makes more than one impossible; treat it as corruption, not a tie-break.
  if (rows.length !== 1) return null
  return mapRule(rows[0])
}

export async function loadIssuanceApproval(
  exec: SqlExecutor,
  organizationId: string,
  requestId: string,
): Promise<{ status: IssuanceApproval['status']; approvingLines: string[]; subjectType: string; subjectId: string } | null> {
  if (!isUuid(organizationId) || !isUuid(requestId)) return null
  const req = (
    await exec.query<Row>(`SELECT status, subject_type, subject_id FROM ue_authority_approval_requests WHERE organization_id = $1 AND id = $2`, [organizationId, requestId])
  ).rows[0]
  if (!req) return null
  const lines = (
    await exec.query<Row>(
      `SELECT DISTINCT authority_line_user_id FROM ue_authority_approval_decisions
        WHERE organization_id = $1 AND approval_request_id = $2 AND decision = 'approved'`,
      [organizationId, requestId],
    )
  ).rows
  return {
    status: req.status as IssuanceApproval['status'],
    approvingLines: lines.map((l) => String(l.authority_line_user_id)),
    subjectType: String(req.subject_type),
    subjectId: String(req.subject_id),
  }
}

/** The holder's currently stored live mandates (used for segregation-of-duties at grant time). */
export async function loadHolderMandates(exec: SqlExecutor, organizationId: string, holderUserId: string): Promise<Mandate[]> {
  return (
    await exec.query<Row>(
      `SELECT m.*, (SELECT a.accepted_at FROM ue_authority_acceptances a
                     WHERE a.organization_id = m.organization_id AND a.instrument_type = 'mandate' AND a.instrument_id = m.id) AS accepted_at
         FROM ue_authority_mandates m
        WHERE m.organization_id = $1 AND m.principal_user_id = $2 AND m.status = 'active' AND m.revoked_at IS NULL`,
      [organizationId, holderUserId],
    )
  ).rows.map(mapMandate)
}
