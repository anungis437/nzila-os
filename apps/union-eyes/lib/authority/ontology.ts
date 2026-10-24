/**
 * Union Eyes — Institutional Authority Kernel: ontology and decision contract.
 *
 * Phase 1 of UE-INSTITUTIONAL-CONVERGENCE-2.1. This module is pure: no I/O, no
 * clock, no ambient identity. Every input is an explicit fact; every output is
 * an auditable Decision.
 *
 * Doctrine encoded here (and enforced by ./kernel.ts and ./policies/*):
 *  - Authority is the conjunction of: a verified principal, a live membership in
 *    the resource's organization, a functional capacity (ELIGIBILITY ONLY), and
 *    a resource-specific source of authority (relationship, mandate, delegation,
 *    consent or emergency grant).
 *  - A role label, numeric role hierarchy, platform-administration status or SaaS
 *    entitlement is never a source of authority. Roles reach the kernel only as
 *    `Capacity` values, which gate eligibility and never grant access.
 *  - Missing or contradictory authoritative facts fail closed.
 *  - Time-bounded: every mandate expires; revocation is immediate.
 *  - Recusal and adversity are absolute against every source of authority.
 */

export type Uuid = string

/**
 * Functional capacity. Derived from stored role via an EXPLICIT table
 * (see ./capacity.ts), never from numeric hierarchy. A capacity makes a
 * principal eligible to hold a kind of authority; it confers none.
 */
export type Capacity =
  | 'member'
  | 'steward'
  | 'chief_steward'
  | 'officer'
  | 'executive'
  | 'financial_officer'
  | 'trustee'
  | 'auditor'
  | 'governance_reviewer'
  | 'privacy_officer'

export type MembershipStatus = 'active' | 'pending' | 'suspended' | 'inactive' | 'revoked'

export interface Principal {
  userId: Uuid
  /** True only when the session was authenticated by the identity provider. */
  authenticated: boolean
  /**
   * Informational. Platform staff status NEVER contributes to a decision; it is
   * carried so decisions can record that it was deliberately ignored.
   */
  platformStaff?: boolean
}

export interface Membership {
  userId: Uuid
  organizationId: Uuid
  status: MembershipStatus
  capacities: readonly Capacity[]
  /** Last verification of the membership row, for staleness audit. */
  verifiedAt?: Date | null
}

export type ResourceType =
  | 'case'
  | 'financial_transaction'
  | 'member_financial_record'
  | 'approval_request'
  | 'governance_review'
  | 'workaid_matter'

export interface ResourceRef {
  type: ResourceType
  id: Uuid
  organizationId: Uuid
}

// ── Sources of authority ────────────────────────────────────────────────────

export type MandateKind =
  | 'supervisory'
  | 'financial'
  | 'governance_review'
  | 'executive_office'
  | 'emergency_access'

export interface MandateScope {
  unitIds?: readonly Uuid[]
  territoryIds?: readonly Uuid[]
  /** Exact resource ids (e.g. a single review or emergency-access case). */
  resourceIds?: readonly Uuid[]
  accountIds?: readonly Uuid[]
  /** Highest information classification the mandate may reach. */
  classificationCeiling?: 'standard' | 'confidential'
}

export interface Mandate {
  id: Uuid
  organizationId: Uuid
  principalUserId: Uuid
  kind: MandateKind
  /** Action-specific powers, e.g. 'read', 'assign', 'approve', 'monitor'. */
  powers: readonly string[]
  scope: MandateScope
  /** Money authority, in minor units (integer), single currency. */
  monetaryLimitMinor?: number | null
  currency?: string | null
  /** The constitutional/bylaw/resolution/appointment instrument. Required. */
  sourceInstrument: string
  grantedBy: Uuid
  /** Independent approver. Required for emergency access. */
  approvedBy?: Uuid | null
  justification?: string | null
  status: 'active' | 'revoked' | 'expired' | 'suspended'
  effectiveAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
  /** The issuance rule required the holder to accept before the mandate takes effect. */
  requiresAcceptance?: boolean
  acceptedAt?: Date | null
}

