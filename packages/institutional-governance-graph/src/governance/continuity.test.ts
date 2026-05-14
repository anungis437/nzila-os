/**
 * Phase 4 — Institutional continuity tests.
 *
 * Doctrine reminder: continuity is a read-only, succession-and-tenure
 * surface. Tests assert chronology, lineage post-redaction, cohort
 * aggregation, and protected-fence enforcement — never ranking, scoring,
 * tenure-length analytics, or stability metrics.
 */
import type { DecisionNode, DecisionType } from '@nzila/platform-decision-graph'
import type { EntityEdge } from '@nzila/platform-entity-graph'
import { describe, expect, it } from 'vitest'
import { IggEventKinds, IggRelationshipKinds } from '../ontology/kinds'
import {
  buildContinuityTimeline,
  continuityForEntity,
  continuityForOrganization,
  continuityLineage,
  successionBreakpoints,
} from './continuity'

// ── Fixtures ───────────────────────────────────────────────────────────────

function decision(
  id: string,
  entityId: string,
  occurredAt: string,
  category: string,
  eventKind: string = IggEventKinds.MOTION_OUTCOME,
  decisionType: string = 'policy_evaluation',
): DecisionNode {
  return {
    id,
    tenantId: 'tenant-1',
    decisionType: decisionType as DecisionType,
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

function affiliation(
  id: string,
  source: string,
  target: string,
): EntityEdge {
  return {
    id,
    sourceEntityType: 'Organization',
    sourceEntityId: source,
    targetEntityType: 'Organization',
    targetEntityId: target,
    relationshipType: 'PARENT_OF',
    metadata: { iggKind: IggRelationshipKinds.AFFILIATED_WITH },
  }
}

function supersedes(
  id: string,
  newer: string,
  older: string,
  occurredAt?: string,
): EntityEdge {
  return {
    id,
    sourceEntityType: 'Organization',
    sourceEntityId: newer,
    targetEntityType: 'Organization',
    targetEntityId: older,
    relationshipType: 'SUPERSEDES' as EntityEdge['relationshipType'],
    metadata: {
      iggKind: IggRelationshipKinds.SUPERSEDES,
      ...(occurredAt ? { occurredAt } : {}),
    },
  }
}

function overrides(id: string, source: string, target: string): EntityEdge {
  return {
    id,
    sourceEntityType: 'Organization',
    sourceEntityId: source,
    targetEntityType: 'Organization',
    targetEntityId: target,
    relationshipType: 'OVERRIDES' as EntityEdge['relationshipType'],
    metadata: { iggKind: IggRelationshipKinds.OVERRIDES },
  }
}

// ── buildContinuityTimeline ───────────────────────────────────────────────

describe('Phase 4 — buildContinuityTimeline', () => {
  it('returns an empty timeline for an empty graph', () => {
    expect(buildContinuityTimeline({})).toEqual([])
    expect(buildContinuityTimeline({ decisions: [], edges: [] })).toEqual([])
  })

  it('orders continuity decisions and breakpoints chronologically', () => {
    const decisions = [
      decision(
        'd-cba',
        'org-1',
        '2024-06-01T00:00:00Z',
        'cba_ratification',
        IggEventKinds.CBA_RATIFIED,
      ),
      decision(
        'd-tenure',
        'org-1',
        '2024-01-01T00:00:00Z',
        'role_tenure',
        IggEventKinds.ROLE_TENURE_EVENT,
      ),
    ]
    const edges = [supersedes('s1', 'org-2', 'org-1', '2024-03-01T00:00:00Z')]
    const out = buildContinuityTimeline({ decisions, edges })
    expect(out.map((e) => e.kind)).toEqual([
      'role_tenure_event',
      'succession_breakpoint',
      'cba_ratified',
    ])
    expect(out[1]?.predecessorEntityId).toBe('org-1')
    expect(out[1]?.successorEntityId).toBe('org-2')
  })

  it('only surfaces continuity-eligible event kinds (drops MOTION_OUTCOME, etc.)', () => {
    const decisions = [
      decision('d-motion', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision(
        'd-aff',
        'org-1',
        '2024-02-01T00:00:00Z',
        'affiliation_transition',
        IggEventKinds.AFFILIATION_TRANSITION,
      ),
      decision(
        'd-stew',
        'org-1',
        '2024-03-01T00:00:00Z',
        'steward_assignment',
        IggEventKinds.STEWARD_ASSIGNMENT,
      ),
    ]
    expect(
      buildContinuityTimeline({ decisions }).map((e) => e.decisionId),
    ).toEqual(['d-aff', 'd-stew'])
  })

  it('redacts decisions whose iggCategory is protected (class_b_veto)', () => {
    const decisions = [
      decision(
        'd-vis',
        'org-1',
        '2024-01-01T00:00:00Z',
        'role_tenure',
        IggEventKinds.ROLE_TENURE_EVENT,
      ),
      decision(
        'd-cat-protected',
        'org-1',
        '2024-02-01T00:00:00Z',
        'class_b_veto',
        IggEventKinds.ROLE_TENURE_EVENT,
      ),
      decision(
        'd-cat-protected-2',
        'org-1',
        '2024-03-01T00:00:00Z',
        'reserved_matter_vote',
        IggEventKinds.ROLE_TENURE_EVENT,
      ),
    ]
    const out = buildContinuityTimeline({ decisions })
    expect(out.map((e) => e.decisionId)).toEqual(['d-vis'])
  })

  it('drops decisions whose iggEventKind is protected (igg:-prefixed)', () => {
    const decisions = [
      decision(
        'd-vis',
        'org-1',
        '2024-01-01T00:00:00Z',
        'role_tenure',
        IggEventKinds.ROLE_TENURE_EVENT,
      ),
      decision(
        'd-veto',
        'org-1',
        '2024-02-01T00:00:00Z',
        'role_tenure',
        IggEventKinds.CLASS_B_VETO,
      ),
      decision(
        'd-sunset',
        'org-1',
        '2024-03-01T00:00:00Z',
        'role_tenure',
        IggEventKinds.GOLDEN_SHARE_SUNSET_PROGRESSION,
      ),
      decision(
        'd-reserved',
        'org-1',
        '2024-04-01T00:00:00Z',
        'role_tenure',
        IggEventKinds.RESERVED_MATTER_RAISED,
      ),
    ]
    const out = buildContinuityTimeline({ decisions })
    expect(out.map((e) => e.decisionId)).toEqual(['d-vis'])
  })

  it('strips OVERRIDES edges before deriving succession breakpoints', () => {
    const edges = [
      supersedes('s1', 'org-2', 'org-1', '2024-01-01T00:00:00Z'),
      overrides('o1', 'org-3', 'org-1'),
    ]
    const out = buildContinuityTimeline({ edges })
    expect(out).toHaveLength(1)
    expect(out[0]?.kind).toBe('succession_breakpoint')
    expect(out[0]?.successorEntityId).toBe('org-2')
  })

  it('honours since/until/kinds filters', () => {
    const decisions = [
      decision(
        'd-tenure',
        'org-1',
        '2024-01-01T00:00:00Z',
        'role_tenure',
        IggEventKinds.ROLE_TENURE_EVENT,
      ),
      decision(
        'd-aff',
        'org-1',
        '2024-06-01T00:00:00Z',
        'affiliation_transition',
        IggEventKinds.AFFILIATION_TRANSITION,
      ),
      decision(
        'd-stew',
        'org-1',
        '2024-12-01T00:00:00Z',
        'steward_assignment',
        IggEventKinds.STEWARD_ASSIGNMENT,
      ),
    ]
    expect(
      buildContinuityTimeline(
        { decisions },
        { since: '2024-03-01T00:00:00Z', until: '2024-09-01T00:00:00Z' },
      ).map((e) => e.decisionId),
    ).toEqual(['d-aff'])
    expect(
      buildContinuityTimeline(
        { decisions },
        { kinds: ['role_tenure_event', 'steward_assignment'] },
      ).map((e) => e.decisionId),
    ).toEqual(['d-tenure', 'd-stew'])
  })
})

// ── successionBreakpoints ─────────────────────────────────────────────────

describe('Phase 4 — successionBreakpoints', () => {
  it('returns an empty list when no SUPERSEDES edges exist', () => {
    expect(successionBreakpoints({})).toEqual([])
    expect(successionBreakpoints({ edges: [overrides('o1', 'a', 'b')] })).toEqual([])
  })

  it('orders by occurredAt and treats source-supersedes-target as predecessor=target', () => {
    const edges = [
      supersedes('s2', 'org-3', 'org-2', '2024-06-01T00:00:00Z'),
      supersedes('s1', 'org-2', 'org-1', '2024-01-01T00:00:00Z'),
    ]
    const out = successionBreakpoints({ edges })
    expect(out.map((b) => b.edgeId)).toEqual(['s1', 's2'])
    expect(out[0]?.predecessorEntityId).toBe('org-1')
    expect(out[0]?.successorEntityId).toBe('org-2')
  })
})

// ── continuityForEntity / continuityForOrganization ──────────────────────

describe('Phase 4 — continuity anchor helpers', () => {
  const decisions = [
    decision(
      'd-tenure-1',
      'org-1',
      '2024-01-01T00:00:00Z',
      'role_tenure',
      IggEventKinds.ROLE_TENURE_EVENT,
    ),
    decision(
      'd-aff-2',
      'org-2',
      '2024-02-01T00:00:00Z',
      'affiliation_transition',
      IggEventKinds.AFFILIATION_TRANSITION,
    ),
    decision(
      'd-stew-3',
      'org-3',
      '2024-03-01T00:00:00Z',
      'steward_assignment',
      IggEventKinds.STEWARD_ASSIGNMENT,
    ),
  ]
  const edges = [
    affiliation('e1', 'org-2', 'org-1'),
    affiliation('e2', 'org-3', 'org-1'),
    supersedes('s1', 'org-2', 'org-1', '2024-04-01T00:00:00Z'),
  ]

  it('continuityForEntity includes own entries plus succession breakpoints involving it', () => {
    const out = continuityForEntity({ decisions, edges }, 'org-1')
    expect(out.map((e) => e.decisionId ?? e.edgeId)).toEqual([
      'd-tenure-1',
      's1',
    ])
  })

  it('continuityForOrganization aggregates the org plus its affiliated cohort', () => {
    const out = continuityForOrganization({ decisions, edges }, 'org-1')
    expect(out.map((e) => e.decisionId ?? e.edgeId)).toEqual([
      'd-tenure-1',
      'd-aff-2',
      'd-stew-3',
      's1',
    ])
  })
})

// ── continuityLineage ─────────────────────────────────────────────────────

describe('Phase 4 — continuityLineage', () => {
  it('returns the SUPERSEDES chain (oldest → newest), ignoring OVERRIDES', () => {
    const edges = [
      supersedes('s1', 'org-2', 'org-1'),
      supersedes('s2', 'org-3', 'org-2'),
      overrides('o1', 'org-4', 'org-3'),
    ]
    expect(continuityLineage({ edges }, 'org-3')).toEqual([
      'org-1',
      'org-2',
      'org-3',
    ])
  })

  it('returns a single-element chain for an entity with no lineage edges', () => {
    expect(continuityLineage({ edges: [] }, 'org-1')).toEqual(['org-1'])
  })
})
