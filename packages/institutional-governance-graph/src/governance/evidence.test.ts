/**
 * Phase 4 — Evidence convergence tests.
 *
 * Doctrine reminder: read-only convergence over the citation triplet
 * (evidence / knowledge / policy). Tests assert chronology, filtering,
 * citation aggregation, and protected-fence enforcement — never ranking,
 * scoring, or behavioural inference.
 */
import type { DecisionNode, DecisionType } from '@nzila/platform-decision-graph'
import type { EntityEdge } from '@nzila/platform-entity-graph'
import { describe, expect, it } from 'vitest'
import { IggEventKinds, IggRelationshipKinds } from '../ontology/kinds.js'
import {
  buildEvidenceConvergence,
  evidenceForDecision,
  evidenceForEntity,
  evidenceForOrganization,
  summarizeCitations,
} from './evidence.js'

// ── Fixtures ───────────────────────────────────────────────────────────────

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

function affiliation(
  id: string,
  source: string,
  target: string,
  occurredAt?: string,
): EntityEdge {
  return {
    id,
    sourceEntityType: 'Organization',
    sourceEntityId: source,
    targetEntityType: 'Organization',
    targetEntityId: target,
    relationshipType: 'PARENT_OF',
    metadata: {
      iggKind: IggRelationshipKinds.AFFILIATED_WITH,
      ...(occurredAt ? { occurredAt } : {}),
    },
  }
}

// ── buildEvidenceConvergence ──────────────────────────────────────────────

