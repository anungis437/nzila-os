/**
 * Phase 4 — Institutional timeline tests.
 *
 * Doctrine reminder: read-only convergence. Tests assert chronology,
 * filtering, and protected-fence enforcement — never optimization,
 * ranking, or behavioural inference.
 */
import type { DecisionNode } from '@nzila/platform-decision-graph'
import type { EntityEdge, EntityNode } from '@nzila/platform-entity-graph'
import { describe, expect, it } from 'vitest'
import {
  IggEntityKinds,
  IggEventKinds,
  IggRelationshipKinds,
} from '../ontology/kinds'
import {
  buildInstitutionalTimeline,
  continuityTimeline,
  governanceEpochTimeline,
  timelineForAffiliation,
  timelineForDecision,
  timelineForOrganization,
  timelineForRepresentation,
} from './timeline'

// ── Fixtures ───────────────────────────────────────────────────────────────

function node(
  id: string,
  iggKind: string,
  extra: Partial<EntityNode> = {},
  metadataExtra: Record<string, unknown> = {},
): EntityNode {
  return {
    entityType: 'Organization',
    entityId: id,
    tenantId: 'tenant-1',
    canonicalName: id,
    status: 'active',
    metadata: { iggKind, ...metadataExtra },
    ...extra,
  }
}

function edge(
  id: string,
  source: string,
  target: string,
  iggKind: string,
  metadataExtra: Record<string, unknown> = {},
  relType: EntityEdge['relationshipType'] = 'PARENT_OF',
): EntityEdge {
  return {
    id,
    sourceEntityType: 'Organization',
    sourceEntityId: source,
    targetEntityType: 'Organization',
    targetEntityId: target,
    relationshipType: relType,
    metadata: { iggKind, ...metadataExtra },
  }
}

function decision(
  id: string,
  entityId: string,
  occurredAt: string,
  category: string,
  eventKind: string = IggEventKinds.MOTION_OUTCOME,
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
    summary: `${category} ${id}`,
    outcome: { iggCategory: category, iggEventKind: eventKind },
    policyRefs: [],
    evidenceRefs: [],
    knowledgeRefs: [],
    createdAt: occurredAt,
    executedAt: occurredAt,
  }
}

// ── buildInstitutionalTimeline ─────────────────────────────────────────────

