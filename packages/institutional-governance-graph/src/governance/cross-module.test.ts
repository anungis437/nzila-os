/**
 * Phase 4 #6 — Cross-module integration tests.
 *
 * Drives `buildInstitutionalTimeline`, `buildEvidenceConvergence`,
 * `buildContinuityTimeline`, `successionBreakpoints`, and
 * `summarizeCitations` from a SINGLE rich fixture graph and asserts:
 *
 *   1. cross-surface chronology + identifier consistency
 *   2. lineage post-redaction follows SUPERSEDES only (OVERRIDES stripped)
 *   3. ZERO protected leakage on every read surface (categories, event
 *      kinds, summaries, entity refs)
 *   4. citation aggregation crosses only non-protected decisions
 *
 * Doctrine: read-only, additive, governance-safe. No ranking, no scoring,
 * no behavioural analytics.
 */
import type { DecisionNode, DecisionType } from '@nzila/platform-decision-graph'
import type { EntityEdge, EntityNode } from '@nzila/platform-entity-graph'
import { describe, expect, it } from 'vitest'
import {
  IggEntityKinds,
  IggEventKinds,
  IggRelationshipKinds,
} from '../ontology/kinds'
import {
  buildContinuityTimeline,
  successionBreakpoints,
} from './continuity'
import {
  buildEvidenceConvergence,
  summarizeCitations,
} from './evidence'
import { buildInstitutionalTimeline } from './timeline'

// ── Fixture helpers ────────────────────────────────────────────────────────

function decision(
  id: string,
  entityId: string,
  occurredAt: string,
  category: string,
  eventKind: string = IggEventKinds.MOTION_OUTCOME,
  decisionType: string = 'policy_evaluation',
  refs: {
    evidenceRefs?: readonly string[]
    knowledgeRefs?: readonly string[]
    policyRefs?: readonly string[]
  } = {},
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
    policyRefs: refs.policyRefs ?? [],
    evidenceRefs: refs.evidenceRefs ?? [],
    knowledgeRefs: refs.knowledgeRefs ?? [],
    createdAt: occurredAt,
    executedAt: occurredAt,
  }
}

function affiliation(
  id: string,
  source: string,
  target: string,
  occurredAt: string,
): EntityEdge {
  return {
    id,
    sourceEntityType: 'Person',
    sourceEntityId: source,
    targetEntityType: 'Organization',
    targetEntityId: target,
    relationshipType: 'PARENT_OF',
    metadata: { iggKind: IggRelationshipKinds.AFFILIATED_WITH, occurredAt },
  }
}

function represents(
  id: string,
  source: string,
  target: string,
  occurredAt: string,
): EntityEdge {
  return {
    id,
    sourceEntityType: 'Document',
    sourceEntityId: source,
    targetEntityType: 'Organization',
    targetEntityId: target,
    relationshipType: 'REPRESENTS' as EntityEdge['relationshipType'],
    metadata: { iggKind: IggRelationshipKinds.REPRESENTS, occurredAt },
  }
}

function supersedes(
  id: string,
  newer: string,
  older: string,
  occurredAt: string,
): EntityEdge {
  return {
    id,
    sourceEntityType: 'Organization',
    sourceEntityId: newer,
    targetEntityType: 'Organization',
    targetEntityId: older,
    relationshipType: 'SUPERSEDES' as EntityEdge['relationshipType'],
    metadata: { iggKind: IggRelationshipKinds.SUPERSEDES, occurredAt },
  }
}

// ── Single rich fixture graph ──────────────────────────────────────────────

function node(
  entityId: string,
  entityType: EntityNode['entityType'],
  iggKind: string,
): EntityNode {
  return {
    entityType,
    entityId,
    tenantId: 'tenant-1',
    canonicalName: entityId,
    status: 'active',
    metadata: { iggKind },
  }
}

const nodes: readonly EntityNode[] = [
  node('org-old', 'Organization', 'organization'),
  node('org-new', 'Organization', 'organization'),
  node('person-1', 'Person', 'person'),
  node('role-1', 'Document', 'role'),
  // PROTECTED entity — must be redacted out before any read surface.
  node('class-b-share-1', 'Asset', IggEntityKinds.CLASS_B_SPECIAL_VOTING_SHARE),
] as const