describe('Phase 4 — buildEvidenceConvergence', () => {
  it('returns an empty convergence for an empty graph', () => {
    expect(buildEvidenceConvergence({ decisions: [] })).toEqual([])
    expect(buildEvidenceConvergence({})).toEqual([])
  })

  it('orders entries chronologically and exposes the citation triplet', () => {
    const decisions = [
      decision('d2', 'org-1', '2024-06-01T00:00:00Z', 'motion_outcome', {
        evidence: ['ev-2'],
        knowledge: ['kn-2'],
        policy: ['pol-2'],
      }),
      decision('d1', 'org-1', '2024-01-01T00:00:00Z', 'cba_ratification', {
        evidence: ['ev-1'],
        knowledge: [],
        policy: ['pol-1'],
      }),
    ]
    const out = buildEvidenceConvergence({ decisions })
    expect(out.map((e) => e.decisionId)).toEqual(['d1', 'd2'])
    expect(out[0]?.evidenceRefs).toEqual(['ev-1'])
    expect(out[0]?.knowledgeRefs).toEqual([])
    expect(out[0]?.policyRefs).toEqual(['pol-1'])
    expect(out[1]?.entityRef).toBe('org-1')
    expect(out[1]?.summary).toContain('motion_outcome')
  })

  it('redacts decisions whose iggCategory is protected (class_b_veto)', () => {
    const decisions = [
      decision('d-vis', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision('d-protected', 'org-1', '2024-02-01T00:00:00Z', 'class_b_veto'),
    ]
    const out = buildEvidenceConvergence({ decisions })
    expect(out.map((e) => e.decisionId)).toEqual(['d-vis'])
  })

  it('drops decisions whose iggEventKind is protected even if category is benign', () => {
    const decisions = [
      decision('d-vis', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision(
        'd-event-protected',
        'org-1',
        '2024-02-01T00:00:00Z',
        'motion_outcome',
        {},
        IggEventKinds.RESERVED_MATTER_RAISED,
      ),
    ]
    const out = buildEvidenceConvergence({ decisions })
    expect(out.map((e) => e.decisionId)).toEqual(['d-vis'])
  })

  it('honours since/until/decisionTypes filters', () => {
    const decisions = [
      decision('d1', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome'),
      decision(
        'd2',
        'org-1',
        '2024-06-01T00:00:00Z',
        'cba_ratification',
        {},
        IggEventKinds.MOTION_OUTCOME,
        'cba_ratification',
      ),
      decision('d3', 'org-1', '2024-12-01T00:00:00Z', 'motion_outcome'),
    ]
    expect(
      buildEvidenceConvergence(
        { decisions },
        { since: '2024-03-01T00:00:00Z', until: '2024-09-01T00:00:00Z' },
      ).map((e) => e.decisionId),
    ).toEqual(['d2'])
    expect(
      buildEvidenceConvergence(
        { decisions },
        { decisionTypes: ['cba_ratification'] },
      ).map((e) => e.decisionId),
    ).toEqual(['d2'])
  })

  it('honours requireEvidence/requireKnowledge/requirePolicy filters', () => {
    const decisions = [
      decision('d1', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome', {
        evidence: ['ev-1'],
      }),
      decision('d2', 'org-1', '2024-02-01T00:00:00Z', 'motion_outcome', {
        knowledge: ['kn-1'],
      }),
      decision('d3', 'org-1', '2024-03-01T00:00:00Z', 'motion_outcome', {
        policy: ['pol-1'],
      }),
      decision('d4', 'org-1', '2024-04-01T00:00:00Z', 'motion_outcome'),
    ]
    expect(
      buildEvidenceConvergence({ decisions }, { requireEvidence: true }).map(
        (e) => e.decisionId,
      ),
    ).toEqual(['d1'])
    expect(
      buildEvidenceConvergence({ decisions }, { requireKnowledge: true }).map(
        (e) => e.decisionId,
      ),
    ).toEqual(['d2'])
    expect(
      buildEvidenceConvergence({ decisions }, { requirePolicy: true }).map(
        (e) => e.decisionId,
      ),
    ).toEqual(['d3'])
  })
})

// ── evidenceForDecision / evidenceForEntity / evidenceForOrganization ────

describe('Phase 4 — evidence anchor helpers', () => {
  const decisions = [
    decision('d1', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome', {
      evidence: ['ev-1'],
    }),
    decision('d2', 'org-2', '2024-02-01T00:00:00Z', 'motion_outcome', {
      knowledge: ['kn-1'],
    }),
    decision('d3', 'org-3', '2024-03-01T00:00:00Z', 'motion_outcome', {
      policy: ['pol-1'],
    }),
  ]
  const edges = [affiliation('e1', 'org-2', 'org-1'), affiliation('e2', 'org-3', 'org-1')]

  it('evidenceForDecision returns at most one entry', () => {
    expect(evidenceForDecision({ decisions }, 'd2').map((e) => e.decisionId)).toEqual([
      'd2',
    ])
    expect(evidenceForDecision({ decisions }, 'unknown')).toEqual([])
  })

  it('evidenceForEntity filters by entityRef only', () => {
    expect(evidenceForEntity({ decisions }, 'org-2').map((e) => e.decisionId)).toEqual([
      'd2',
    ])
  })

  it('evidenceForOrganization includes the organization plus its affiliated cohort', () => {
    const out = evidenceForOrganization({ decisions, edges }, 'org-1')
    expect(out.map((e) => e.decisionId)).toEqual(['d1', 'd2', 'd3'])
  })
})

// ── summarizeCitations ────────────────────────────────────────────────────

describe('Phase 4 — summarizeCitations', () => {
  it('produces a sorted, de-duplicated union across entries', () => {
    const decisions = [
      decision('d1', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome', {
        evidence: ['ev-2', 'ev-1'],
        knowledge: ['kn-1'],
        policy: ['pol-1'],
      }),
      decision('d2', 'org-1', '2024-02-01T00:00:00Z', 'motion_outcome', {
        evidence: ['ev-1', 'ev-3'],
        knowledge: ['kn-2', 'kn-1'],
        policy: ['pol-2'],
      }),
    ]
    const entries = buildEvidenceConvergence({ decisions })
    const summary = summarizeCitations(entries)
    expect(summary.evidenceRefs).toEqual(['ev-1', 'ev-2', 'ev-3'])
    expect(summary.knowledgeRefs).toEqual(['kn-1', 'kn-2'])
    expect(summary.policyRefs).toEqual(['pol-1', 'pol-2'])
  })

  it('omits citations from redacted protected decisions', () => {
    const decisions = [
      decision('d-vis', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome', {
        evidence: ['ev-visible'],
      }),
      decision(
        'd-protected',
        'org-1',
        '2024-02-01T00:00:00Z',
        'motion_outcome',
        { evidence: ['ev-secret'], knowledge: ['kn-secret'], policy: ['pol-secret'] },
        IggEventKinds.CLASS_B_VETO,
      ),
    ]
    const summary = summarizeCitations(buildEvidenceConvergence({ decisions }))
    expect(summary.evidenceRefs).toEqual(['ev-visible'])
    expect(summary.knowledgeRefs).toEqual([])
    expect(summary.policyRefs).toEqual([])
  })
})