describe('Phase 4 — buildInstitutionalTimeline', () => {
  it('returns an empty timeline for an empty graph', () => {
    const out = buildInstitutionalTimeline({ nodes: [], edges: [], decisions: [] })
    expect(out).toEqual([])
  })

  it('orders decisions and edge events ascending and tags entry kinds', () => {
    const decisions = [
      decision('d2', 'org-1', '2024-06-01T00:00:00Z', 'motion_outcome'),
      decision('d1', 'org-1', '2024-01-01T00:00:00Z', 'cba_ratification'),
    ]
    const edges = [
      edge('e1', 'union-a', 'fed', IggRelationshipKinds.AFFILIATED_WITH, {
        occurredAt: '2024-03-01T00:00:00Z',
      }),
      edge('e2', 'rep-1', 'org-1', IggRelationshipKinds.REPRESENTS, {
        effectiveAt: '2024-04-01T00:00:00Z',
      }),
    ]
    const out = buildInstitutionalTimeline({ nodes: [], edges, decisions })
    expect(out.map((e) => e.sourceId)).toEqual(['d1', 'e1', 'e2', 'd2'])
    expect(out.map((e) => e.kind)).toEqual([
      'decision',
      'affiliation',
      'representation',
      'decision',
    ])
  })

  it('drops edges that have no derivable timestamp', () => {
    const edges = [
      edge('e-no-ts', 'a', 'b', IggRelationshipKinds.AFFILIATED_WITH),
      edge('e-ts', 'a', 'b', IggRelationshipKinds.AFFILIATED_WITH, {
        occurredAt: '2024-01-01T00:00:00Z',
      }),
    ]
    const out = buildInstitutionalTimeline({ nodes: [], edges, decisions: [] })
    expect(out.map((e) => e.sourceId)).toEqual(['e-ts'])
  })

  it('redacts protected entity / relationship / event kinds from the read surface', () => {
    const nodes = [
      node('classB', IggEntityKinds.CLASS_B_SPECIAL_VOTING_SHARE),
      node('org-1', IggEntityKinds.UNION),
    ]
    const edges = [
      edge('veto-edge', 'classB', 'org-1', IggRelationshipKinds.VETOES, {
        occurredAt: '2024-01-01T00:00:00Z',
      }),
      edge('aff-edge', 'org-1', 'fed', IggRelationshipKinds.AFFILIATED_WITH, {
        occurredAt: '2024-02-01T00:00:00Z',
      }),
    ]
    const decisions = [
      decision('d-veto', 'org-1', '2024-03-01T00:00:00Z', 'class_b_veto'),
      decision('d-cba', 'org-1', '2024-04-01T00:00:00Z', 'cba_ratification'),
    ]
    const out = buildInstitutionalTimeline({ nodes, edges, decisions })
    expect(out.map((e) => e.sourceId)).toEqual(['aff-edge', 'd-cba'])
  })

  it('applies since/until/kinds filtering options', () => {
    const decisions = [
      decision('d1', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision('d2', 'org-1', '2024-06-01T00:00:00Z', 'motion_outcome'),
      decision('d3', 'org-1', '2024-12-01T00:00:00Z', 'motion_outcome'),
    ]
    const out = buildInstitutionalTimeline(
      { nodes: [], edges: [], decisions },
      { since: '2024-05-01T00:00:00Z', until: '2024-11-01T00:00:00Z' },
    )
    expect(out.map((e) => e.sourceId)).toEqual(['d2'])
    const onlyDecisions = buildInstitutionalTimeline(
      { nodes: [], edges: [], decisions },
      { kinds: ['decision'] },
    )
    expect(onlyDecisions.length).toBe(3)
    const onlyAffiliations = buildInstitutionalTimeline(
      { nodes: [], edges: [], decisions },
      { kinds: ['affiliation'] },
    )
    expect(onlyAffiliations).toEqual([])
  })
})

// ── Scoped timelines ───────────────────────────────────────────────────────

describe('Phase 4 — scoped timeline builders', () => {
  it('timelineForOrganization filters to a single anchor', () => {
    const decisions = [
      decision('d1', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision('d2', 'org-2', '2024-02-01T00:00:00Z', 'motion_outcome'),
    ]
    const out = timelineForOrganization({ nodes: [], edges: [], decisions }, 'org-1')
    expect(out.map((e) => e.sourceId)).toEqual(['d1'])
  })

  it('timelineForAffiliation filters to a single affiliation edge', () => {
    const edges = [
      edge('a1', 'u', 'f', IggRelationshipKinds.AFFILIATED_WITH, {
        occurredAt: '2024-01-01T00:00:00Z',
      }),
      edge('a2', 'u2', 'f', IggRelationshipKinds.AFFILIATED_WITH, {
        occurredAt: '2024-02-01T00:00:00Z',
      }),
      edge('r1', 'rep', 'u', IggRelationshipKinds.REPRESENTS, {
        occurredAt: '2024-03-01T00:00:00Z',
      }),
    ]
    const out = timelineForAffiliation({ nodes: [], edges, decisions: [] }, 'a1')
    expect(out.map((e) => e.sourceId)).toEqual(['a1'])
    expect(out.every((e) => e.kind === 'affiliation')).toBe(true)
  })

  it('timelineForRepresentation filters to a single representation edge', () => {
    const edges = [
      edge('r1', 'rep', 'u', IggRelationshipKinds.REPRESENTS, {
        occurredAt: '2024-01-01T00:00:00Z',
      }),
      edge('a1', 'u', 'f', IggRelationshipKinds.AFFILIATED_WITH, {
        occurredAt: '2024-02-01T00:00:00Z',
      }),
    ]
    const out = timelineForRepresentation({ nodes: [], edges, decisions: [] }, 'r1')
    expect(out.map((e) => e.sourceId)).toEqual(['r1'])
    expect(out.every((e) => e.kind === 'representation')).toBe(true)
  })

  it('timelineForDecision returns lineage-related decisions plus SUPERSEDES markers', () => {
    const decisions = [
      decision('d1', 'org-old', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision('d2', 'org-new', '2024-06-01T00:00:00Z', 'motion_outcome'),
      decision('d3', 'unrelated', '2024-07-01T00:00:00Z', 'motion_outcome'),
    ]
    const edges = [
      edge('s1', 'org-new', 'org-old', IggRelationshipKinds.SUPERSEDES, {
        occurredAt: '2024-05-01T00:00:00Z',
      }),
    ]
    const out = timelineForDecision({ nodes: [], edges, decisions }, 'd2')
    const ids = out.map((e) => e.sourceId)
    expect(ids).toContain('d2')
    expect(ids).toContain('s1')
    expect(ids).not.toContain('d3')
  })

  it('timelineForDecision returns [] when the decision does not exist', () => {
    const out = timelineForDecision({ nodes: [], edges: [], decisions: [] }, 'missing')
    expect(out).toEqual([])
  })
})

// ── Continuity & epoch ─────────────────────────────────────────────────────

describe('Phase 4 — continuityTimeline', () => {
  it('includes entries anchored on cohort members of the federation', () => {
    const edges = [
      edge('aff-1', 'union-a', 'fed', IggRelationshipKinds.AFFILIATED_WITH, {
        occurredAt: '2024-01-01T00:00:00Z',
      }),
      edge('aff-2', 'union-b', 'fed', IggRelationshipKinds.AFFILIATED_WITH, {
        occurredAt: '2024-02-01T00:00:00Z',
      }),
    ]
    const decisions = [
      decision('d-a', 'union-a', '2024-03-01T00:00:00Z', 'motion_outcome'),
      decision('d-b', 'union-b', '2024-04-01T00:00:00Z', 'motion_outcome'),
      decision('d-x', 'unrelated', '2024-05-01T00:00:00Z', 'motion_outcome'),
    ]
    const out = continuityTimeline({ nodes: [], edges, decisions }, 'fed')
    const refs = out.map((e) => e.entityRef)
    expect(refs).toContain('union-a')
    expect(refs).toContain('union-b')
    expect(refs).not.toContain('unrelated')
  })
})

describe('Phase 4 — governanceEpochTimeline', () => {
  it('surfaces entity foundings, protocol amendments, ratifications, and SUPERSEDES events', () => {
    const nodes = [
      node('union-1', IggEntityKinds.UNION, {}, { foundedAt: '2020-01-01T00:00:00Z' }),
      node(
        'class-b',
        IggEntityKinds.CLASS_B_SPECIAL_VOTING_SHARE,
        {},
        { foundedAt: '2020-01-01T00:00:00Z' },
      ),
    ]
    const decisions = [
      decision('p1', 'union-1', '2021-06-01T00:00:00Z', 'protocol_amendment'),
      decision('c1', 'union-1', '2022-09-01T00:00:00Z', 'cba_ratification'),
      decision('m1', 'union-1', '2023-01-01T00:00:00Z', 'motion_outcome'),
    ]
    const edges = [
      edge('s1', 'union-2', 'union-1', IggRelationshipKinds.SUPERSEDES, {
        occurredAt: '2024-01-01T00:00:00Z',
      }),
    ]
    const out = governanceEpochTimeline({ nodes, edges, decisions })
    const ids = out.map((e) => e.sourceId)
    expect(ids).toContain('union-1') // founding
    expect(ids).toContain('p1')
    expect(ids).toContain('c1')
    expect(ids).toContain('s1')
    expect(ids).not.toContain('m1') // motion is not an epoch
    expect(ids).not.toContain('class-b') // protected entity
    // Sorted ascending.
    const ts = out.map((e) => e.occurredAt)
    expect([...ts].sort()).toEqual(ts)
  })
})