const edges: readonly EntityEdge[] = [
  affiliation('aff-1', 'person-1', 'org-old', '2024-01-15T00:00:00.000Z'),
  represents('rep-1', 'role-1', 'org-old', '2024-02-10T00:00:00.000Z'),
  supersedes('sup-1', 'org-new', 'org-old', '2024-06-01T00:00:00.000Z'),
  // PROTECTED relationships — must be redacted out.
  {
    id: 'veto-1',
    sourceEntityType: 'Asset',
    sourceEntityId: 'class-b-share-1',
    targetEntityType: 'Decision',
    targetEntityId: 'd-veto',
    relationshipType: 'VETOES' as EntityEdge['relationshipType'],
    metadata: {
      iggKind: IggRelationshipKinds.VETOES,
      occurredAt: '2024-07-01T00:00:00.000Z',
    },
  },
  {
    id: 'holds-1',
    sourceEntityType: 'Person',
    sourceEntityId: 'person-1',
    targetEntityType: 'Asset',
    targetEntityId: 'class-b-share-1',
    relationshipType: 'HOLDS' as EntityEdge['relationshipType'],
    metadata: {
      iggKind: IggRelationshipKinds.HOLDS,
      occurredAt: '2024-01-01T00:00:00.000Z',
    },
  },
] as const

const decisions: readonly DecisionNode[] = [
  decision(
    'd-tenure',
    'role-1',
    '2024-03-01T00:00:00.000Z',
    'role_tenure_event',
    IggEventKinds.ROLE_TENURE_EVENT,
    'role_tenure',
    { evidenceRefs: ['ev-1'], knowledgeRefs: ['kn-1'], policyRefs: ['pol-1'] },
  ),
  decision(
    'd-aff',
    'person-1',
    '2024-04-01T00:00:00.000Z',
    'affiliation_transition',
    IggEventKinds.AFFILIATION_TRANSITION,
    'affiliation_change',
    { evidenceRefs: ['ev-2'] },
  ),
  decision(
    'd-cba',
    'org-old',
    '2024-05-01T00:00:00.000Z',
    'cba_ratified',
    IggEventKinds.CBA_RATIFIED,
    'cba_ratification',
    { evidenceRefs: ['ev-3'], policyRefs: ['pol-2'] },
  ),
  // PROTECTED — category-based redaction.
  decision(
    'd-veto',
    'org-new',
    '2024-07-01T00:00:00.000Z',
    'class_b_veto',
    IggEventKinds.CLASS_B_VETO,
    'class_b_veto',
  ),
  // PROTECTED — event-kind-based redaction (different category).
  decision(
    'd-reserved',
    'org-old',
    '2024-08-01T00:00:00.000Z',
    'reserved_matter_vote',
    IggEventKinds.RESERVED_MATTER_RAISED,
    'reserved_matter',
  ),
] as const

const graph = { nodes, edges, decisions } as const

// ── Cross-module assertions ───────────────────────────────────────────────

const PROTECTED_TOKENS = [
  'class_b_veto',
  'reserved_matter_vote',
  'igg:class_b_veto',
  'igg:reserved_matter_raised',
  'igg:golden_share_sunset_progression',
  'class-b-share-1',
] as const

function asJson(value: unknown): string {
  return JSON.stringify(value)
}

