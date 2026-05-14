/**
 * Build orchestrator — composes the full IGG read-model from an adapter.
 */
import type { DecisionNode } from '@nzila/platform-decision-graph'
import type { EntityEdge, EntityNode } from '@nzila/platform-entity-graph'
import type { InstitutionalGovernanceSourceAdapter } from '../adapters/source-adapter'
import {
  mapCbaRatificationDecision,
  mapMotionDecision,
  mapProtocolAmendmentDecision,
  mapReservedMatterVoteDecision,
} from '../decisions/mapper'
import {
  resolveDelegationChains,
  type DelegationEdgeInput,
  type DelegationResolution,
} from '../delegation/resolver'
import { projectAffiliationEdges } from './affiliations'
import {
  projectOrganizationHierarchyEdges,
  projectOrganizationNodes,
} from './organizations'
import { projectRepresentationEdges } from './representation'
import {
  projectDelegationEdges,
  projectVotingEligibilityEdges,
} from './voting'

export interface GovernanceGraphProjection {
  readonly nodes: readonly EntityNode[]
  readonly edges: readonly EntityEdge[]
  readonly decisions: readonly DecisionNode[]
  readonly delegationResolutions: readonly DelegationResolution[]
  readonly stats: {
    readonly organizationCount: number
    readonly hierarchyEdgeCount: number
    readonly affiliationEdgeCount: number
    readonly eligibilityEdgeCount: number
    readonly delegationEdgeCount: number
    readonly representationEdgeCount: number
    readonly decisionCount: number
  }
}

export async function buildGovernanceGraphProjection(
  adapter: InstitutionalGovernanceSourceAdapter,
): Promise<GovernanceGraphProjection> {
  const [
    organizations,
    memberships,
    eligibility,
    protocols,
    reservedMatterVotes,
    motions,
    negotiations,
  ] = await Promise.all([
    adapter.listOrganizations(),
    adapter.listCongressMemberships(),
    adapter.listVotingEligibility(),
    adapter.listRepresentationProtocols(),
    adapter.listReservedMatterVotes(),
    adapter.listMotions(),
    adapter.listNegotiations(),
  ])

  const orgNodes = projectOrganizationNodes(organizations)
  const hierarchyEdges = projectOrganizationHierarchyEdges(organizations)
  const affiliationEdges = projectAffiliationEdges(memberships)
  const eligibilityEdges = projectVotingEligibilityEdges(eligibility)
  const delegationEdges = projectDelegationEdges(eligibility)
  const representationEdges = projectRepresentationEdges(protocols)

  const delegationInput: readonly DelegationEdgeInput[] = eligibility
    .filter((row) => row.delegatedToEntityId)
    .map((row) => ({
      fromEntityId: row.voterEntityId,
      toEntityId: row.delegatedToEntityId!,
      votingWeight: row.votingWeight,
      votingSessionId: row.votingSessionId,
    }))
  const delegationResolutions = resolveDelegationChains(delegationInput)

  const decisions: DecisionNode[] = []
  for (const row of motions) decisions.push(mapMotionDecision(row))
  for (const row of reservedMatterVotes) decisions.push(mapReservedMatterVoteDecision(row))
  for (const row of negotiations) {
    const d = mapCbaRatificationDecision(row)
    if (d) decisions.push(d)
  }
  for (const row of protocols) decisions.push(mapProtocolAmendmentDecision(row))

  return {
    nodes: orgNodes,
    edges: [
      ...hierarchyEdges,
      ...affiliationEdges,
      ...eligibilityEdges,
      ...delegationEdges,
      ...representationEdges,
    ],
    decisions,
    delegationResolutions,
    stats: {
      organizationCount: orgNodes.length,
      hierarchyEdgeCount: hierarchyEdges.length,
      affiliationEdgeCount: affiliationEdges.length,
      eligibilityEdgeCount: eligibilityEdges.length,
      delegationEdgeCount: delegationEdges.length,
      representationEdgeCount: representationEdges.length,
      decisionCount: decisions.length,
    },
  }
}
