/**
 * Phase 4 — Trust & explainability convergence tests.
 *
 * Doctrine reminder: read-only convergence over evidence + timeline +
 * lineage. Tests assert chronology, citation joining, preceding-event
 * linkage, lineage linkage, deterministic ordering, protected-fence
 * enforcement, and provenance-coverage *counts only* — never ranking,
 * scoring, weighting, predictive simulation, or behavioural inference.
 */
import type { DecisionNode, DecisionType } from '@nzila/platform-decision-graph'
import type { EntityEdge } from '@nzila/platform-entity-graph'
import { describe, expect, it } from 'vitest'
import { IggEventKinds, IggRelationshipKinds } from '../ontology/kinds.js'
import {
  buildExplainabilityRecords,
  explainabilityForDecision,
  explainabilityForEntity,
  summarizeProvenanceCoverage,
} from './trust.js'

// ── Fixtures ──────────────────────────────────────────────────────────────

function decision(
  id: string,
  entityId: string,
  occurredAt: string,
  category: string,
  refs: {
    evidence?: readonly string[]
    knowledge?: readonly string[]
    policy?: readonly string[]
  } = {},
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
    policyRefs: refs.policy ?? [],
    evidenceRefs: refs.evidence ?? [],
    knowledgeRefs: refs.knowledge ?? [],
    createdAt: occurredAt,
    executedAt: occurredAt,
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

// ── buildExplainabilityRecords ────────────────────────────────────────────

describe('Phase 4 — buildExplainabilityRecords', () => {
  it('returns an empty list for an empty graph', () => {
    expect(buildExplainabilityRecords({})).toEqual([])
    expect(buildExplainabilityRecords({ decisions: [] })).toEqual([])
  })

  it('exposes the citation triplet on each record and orders chronologically', () => {
    const decisions = [
      decision('d2', 'org-1', '2024-06-01T00:00:00Z', 'motion_outcome', {
        evidence: ['ev-2'],
        knowledge: ['kn-2'],
        policy: ['pol-2'],
      }),
      decision('d1', 'org-1', '2024-01-01T00:00:00Z', 'cba_ratification', {
        evidence: ['ev-1'],
        policy: ['pol-1'],
      }),
    ]
    const out = buildExplainabilityRecords({ decisions })
    expect(out.map((r) => r.decisionRef)).toEqual(['d1', 'd2'])
    expect(out[0]?.evidenceRefs).toEqual(['ev-1'])
    expect(out[0]?.policyRefs).toEqual(['pol-1'])
    expect(out[0]?.knowledgeRefs).toEqual([])
    expect(out[1]?.knowledgeRefs).toEqual(['kn-2'])
  })

  it('breaks ties on identical occurredAt deterministically by decisionRef', () => {
    const decisions = [
      decision('d-b', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision('d-a', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
    ]
    const out = buildExplainabilityRecords({ decisions })
    expect(out.map((r) => r.decisionRef)).toEqual(['d-a', 'd-b'])
  })

  it('links preceding events on the same entity via timeline sourceIds', () => {
    const decisions = [
      decision('d-prior', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision('d-mid', 'org-1', '2024-03-01T00:00:00Z', 'motion_outcome'),
      decision('d-current', 'org-1', '2024-06-01T00:00:00Z', 'motion_outcome'),
      decision('d-other', 'org-2', '2024-05-01T00:00:00Z', 'motion_outcome'),
    ]
    const out = buildExplainabilityRecords({ decisions })
    const current = out.find((r) => r.decisionRef === 'd-current')
    expect(current?.precedingEventRefs).toEqual(['d-mid', 'd-prior'])
    expect(current?.precedingEventRefs).not.toContain('d-other')
    expect(current?.precedingEventRefs).not.toContain('d-current')
  })

  it('honours windowBeforeMs when bounding preceding events', () => {
    const decisions = [
      decision('d-old', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision('d-recent', 'org-1', '2024-05-25T00:00:00Z', 'motion_outcome'),
      decision('d-current', 'org-1', '2024-06-01T00:00:00Z', 'motion_outcome'),
    ]
    const out = buildExplainabilityRecords(
      { decisions },
      { windowBeforeMs: 30 * 24 * 60 * 60 * 1000 },
    )
    const current = out.find((r) => r.decisionRef === 'd-current')
    expect(current?.precedingEventRefs).toEqual(['d-recent'])
  })

  it('links lineage via SUPERSEDES edges where the entity participates', () => {
    const decisions = [
      decision('d1', 'org-old', '2024-02-01T00:00:00Z', 'motion_outcome'),
      decision('d2', 'org-new', '2024-04-01T00:00:00Z', 'motion_outcome'),
      decision('d3', 'org-unrelated', '2024-04-01T00:00:00Z', 'motion_outcome'),
    ]
    const edges = [supersedes('s1', 'org-new', 'org-old', '2024-03-01T00:00:00Z')]
    const out = buildExplainabilityRecords({ decisions, edges })
    expect(out.find((r) => r.decisionRef === 'd1')?.lineageRefs).toEqual(['s1'])
    expect(out.find((r) => r.decisionRef === 'd2')?.lineageRefs).toEqual(['s1'])
    expect(out.find((r) => r.decisionRef === 'd3')?.lineageRefs).toEqual([])
  })

  it('redacts decisions whose iggCategory is protected (class_b_veto)', () => {
    const decisions = [
      decision('d-vis', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision('d-protected', 'org-1', '2024-02-01T00:00:00Z', 'class_b_veto'),
    ]
    const out = buildExplainabilityRecords({ decisions })
    expect(out.map((r) => r.decisionRef)).toEqual(['d-vis'])
  })

  it('redacts decisions whose iggEventKind is protected', () => {
    const decisions = [
      decision('d-vis', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision(
        'd-event-protected',
        'org-1',
        '2024-02-01T00:00:00Z',
        'motion_outcome',
        {},
        IggEventKinds.CLASS_B_VETO,
      ),
    ]
    const out = buildExplainabilityRecords({ decisions })
    expect(out.map((r) => r.decisionRef)).toEqual(['d-vis'])
  })

  it('applies since/until/decisionTypes/requireCitation filters', () => {
    const decisions = [
      decision('d-early', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome', {
        evidence: ['ev-1'],
      }),
      decision('d-mid', 'org-1', '2024-03-01T00:00:00Z', 'motion_outcome'),
      decision(
        'd-late',
        'org-1',
        '2024-09-01T00:00:00Z',
        'cba_ratification',
        { policy: ['pol-1'] },
        IggEventKinds.MOTION_OUTCOME,
        'cba_ratification',
      ),
    ]
    expect(
      buildExplainabilityRecords(
        { decisions },
        { since: '2024-02-01T00:00:00Z', until: '2024-08-01T00:00:00Z' },
      ).map((r) => r.decisionRef),
    ).toEqual(['d-mid'])
    expect(
      buildExplainabilityRecords(
        { decisions },
        { decisionTypes: ['cba_ratification'] },
      ).map((r) => r.decisionRef),
    ).toEqual(['d-late'])
    expect(
      buildExplainabilityRecords({ decisions }, { requireCitation: true }).map(
        (r) => r.decisionRef,
      ),
    ).toEqual(['d-early', 'd-late'])
  })
})

// ── explainabilityForDecision / explainabilityForEntity ───────────────────

describe('Phase 4 — explainabilityForDecision / explainabilityForEntity', () => {
  it('explainabilityForDecision returns at most one record', () => {
    const decisions = [
      decision('d1', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision('d2', 'org-1', '2024-02-01T00:00:00Z', 'motion_outcome'),
    ]
    expect(
      explainabilityForDecision({ decisions }, 'd1').map((r) => r.decisionRef),
    ).toEqual(['d1'])
    expect(explainabilityForDecision({ decisions }, 'unknown')).toEqual([])
  })

  it('explainabilityForDecision returns empty when the decision is redacted', () => {
    const decisions = [
      decision('d-protected', 'org-1', '2024-02-01T00:00:00Z', 'class_b_veto'),
    ]
    expect(explainabilityForDecision({ decisions }, 'd-protected')).toEqual([])
  })

  it('explainabilityForEntity scopes to a single entity and respects options', () => {
    const decisions = [
      decision('d1', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision('d2', 'org-2', '2024-02-01T00:00:00Z', 'motion_outcome'),
      decision('d3', 'org-1', '2024-03-01T00:00:00Z', 'motion_outcome'),
    ]
    expect(
      explainabilityForEntity({ decisions }, 'org-1').map((r) => r.decisionRef),
    ).toEqual(['d1', 'd3'])
    expect(
      explainabilityForEntity(
        { decisions },
        'org-1',
        { since: '2024-02-15T00:00:00Z' },
      ).map((r) => r.decisionRef),
    ).toEqual(['d3'])
  })
})

// ── summarizeProvenanceCoverage ───────────────────────────────────────────

describe('Phase 4 — summarizeProvenanceCoverage', () => {
  it('returns zeroed counts for an empty record set', () => {
    expect(summarizeProvenanceCoverage([])).toEqual({
      totalDecisions: 0,
      decisionsWithEvidence: 0,
      decisionsWithKnowledge: 0,
      decisionsWithPolicy: 0,
      decisionsWithLineage: 0,
      decisionsWithPrecedingEvent: 0,
    })
  })

  it('counts coverage across each provenance dimension (counts only — no ranking)', () => {
    const decisions = [
      decision('d1', 'org-old', '2024-01-01T00:00:00Z', 'motion_outcome', {
        evidence: ['ev-1'],
        knowledge: ['kn-1'],
        policy: ['pol-1'],
      }),
      decision('d2', 'org-new', '2024-04-01T00:00:00Z', 'motion_outcome', {
        evidence: ['ev-2'],
      }),
      decision('d3', 'org-x', '2024-05-01T00:00:00Z', 'motion_outcome'),
    ]
    const edges = [supersedes('s1', 'org-new', 'org-old', '2024-03-01T00:00:00Z')]
    const records = buildExplainabilityRecords({ decisions, edges })
    const coverage = summarizeProvenanceCoverage(records)
    expect(coverage.totalDecisions).toBe(3)
    expect(coverage.decisionsWithEvidence).toBe(2)
    expect(coverage.decisionsWithKnowledge).toBe(1)
    expect(coverage.decisionsWithPolicy).toBe(1)
    expect(coverage.decisionsWithLineage).toBe(2)
    // d2 (org-new, 2024-04-01) is preceded on its own entity by the
    // supersedes edge timeline entry (s1 @ 2024-03-01). d1 and d3 have
    // no preceding events on their own entities.
    expect(coverage.decisionsWithPrecedingEvent).toBe(1)
  })
})