describe('Phase 4 #6 — cross-module governance integration', () => {
  const timeline = buildInstitutionalTimeline(graph)
  const evidence = buildEvidenceConvergence(graph)
  const continuity = buildContinuityTimeline(graph)
  const breakpoints = successionBreakpoints(graph)
  const citations = summarizeCitations(evidence)

  it('all read surfaces drop every protected decision', () => {
    const ids = new Set([
      ...timeline.map((e) => e.sourceId),
      ...evidence.map((e) => e.decisionId),
      ...continuity.map((e) => e.decisionId).filter((x): x is string => !!x),
    ])
    expect(ids.has('d-veto')).toBe(false)
    expect(ids.has('d-reserved')).toBe(false)
  })

  it('all read surfaces drop every protected edge', () => {
    const ids = new Set<string>([
      ...timeline.map((e) => e.sourceId),
      ...continuity.map((e) => e.edgeId).filter((x): x is string => !!x),
      ...breakpoints.map((b) => b.edgeId),
    ])
    expect(ids.has('veto-1')).toBe(false)
    expect(ids.has('holds-1')).toBe(false)
  })

  it('no protected token appears in any timeline / evidence / continuity payload', () => {
    const blob = `${asJson(timeline)}|${asJson(evidence)}|${asJson(continuity)}|${asJson(breakpoints)}`
    for (const token of PROTECTED_TOKENS) {
      expect(blob.includes(token)).toBe(false)
    }
  })

  it('timeline surfaces the 3 non-protected decisions plus the 3 timestamped edges, in chronological order', () => {
    expect(timeline).toHaveLength(6)
    const sorted = [...timeline].map((e) => e.occurredAt)
    expect(sorted).toEqual([...sorted].sort())
    expect(timeline.map((e) => e.sourceId)).toEqual([
      'aff-1', // 2024-01-15
      'rep-1', // 2024-02-10
      'd-tenure', // 2024-03-01
      'd-aff', // 2024-04-01
      'd-cba', // 2024-05-01
      'sup-1', // 2024-06-01
    ])
  })

  it('evidence convergence yields exactly the 3 non-protected decisions and is chronological', () => {
    expect(evidence.map((e) => e.decisionId)).toEqual(['d-tenure', 'd-aff', 'd-cba'])
    const sorted = evidence.map((e) => e.occurredAt)
    expect(sorted).toEqual([...sorted].sort())
  })

  it('continuity timeline yields the 3 continuity decisions plus a single succession breakpoint', () => {
    const kinds = continuity.map((e) => e.kind).sort()
    expect(kinds).toEqual([
      'affiliation_transition',
      'cba_ratified',
      'role_tenure_event',
      'succession_breakpoint',
    ])
    const breakpointEntry = continuity.find((e) => e.kind === 'succession_breakpoint')
    expect(breakpointEntry).toMatchObject({
      edgeId: 'sup-1',
      predecessorEntityId: 'org-old',
      successorEntityId: 'org-new',
      occurredAt: '2024-06-01T00:00:00.000Z',
    })
  })

  it('successionBreakpoints reflects SUPERSEDES lineage post-redaction (OVERRIDES never appears)', () => {
    expect(breakpoints).toHaveLength(1)
    expect(breakpoints[0]).toMatchObject({
      edgeId: 'sup-1',
      predecessorEntityId: 'org-old',
      successorEntityId: 'org-new',
    })
  })

  it('decision IDs surfaced by timeline are a superset of those in evidence and continuity', () => {
    const tl = new Set(timeline.map((e) => e.sourceId))
    for (const e of evidence) expect(tl.has(e.decisionId)).toBe(true)
    for (const e of continuity) {
      if (e.decisionId) expect(tl.has(e.decisionId)).toBe(true)
    }
  })

  it('citation summary aggregates only non-protected decisions, sorted + de-duplicated', () => {
    expect(citations).toEqual({
      evidenceRefs: ['ev-1', 'ev-2', 'ev-3'],
      knowledgeRefs: ['kn-1'],
      policyRefs: ['pol-1', 'pol-2'],
    })
  })

  it('entity refs across all surfaces are confined to the non-protected substrate', () => {
    const allowed = new Set(['org-old', 'org-new', 'person-1', 'role-1'])
    for (const e of timeline) expect(allowed.has(e.entityRef)).toBe(true)
    for (const e of evidence) expect(allowed.has(e.entityRef)).toBe(true)
    for (const e of continuity) expect(allowed.has(e.entityRef)).toBe(true)
    for (const b of breakpoints) {
      expect(allowed.has(b.predecessorEntityId)).toBe(true)
      expect(allowed.has(b.successorEntityId)).toBe(true)
    }
  })
})
