/**
 * Phase 3 — Governance fence + chronology + query tests.
 */
import type { DecisionNode } from '@nzila/platform-decision-graph'
import type { EntityEdge, EntityNode } from '@nzila/platform-entity-graph'
import { describe, expect, it } from 'vitest'
import { IggEntityKinds, IggEventKinds, IggRelationshipKinds } from '../ontology/kinds.js'
import {
  chronologyForEntity,
  lineageChain,
  orderDecisionsChronologically,
} from './chronology.js'
import {
  IGG_PROTECTED_DECISION_CATEGORIES,
  IGG_PROTECTED_ENTITY_KINDS,
  IGG_PROTECTED_EVENT_KINDS,
  IGG_PROTECTED_RELATIONSHIP_KINDS,
  assertNoProtectedKindsInReadSurface,
  isProtectedEntityKind,
  isProtectedEventKind,
  isProtectedRelationshipKind,
  redactProtected,
} from './protected.js'
import {
  continuityCohort,
  dependencyClosure,
  eligibleVotersFor,
  hierarchyAncestors,
  hierarchyDescendants,
  nodesOfIggKind,
} from './queries.js'

// ── Fixtures ────────────────────────────────────────────────────────────────

function node(id: string, iggKind: string, extra: Partial<EntityNode> = {}): EntityNode {
  return {
    entityType: 'Organization',
    entityId: id,
    tenantId: 'tenant-1',
    canonicalName: id,
    status: 'active',
    metadata: { iggKind },
    ...extra,
  }
}