export type RelationKind = 'creator' | 'owner' | 'assignee' | 'collaborator' | 'represented_member'

export interface ResourceRelationship {
  id: Uuid
  organizationId: Uuid
  principalUserId: Uuid
  resource: ResourceRef
  relation: RelationKind
  /** Explicit collaborator permissions; derived relations use the policy table. */
  permissions: readonly string[]
  /** Explicit grant that reaches privileged matters. Never implied. */
  privilegedAccess: boolean
  origin: 'derived' | 'explicit'
  grantedBy: Uuid | null
  status: 'active' | 'revoked' | 'expired'
  effectiveAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
}

export interface Delegation {
  id: Uuid
  organizationId: Uuid
  delegatorUserId: Uuid
  delegateUserId: Uuid
  /** The office whose authority is delegated. Must match a live executive_office mandate. */
  office: string
  /** Only these actions may be exercised; never open-ended. */
  actions: readonly string[]
  resourceTypes: readonly ResourceType[]
  status: 'active' | 'revoked' | 'expired'
  effectiveAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
  requiresAcceptance?: boolean
  acceptedAt?: Date | null
}

export interface Recusal {
  id: Uuid
  organizationId: Uuid
  principalUserId: Uuid
  resource: ResourceRef
  reason: string
  declaredAt: Date
  liftedAt: Date | null
  liftedBy: Uuid | null
}

export type DisclosureDirection = 'union_to_workaid' | 'workaid_to_union'

export interface DisclosureConsent {
  id: Uuid
  organizationId: Uuid
  memberUserId: Uuid
  matterId: Uuid
  direction: DisclosureDirection
  /** Who authored the record. A union-authored record can never open counsel material. */
  issuer: 'member' | 'counsel'
  categories: readonly string[]
  /** Named recipient principal for workaid_to_union disclosures. */
  recipientUserId?: Uuid | null
  purpose: string
  grantedAt: Date
  expiresAt: Date | null
  revokedAt: Date | null
}

export interface AuthorityFacts {
  principal: Principal
  memberships: readonly Membership[]
  mandates: readonly Mandate[]
  relationships: readonly ResourceRelationship[]
  delegations: readonly Delegation[]
  recusals: readonly Recusal[]
  consents: readonly DisclosureConsent[]
}

// ── Resource facts ─────────────────────────────────────────────────────────

export type Classification = 'standard' | 'privileged'

export interface CaseFacts {
  kind: 'case'
  id: Uuid
  organizationId: Uuid
  unitId?: Uuid | null
  territoryId?: Uuid | null
  classification: Classification
  /**
   * Restricted within the union (grievances.is_confidential). Distinct from privilege: it does not
   * lock out the people with a relationship to the case, but a supervisory mandate must carry a
   * `confidential` classification ceiling to reach it.
   */
  confidential?: boolean
  /** Held by external counsel (WorkAid). The union has no authority over content. */
  counselControlled: boolean
  /** Respondents / persons the matter is about. Absolutely conflicted. */
  adverseUserIds: readonly Uuid[]
  /**
   * Loader-verified: the requested document (req.documentId) was uploaded by the requesting principal,
   * is linked to exactly this case and is not privileged. Absent unless the loader proved all three.
   */
  requestedDocumentIsPrincipalsOwnSubmission?: boolean
}

export interface FinancialTransactionFacts {
  kind: 'financial_transaction'
  id: Uuid
  organizationId: Uuid
  accountId: Uuid
  amountMinor: number
  currency: string
  state: 'draft' | 'prepared' | 'approved' | 'executed' | 'reconciled' | 'void'
  preparedBy: Uuid | null
  approvals: readonly { userId: Uuid; at: Date }[]
  requiredApprovals: number
  executedBy: Uuid | null
  reconciledBy: Uuid | null
  adverseUserIds: readonly Uuid[]
}

