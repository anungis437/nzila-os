/**
 * Workstream H — Topology source adapter completion.
 *
 * Additive read-only extension over the core InstitutionalGovernanceSourceAdapter.
 * Optional methods allow callers to hydrate richer institutional topology
 * without forcing storage/model rewrites in existing adapters.
 */
import type {
  InstitutionalGovernanceSourceAdapter,
  MotionSource,
  NegotiationSource,
  OrganizationSource,
  RepresentationProtocolSource,
  ReservedMatterVoteSource,
  VotingEligibilitySource,
} from './source-adapter'

export interface CommitteeStructureSource {
  readonly id: string
  readonly tenantId: string
  readonly committeeEntityId: string
  readonly parentCommitteeEntityId: string | null
  readonly governedByEntityId: string | null
  readonly status: string
  readonly effectiveFrom: string | null
  readonly effectiveTo: string | null
  readonly metadata?: Record<string, unknown>
}

export interface DelegationChainSource {
  readonly id: string
  readonly tenantId: string
  readonly fromEntityId: string
  readonly toEntityId: string
  readonly chainType: 'representation' | 'voting' | 'procedural' | 'other'
  readonly status: string
  readonly occurredAt: string | null
  readonly metadata?: Record<string, unknown>
}

export interface RepresentationAssignmentSource {
  readonly id: string
  readonly tenantId: string
  readonly representativeEntityId: string
  readonly representedEntityId: string
  readonly assignmentType: 'steward' | 'delegate' | 'officer' | 'member' | 'other'
  readonly status: string
  readonly validFrom: string | null
  readonly validTo: string | null
  readonly metadata?: Record<string, unknown>
}

export interface ContinuityRecordSource {
  readonly id: string
  readonly tenantId: string
  readonly entityId: string
  readonly continuityType:
    | 'succession'
    | 'handoff'
    | 'epoch'
    | 'affiliation'
    | 'representation'
    | 'escalation'
    | 'other'
  readonly status: string
  readonly occurredAt: string | null
  readonly resolvedAt: string | null
  readonly metadata?: Record<string, unknown>
}

export interface InstitutionalMemoryReferenceSource {
  readonly id: string
  readonly tenantId: string
  readonly entityId: string
  readonly referenceId: string
  readonly referenceType: 'knowledge' | 'evidence' | 'policy' | 'archive' | 'other'
  readonly occurredAt: string | null
  readonly metadata?: Record<string, unknown>
}

export interface ProceduralEscalationSource {
  readonly id: string
  readonly tenantId: string
  readonly fromEntityId: string
  readonly toEntityId: string
  readonly status: string
  readonly reason: string | null
  readonly occurredAt: string | null
  readonly resolvedAt: string | null
  readonly metadata?: Record<string, unknown>
}

export interface GovernanceCenterSource {
  readonly id: string
  readonly tenantId: string
  readonly sourceEntityId: string
  readonly targetEntityId: string
  readonly sourceType: 'operations' | 'compliance' | 'security' | 'continuity' | 'other'
  readonly status: string
  readonly occurredAt: string | null
  readonly metadata?: Record<string, unknown>
}

export interface InstitutionalTopologySourceAdapter
  extends InstitutionalGovernanceSourceAdapter {
  listCommitteeStructures?(): Promise<readonly CommitteeStructureSource[]>
  listDelegationChains?(): Promise<readonly DelegationChainSource[]>
  listRepresentationAssignments?(): Promise<readonly RepresentationAssignmentSource[]>
  listContinuityRecords?(): Promise<readonly ContinuityRecordSource[]>
  listInstitutionalMemoryReferences?(): Promise<readonly InstitutionalMemoryReferenceSource[]>
  listProceduralEscalations?(): Promise<readonly ProceduralEscalationSource[]>
  listGovernanceCenterSources?(): Promise<readonly GovernanceCenterSource[]>
}

export interface HydratedTopologySources {
  readonly organizations: readonly OrganizationSource[]
  readonly votingEligibility: readonly VotingEligibilitySource[]
  readonly representationProtocols: readonly RepresentationProtocolSource[]
  readonly reservedMatterVotes: readonly ReservedMatterVoteSource[]
  readonly motions: readonly MotionSource[]
  readonly negotiations: readonly NegotiationSource[]
  readonly committeeStructures: readonly CommitteeStructureSource[]
  readonly delegationChains: readonly DelegationChainSource[]
  readonly representationAssignments: readonly RepresentationAssignmentSource[]
  readonly continuityRecords: readonly ContinuityRecordSource[]
  readonly institutionalMemoryReferences: readonly InstitutionalMemoryReferenceSource[]
  readonly proceduralEscalations: readonly ProceduralEscalationSource[]
  readonly governanceCenterSources: readonly GovernanceCenterSource[]
  readonly stats: {
    readonly sourceCount: number
    readonly relationshipLikeRecordCount: number
  }
}

/**
 * Read all known topology sources from a base adapter. Optional source methods
 * default to empty arrays to keep adoption incremental.
 */
export async function hydrateTopologySources(
  adapter: InstitutionalTopologySourceAdapter,
): Promise<HydratedTopologySources> {
  const [
    organizations,
    votingEligibility,
    representationProtocols,
    reservedMatterVotes,
    motions,
    negotiations,
    committeeStructures,
    delegationChains,
    representationAssignments,
    continuityRecords,
    institutionalMemoryReferences,
    proceduralEscalations,
    governanceCenterSources,
  ] = await Promise.all([
    adapter.listOrganizations(),
    adapter.listVotingEligibility(),
    adapter.listRepresentationProtocols(),
    adapter.listReservedMatterVotes(),
    adapter.listMotions(),
    adapter.listNegotiations(),
    adapter.listCommitteeStructures?.() ?? [],
    adapter.listDelegationChains?.() ?? [],
    adapter.listRepresentationAssignments?.() ?? [],
    adapter.listContinuityRecords?.() ?? [],
    adapter.listInstitutionalMemoryReferences?.() ?? [],
    adapter.listProceduralEscalations?.() ?? [],
    adapter.listGovernanceCenterSources?.() ?? [],
  ])

  const sourceCount = 13
  const relationshipLikeRecordCount =
    votingEligibility.length +
    representationProtocols.length +
    committeeStructures.length +
    delegationChains.length +
    representationAssignments.length +
    continuityRecords.length +
    institutionalMemoryReferences.length +
    proceduralEscalations.length +
    governanceCenterSources.length

  return {
    organizations,
    votingEligibility,
    representationProtocols,
    reservedMatterVotes,
    motions,
    negotiations,
    committeeStructures,
    delegationChains,
    representationAssignments,
    continuityRecords,
    institutionalMemoryReferences,
    proceduralEscalations,
    governanceCenterSources,
    stats: {
      sourceCount,
      relationshipLikeRecordCount,
    },
  }
}