function edge(
  id: string,
  source: string,
  target: string,
  iggKind: string,
  relType: EntityEdge['relationshipType'] = 'PARENT_OF',
): EntityEdge {
  return {
    id,
    sourceEntityType: 'Organization',
    sourceEntityId: source,
    targetEntityType: 'Organization',
    targetEntityId: target,
    relationshipType: relType,
    metadata: { iggKind },
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

// ── Protected fence ─────────────────────────────────────────────────────────

describe('Phase 3 — Protected semantics fence', () => {
  it('classifies protected entity kinds', () => {
    expect(isProtectedEntityKind(IggEntityKinds.CLASS_B_SPECIAL_VOTING_SHARE)).toBe(true)
    expect(isProtectedEntityKind(IggEntityKinds.RESERVED_MATTER)).toBe(true)
    expect(isProtectedEntityKind(IggEntityKinds.CONGRESS)).toBe(false)
    expect(isProtectedEntityKind(undefined)).toBe(false)
  })

  it('classifies protected relationship kinds', () => {
    expect(isProtectedRelationshipKind(IggRelationshipKinds.VETOES)).toBe(true)
    expect(isProtectedRelationshipKind(IggRelationshipKinds.HOLDS)).toBe(true)
    expect(isProtectedRelationshipKind(IggRelationshipKinds.PARENT_OF)).toBe(false)
  })

  it('classifies protected event kinds', () => {
    expect(isProtectedEventKind(IggEventKinds.CLASS_B_VETO)).toBe(true)
    expect(isProtectedEventKind(IggEventKinds.RESERVED_MATTER_RAISED)).toBe(true)
    expect(isProtectedEventKind(IggEventKinds.MOTION_OUTCOME)).toBe(false)
  })

  it('exposes the canonical fence lists as frozen arrays', () => {
    expect(Object.isFrozen(IGG_PROTECTED_ENTITY_KINDS)).toBe(true)
    expect(Object.isFrozen(IGG_PROTECTED_RELATIONSHIP_KINDS)).toBe(true)
    expect(Object.isFrozen(IGG_PROTECTED_EVENT_KINDS)).toBe(true)
    expect(Object.isFrozen(IGG_PROTECTED_DECISION_CATEGORIES)).toBe(true)
  })

  it('redacts protected nodes/edges/decisions without mutating input', () => {
    const nodes = [
      node('n1', IggEntityKinds.CONGRESS),
      node('n2', IggEntityKinds.CLASS_B_SPECIAL_VOTING_SHARE),
    ]
    const edges = [
      edge('e1', 'a', 'b', IggRelationshipKinds.PARENT_OF),
      edge('e2', 'umrc', 'cbssvs', IggRelationshipKinds.HOLDS, 'HAS'),
    ]
    const decisions = [
      decision('d1', 'committee-1', '2026-01-01T00:00:00Z', 'motion_outcome'),
      decision(
        'd2',
        'rm-1',
        '2026-02-01T00:00:00Z',
        'class_b_veto',
        IggEventKinds.CLASS_B_VETO,
      ),
    ]
    const safe = redactProtected({ nodes, edges, decisions })
    expect(safe.nodes!.map((n) => n.entityId)).toEqual(['n1'])
    expect(safe.edges!.map((e) => e.id)).toEqual(['e1'])
    expect(safe.decisions!.map((d) => d.id)).toEqual(['d1'])
    // input untouched
    expect(nodes).toHaveLength(2)
    expect(edges).toHaveLength(2)
    expect(decisions).toHaveLength(2)
  })

  it('assertNoProtectedKindsInReadSurface throws on leak', () => {
    const leaky = {
      nodes: [node('n', IggEntityKinds.RESERVED_MATTER)],
    }
    expect(() => assertNoProtectedKindsInReadSurface(leaky)).toThrowError(
      /Protected governance semantics leaked/,
    )
  })

  it('assertNoProtectedKindsInReadSurface passes on clean surface', () => {
    expect(() =>
      assertNoProtectedKindsInReadSurface({
        nodes: [node('n', IggEntityKinds.CONGRESS)],
        edges: [edge('e', 'a', 'b', IggRelationshipKinds.AFFILIATED_WITH, 'BELONGS_TO')],
        decisions: [decision('d', 'x', '2026-01-01T00:00:00Z', 'motion_outcome')],
      }),
    ).not.toThrow()
  })
})

// ── Chronology / lineage ───────────────────────────────────────────────────

describe('Phase 3 — Chronology utilities', () => {
  it('orders decisions ascending by executedAt with stable tie-breaking', () => {
    const decisions = [
      decision('d3', 'x', '2026-03-01T00:00:00Z', 'motion_outcome'),
      decision('d1', 'x', '2026-01-01T00:00:00Z', 'motion_outcome'),
      decision('d2', 'x', '2026-02-01T00:00:00Z', 'motion_outcome'),
    ]
    expect(orderDecisionsChronologically(decisions).map((d) => d.id)).toEqual([
      'd1',
      'd2',
      'd3',
    ])
  })

  it('chronologyForEntity filters by entityId and returns thin views', () => {
    const decisions = [
      decision('d1', 'committee-1', '2026-01-01T00:00:00Z', 'motion_outcome'),
      decision('d2', 'committee-2', '2026-02-01T00:00:00Z', 'motion_outcome'),
      decision('d3', 'committee-1', '2026-03-01T00:00:00Z', 'cba_ratification'),
    ]
    const view = chronologyForEntity('committee-1', decisions)
    expect(view).toHaveLength(2)
    expect(view[0]!.decisionId).toBe('d1')
    expect(view[1]!.category).toBe('cba_ratification')
  })

  it('lineageChain walks SUPERSEDES backwards then forwards', () => {
    const edges: EntityEdge[] = [
      edge('e1', 'cba-v2', 'cba-v1', IggRelationshipKinds.SUPERSEDES, 'REFERENCES'),
      edge('e2', 'cba-v3', 'cba-v2', IggRelationshipKinds.SUPERSEDES, 'REFERENCES'),
    ]
    expect(lineageChain('cba-v2', edges)).toEqual(['cba-v1', 'cba-v2', 'cba-v3'])
  })

  it('lineageChain breaks cycles defensively', () => {
    const edges: EntityEdge[] = [
      edge('e1', 'a', 'b', IggRelationshipKinds.SUPERSEDES, 'REFERENCES'),
      edge('e2', 'b', 'a', IggRelationshipKinds.SUPERSEDES, 'REFERENCES'),
    ]
    const chain = lineageChain('a', edges)
    expect(chain.length).toBeLessThanOrEqual(3)
    expect(new Set(chain).size).toBe(chain.length)
  })
})

// ── Read-only query surfaces ───────────────────────────────────────────────

describe('Phase 3 — Governance query surfaces', () => {
  const edges: EntityEdge[] = [
    edge('h1', 'congress', 'union', IggRelationshipKinds.PARENT_OF),
    edge('h2', 'union', 'local', IggRelationshipKinds.PARENT_OF),
    edge(
      'a1',
      'union',
      'congress',
      IggRelationshipKinds.AFFILIATED_WITH,
      'BELONGS_TO',
    ),
    edge(
      'el1',
      'mbr-1',
      'session-1',
      IggRelationshipKinds.ELIGIBLE_TO_VOTE_IN,
      'LINKS_TO',
    ),
    edge(
      'el2',
      'mbr-2',
      'session-1',
      IggRelationshipKinds.ELIGIBLE_TO_VOTE_IN,
      'LINKS_TO',
    ),
    edge('dep1', 'a', 'b', IggRelationshipKinds.DEPENDS_ON, 'DEPENDS_ON'),
    edge('dep2', 'b', 'c', IggRelationshipKinds.DEPENDS_ON, 'DEPENDS_ON'),
  ]

  it('hierarchyAncestors walks PARENT_OF upwards', () => {
    expect(hierarchyAncestors('local', edges)).toEqual(['union', 'congress'])
  })

  it('hierarchyDescendants walks PARENT_OF downwards', () => {
    expect(hierarchyDescendants('congress', edges)).toEqual(['union', 'local'])
  })

  it('continuityCohort returns affiliations for a target organization', () => {
    expect(continuityCohort('congress', edges)).toEqual(['union'])
  })

  it('eligibleVotersFor returns voters bound to a session', () => {
    expect(eligibleVotersFor('session-1', edges)).toEqual(['mbr-1', 'mbr-2'])
  })

  it('dependencyClosure walks transitive DEPENDS_ON edges', () => {
    expect(dependencyClosure('a', edges)).toEqual(['b', 'c'])
  })

  it('nodesOfIggKind filters by IGG metadata', () => {
    const nodes = [
      node('n1', IggEntityKinds.CONGRESS),
      node('n2', IggEntityKinds.UNION),
      node('n3', IggEntityKinds.CONGRESS),
    ]
    expect(nodesOfIggKind(nodes, IggEntityKinds.CONGRESS).map((n) => n.entityId)).toEqual([
      'n1',
      'n3',
    ])
  })
})