export interface MemberFinancialRecordFacts {
  kind: 'member_financial_record'
  id: Uuid
  organizationId: Uuid
  subjectUserId: Uuid
  /** Ledger account the record belongs to; scopes officer visibility. */
  accountId?: Uuid | null
}

export interface ApprovalRequestFacts {
  kind: 'approval_request'
  id: Uuid
  organizationId: Uuid
  subjectType: string
  subjectId: Uuid
  proposedBy: Uuid
  /** Author of the thing being approved, when distinct from the proposer. */
  subjectAuthorId?: Uuid | null
  requiredApprovals: number
  status: 'open' | 'satisfied' | 'rejected' | 'withdrawn'
  /** Empty = role/capacity-gated only; non-empty = named approvers only. */
  namedApproverIds: readonly Uuid[]
  eligibleCapacities: readonly Capacity[]
  decisions: readonly {
    approverUserId: Uuid
    /** One person = one vote: a delegate counts under their delegator's line. */
    authorityLineUserId: Uuid
    decision: 'approved' | 'rejected'
  }[]
  adverseUserIds: readonly Uuid[]
  riskClass: 'low' | 'medium' | 'high' | 'critical'
}

export interface GovernanceReviewFacts {
  kind: 'governance_review'
  id: Uuid
  organizationId: Uuid
  adverseUserIds: readonly Uuid[]
  complainantUserId?: Uuid | null
  classification: Classification
  /** Owner of an action under verification; cannot verify their own remediation. */
  remediationOwnerUserId?: Uuid | null
}

export interface WorkAidMatterFacts {
  kind: 'workaid_matter'
  id: Uuid
  organizationId: Uuid
  memberUserId: Uuid
  /** The union-side case this matter was referred from. */
  caseId: Uuid
  /** Always true in the union's information boundary; carried so the contract is explicit. */
  counselControlled: true
}

export type ResourceFacts =
  | CaseFacts
  | FinancialTransactionFacts
  | MemberFinancialRecordFacts
  | ApprovalRequestFacts
  | GovernanceReviewFacts
  | WorkAidMatterFacts

// ── Actions ────────────────────────────────────────────────────────────────

export const ACTIONS = [
  'case:read',
  'case:read_own_submission',
  'case:read_internal',
  'case:read_third_party_restricted',
  'case:read_privileged',
  'case:comment',
  'case:write',
  'case:transition',
  'case:assign',
  'finance:view',
  'finance:prepare',
  'finance:approve',
  'finance:execute',
  'finance:reconcile',
  'finance:audit',
  'governance:approve',
  'review:monitor',
  'review:access_evidence',
  'review:issue_finding',
  'review:request_corrective_action',
  'review:enforce',
  'review:verify_remediation',
  'workaid:refer',
  'workaid:receive_disclosure',
  'workaid:read_counsel_material',
] as const

export type Action = (typeof ACTIONS)[number]

export interface AuthorityRequest {
  principalUserId: Uuid
  /** The active organization context. Must equal the resource's organization. */
  organizationId: Uuid
  action: Action
  resource: ResourceRef
  /** When acting under a delegation, its id. The delegation is validated, never trusted. */
  delegationId?: Uuid | null
  /** For case:read_own_submission: the document asked for. Never trusted; the loader verifies authorship. */
  documentId?: Uuid | null
  /** For finance:*, the amount the action concerns, in minor units. */
  amountMinor?: number
  currency?: string
  /** For workaid:*, the categories of information the action would move. */
  categories?: readonly string[]
  /** For workaid:receive_disclosure, the specific disclosure (consent) record id. */
  disclosureId?: Uuid | null
}

// ── Decision contract ──────────────────────────────────────────────────────

