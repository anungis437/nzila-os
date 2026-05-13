/**
 * Source adapter — interface only.
 *
 * Concrete implementations belong outside this package (e.g. inside the
 * union-eyes app) so this projection layer never imports Drizzle, postgres,
 * or any DB driver. Source record shapes mirror the *minimum* fields needed
 * for projection; they are intentionally decoupled from the on-disk schema
 * so this package can be unit-tested in isolation.
 */

// ── Organizations ───────────────────────────────────────────────────────────

export interface OrganizationSource {
  readonly id: string
  readonly tenantId: string
  readonly name: string
  readonly slug: string
  readonly organizationType:
    | 'platform'
    | 'congress'
    | 'federation'
    | 'union'
    | 'local'
    | 'region'
    | 'district'
  readonly parentId: string | null
  readonly hierarchyPath: readonly string[]
  readonly hierarchyLevel: number
  readonly status: string
  readonly metadata?: Record<string, unknown>
}

// ── Congress memberships ────────────────────────────────────────────────────

export interface CongressMembershipSource {
  readonly id: string
  readonly tenantId: string
  readonly congressId: string
  readonly memberOrganizationId: string
  readonly status: string
  readonly validFrom: string | null
  readonly validTo: string | null
  readonly metadata?: Record<string, unknown>
}

// ── Voting eligibility & delegation ─────────────────────────────────────────

export interface VotingEligibilitySource {
  readonly id: string
  readonly tenantId: string
  readonly votingSessionId: string
  readonly voterEntityType: 'organization' | 'member' | 'committee'
  readonly voterEntityId: string
  readonly votingWeight: number
  readonly status: string
  readonly delegatedToEntityId?: string | null
  readonly delegatedToEntityType?: 'organization' | 'member' | 'committee' | null
  readonly metadata?: Record<string, unknown>
}

// ── Representation protocols ────────────────────────────────────────────────

export interface RepresentationProtocolSource {
  readonly id: string
  readonly tenantId: string
  readonly representativeEntityType: string
  readonly representativeEntityId: string
  readonly representedEntityType: string
  readonly representedEntityId: string
  readonly protocolVersion: string
  readonly status: string
  readonly validFrom: string | null
  readonly validTo: string | null
  readonly metadata?: Record<string, unknown>
}

// ── Reserved-matter votes & motions ─────────────────────────────────────────

export interface ReservedMatterVoteSource {
  readonly id: string
  readonly tenantId: string
  readonly reservedMatterId: string
  readonly classBHolderEntityId: string
  readonly outcome: string
  readonly castAt: string
  readonly evidenceRefs?: readonly string[]
  readonly policyRefs?: readonly string[]
  readonly reasoning?: string
  readonly metadata?: Record<string, unknown>
}

export interface MotionSource {
  readonly id: string
  readonly tenantId: string
  readonly committeeId: string | null
  readonly title: string
  readonly outcome: string
  readonly decidedAt: string | null
  readonly proposerEntityId: string | null
  readonly evidenceRefs?: readonly string[]
  readonly policyRefs?: readonly string[]
  readonly reasoning?: string
  readonly metadata?: Record<string, unknown>
}

// ── Negotiations ────────────────────────────────────────────────────────────

export interface NegotiationSource {
  readonly id: string
  readonly tenantId: string
  readonly bargainingUnitId: string
  readonly employerOrganizationId: string
  readonly status: string
  readonly cbaRatifiedAt: string | null
  readonly evidenceRefs?: readonly string[]
  readonly policyRefs?: readonly string[]
  readonly reasoning?: string
  readonly metadata?: Record<string, unknown>
}

// ── Adapter interface ───────────────────────────────────────────────────────

export interface InstitutionalGovernanceSourceAdapter {
  listOrganizations(): Promise<readonly OrganizationSource[]>
  listCongressMemberships(): Promise<readonly CongressMembershipSource[]>
  listVotingEligibility(): Promise<readonly VotingEligibilitySource[]>
  listRepresentationProtocols(): Promise<readonly RepresentationProtocolSource[]>
  listReservedMatterVotes(): Promise<readonly ReservedMatterVoteSource[]>
  listMotions(): Promise<readonly MotionSource[]>
  listNegotiations(): Promise<readonly NegotiationSource[]>
}
