/**
 * Voting eligibility & delegation projection.
 *
 * - eligibility rows → eligible_to_vote_in edges
 * - rows with delegatedToEntityId → delegates_to edges
 *
 * Note: Cycle detection and chain resolution is in `delegation/resolver.ts`.
 * This projector emits flat edges only.
 */
import type { EntityEdge } from '@nzila/platform-entity-graph'
import type { VotingEligibilitySource } from '../adapters/source-adapter.js'
import { normalizeLifecycleStatus } from '../lifecycle/normalize.js'
import {
  IggEntityKinds,
  IggRelationshipKinds,
  substrateRelationshipFor,
  substrateTypeFor,
} from '../ontology/kinds.js'

const VOTER_TYPE_KIND = {
  organization: IggEntityKinds.UNION,
  member: IggEntityKinds.MEMBER,
  committee: IggEntityKinds.COMMITTEE,
} as const

export function projectVotingEligibilityEdges(
  rows: readonly VotingEligibilitySource[],
): readonly EntityEdge[] {
  return rows.map((row) => {
    const lifecycle = normalizeLifecycleStatus(row.status)
    const voterKind = VOTER_TYPE_KIND[row.voterEntityType]
    return {
      id: `igg:eligible_to_vote_in:${row.id}`,
      sourceEntityType: substrateTypeFor(voterKind),
      sourceEntityId: row.voterEntityId,
      // Voting sessions are projected as Decision-flavoured nodes.
      targetEntityType: substrateTypeFor(IggEntityKinds.DECISION),
      targetEntityId: row.votingSessionId,
      relationshipType: substrateRelationshipFor(
        IggRelationshipKinds.ELIGIBLE_TO_VOTE_IN,
      ),
      metadata: {
        iggKind: IggRelationshipKinds.ELIGIBLE_TO_VOTE_IN,
        sourceRecordId: row.id,
        votingWeight: row.votingWeight,
        voterEntityType: row.voterEntityType,
        lifecycleStatus: lifecycle.status,
        originalStatus: lifecycle.originalStatus,
        ...(lifecycle.warning ? { lifecycleWarning: lifecycle.warning } : {}),
        ...(row.metadata ?? {}),
      },
    }
  })
}

export function projectDelegationEdges(
  rows: readonly VotingEligibilitySource[],
): readonly EntityEdge[] {
  const edges: EntityEdge[] = []
  for (const row of rows) {
    if (!row.delegatedToEntityId || !row.delegatedToEntityType) continue
    const fromKind = VOTER_TYPE_KIND[row.voterEntityType]
    const toKind = VOTER_TYPE_KIND[row.delegatedToEntityType]
    edges.push({
      id: `igg:delegates_to:${row.id}`,
      sourceEntityType: substrateTypeFor(fromKind),
      sourceEntityId: row.voterEntityId,
      targetEntityType: substrateTypeFor(toKind),
      targetEntityId: row.delegatedToEntityId,
      relationshipType: substrateRelationshipFor(
        IggRelationshipKinds.DELEGATES_TO,
      ),
      metadata: {
        iggKind: IggRelationshipKinds.DELEGATES_TO,
        sourceRecordId: row.id,
        votingSessionId: row.votingSessionId,
        votingWeight: row.votingWeight,
        ...(row.metadata ?? {}),
      },
    })
  }
  return edges
}