export type ReasonCode =
  // identity & tenancy
  | 'PRINCIPAL_NOT_AUTHENTICATED'
  | 'PRINCIPAL_MISMATCH'
  | 'FOREIGN_TENANT'
  | 'NOT_AN_ACTIVE_MEMBER'
  | 'RESOURCE_FACTS_MISSING'
  | 'RESOURCE_FACTS_MISMATCH'
  | 'FACTS_CONTRADICTORY'
  // sources
  | 'NO_SOURCE_OF_AUTHORITY'
  | 'CAPACITY_NOT_ELIGIBLE'
  | 'ACTION_NOT_COVERED'
  | 'OUT_OF_SCOPE'
  | 'INSTRUMENT_INVALID'
  | 'INSTRUMENT_EXPIRED_OR_REVOKED'
  | 'NOT_ACCEPTED'
  | 'NO_ACTIVE_ISSUANCE_RULE'
  | 'EXCEEDS_RULE_CEILING'
  | 'APPROVAL_NOT_SATISFIED'
  // restrictions
  | 'RECUSED'
  | 'ADVERSE_PARTY'
  | 'PRIVILEGED_MATTER'
  | 'COUNSEL_CONTROLLED'
  | 'CLASSIFICATION_EXCEEDS_MANDATE'
  // segregation / process
  | 'SELF_APPROVAL'
  | 'SEGREGATION_OF_DUTIES'
  | 'ALREADY_DECIDED'
  | 'STATE_NOT_ELIGIBLE'
  | 'NOT_ELIGIBLE_APPROVER'
  | 'AMOUNT_EXCEEDS_LIMIT'
  | 'CURRENCY_MISMATCH'
  | 'INVALID_AMOUNT'
  | 'DELEGATION_INVALID'
  | 'CONSENT_REQUIRED'
  | 'CONSENT_SCOPE_EXCEEDED'
  | 'DISCLOSURE_NOT_ISSUED_BY_COUNSEL'
  // allow
  | 'ALLOWED_BY_RELATIONSHIP'
  | 'ALLOWED_BY_MANDATE'
  | 'ALLOWED_BY_DELEGATION'
  | 'ALLOWED_BY_EMERGENCY_GRANT'
  | 'ALLOWED_BY_CONSENT'
  | 'ALLOWED_AS_SUBJECT'
  | 'ALLOWED_BY_ISSUANCE_RULE'

export interface Reason {
  code: ReasonCode
  detail?: string
  /** Id of the instrument/row the reason concerns, for audit drill-down. */
  ref?: Uuid
}

export interface AuthoritySource {
  kind: 'relationship' | 'mandate' | 'delegation' | 'emergency_grant' | 'consent' | 'subject'
  id: Uuid
  /** Human-citable instrument (bylaw clause, resolution, consent record, ...). */
  instrument: string
}

export type Obligation =
  | 'audit_required'
  | 'emergency_review_required'
  | 'redact_internal_notes'
  | 'read_only'
  | 'acknowledgement_expected'

export interface DecisionScope {
  /** For case reads: which fields the principal may see. */
  visibility?: 'member_visible' | 'internal'
  categories?: readonly string[]
  maxAmountMinor?: number
}

export interface Decision {
  effect: 'allow' | 'deny'
  action: Action
  principalUserId: Uuid
  organizationId: Uuid
  resource: ResourceRef
  /** Present only on allow. */
  scope: DecisionScope
  authority: readonly AuthoritySource[]
  /** Always present: deny reasons, or the reasons an allow was reached. */
  reasons: readonly Reason[]
  obligations: readonly Obligation[]
  /** Counted-as identity for one-person-one-vote (delegator when delegated). */
  authorityLineUserId: Uuid
  evaluatedAt: string
  policyVersion: string
}

export const POLICY_VERSION = 'ue-authority-kernel/1.0.0'

export const isAllow = (d: Decision): boolean => d.effect === 'allow'
