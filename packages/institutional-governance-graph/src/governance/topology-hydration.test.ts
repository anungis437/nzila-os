import type { DecisionNode } from '@nzila/platform-decision-graph'
import type { EntityEdge } from '@nzila/platform-entity-graph'
import { describe, expect, it } from 'vitest'
import {
  hydrateGovernanceTopologyInfrastructure,
  normalizeGovernanceRelationships,
} from './topology-hydration'

function edge(
  id: string,
  source: string,
  target: string,
  iggKind: string,
  metadata?: Record<string, unknown>,
): EntityEdge {
  return {
    id,
    sourceEntityType: 'Organization',
    sourceEntityId: source,
    targetEntityType: 'Organization',
    targetEntityId: target,
    relationshipType: 'REFERENCES' as EntityEdge['relationshipType'],
    metadata: {
      iggKind,
      ...(metadata ?? {}),
    },
  }
}

function decision(
  id: string,
  entityId: string,
  occurredAt: string,
): DecisionNode {
  return {
    id,
    tenantId: 'tenant-1',
    decisionType: 'policy_evaluation',
    status: 'executed',
    actorType: 'workflow',
    actorId: 'system',
    entityType: 'Decision',
    entityId,
    summary: id,
    outcome: {
      iggCategory: 'motion_outcome',
      iggEventKind: 'igg:motion_outcome',
    },
    policyRefs: [],
    evidenceRefs: [],
    knowledgeRefs: [],
    createdAt: occurredAt,
    executedAt: occurredAt,
  }
}

describe('Workstream H — topology hydration', () => {
  it('normalizes base IGG relationships into institutional topology relationships', () => {
    const relationships = normalizeGovernanceRelationships({
      edges: [
        edge('e-aff', 'local-1', 'federation-1', 'igg:affiliated_with'),
        edge('e-deleg', 'delegate-a', 'delegate-b', 'igg:delegates_to'),
        edge('e-succ', 'committee-v2', 'committee-v1', 'igg:supersedes'),
      ],
    })

    expect(relationships.map((r) => r.kind)).toEqual([
      'AFFILIATED_WITH',
      'DELEGATES_TO',
      'SUCCESSOR_TO',
    ])
  })

  it('filters protected topology metadata and hydrates explainable topology views', () => {
    const hydrated = hydrateGovernanceTopologyInfrastructure({
      edges: [
        edge('e1', 'local-1', 'federation-1', 'igg:affiliated_with', {
          occurredAt: '2025-01-01T00:00:00.000Z',
          evidenceRefs: ['ev-aff-1'],
        }),
        edge('e2', 'rep-1', 'local-1', 'igg:represents', {
          occurredAt: '2025-02-01T00:00:00.000Z',
          evidenceRefs: ['ev-rep-1'],
        }),
        edge('e3', 'committee-v2', 'committee-v1', 'igg:supersedes', {
          occurredAt: '2025-03-01T00:00:00.000Z',
        }),
        edge('e-protected', 'x', 'y', 'igg:represents', {
          class_b_lock: true,
        }),
      ],
      decisions: [decision('d-1', 'local-1', '2025-04-01T00:00:00.000Z')],
      topologySources: {
        committeeStructures: [],
        delegationChains: [],
        representationAssignments: [],
        continuityRecords: [
          {
            id: 'cont-1',
            tenantId: 'tenant-1',
            entityId: 'local-1',
            continuityType: 'handoff',
            status: 'active',
            occurredAt: '2025-05-01T00:00:00.000Z',
            resolvedAt: null,
          },
        ],
        proceduralEscalations: [],
        governanceCenterSources: [],
      },
    })

    expect(hydrated.stats.redactedProtectedRelationships).toBe(0)
    expect(hydrated.stats.normalizedRelationshipCount).toBe(3)
    expect(hydrated.stats.lineageChainCount).toBeGreaterThan(0)
    expect(hydrated.stats.chronologyEntryCount).toBeGreaterThan(0)
    expect(hydrated.stats.continuityProjectionCount).toBeGreaterThan(0)
    expect(hydrated.explainability.length).toBe(hydrated.relationships.length)
    expect(hydrated.topology.representationHierarchies.length).toBe(1)
  })
})
