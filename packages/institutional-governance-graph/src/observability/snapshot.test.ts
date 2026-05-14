/**
 * Phase 4 — Read-only institutional observability tests.
 *
 * Doctrine reminder: counts only. No ratios/percentages/scores/rankings
 * surface. Gate disabled → returns null and emits nothing. Gate enabled
 * → composes existing read-only builders and returns a counts-only
 * snapshot. Protected substrate must never reach the snapshot.
 */
import type { DecisionNode, DecisionType } from '@nzila/platform-decision-graph'
import type { EntityEdge } from '@nzila/platform-entity-graph'
import { describe, expect, it } from 'vitest'
import {
  IGG_PROTECTED_DECISION_CATEGORIES,
  IGG_PROTECTED_EVENT_KINDS,
} from '../governance/protected'
import { IggEventKinds, IggRelationshipKinds } from '../ontology/kinds'
import { collectInstitutionalObservability } from './snapshot'

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

function supersedes(id: string, newer: string, older: string): EntityEdge {
  return {
    id,
    sourceEntityType: 'Organization',
    sourceEntityId: newer,
    targetEntityType: 'Organization',
    targetEntityId: older,
    relationshipType: 'SUPERSEDES' as EntityEdge['relationshipType'],
    metadata: { iggKind: IggRelationshipKinds.SUPERSEDES },
  }
}

function richGraph() {
  const decisions = [
    decision('d1', 'org-old', '2024-01-01T00:00:00Z', 'motion_outcome', {
      evidence: ['ev-1'],
      knowledge: ['kn-1'],
      policy: ['pol-1'],
    }),
    decision('d2', 'org-new', '2024-04-01T00:00:00Z', 'motion_outcome', {
      evidence: ['ev-2'],
    }),
    decision('d3', 'org-new', '2024-05-01T00:00:00Z', 'motion_outcome'),
  ]
  const edges = [supersedes('s1', 'org-new', 'org-old')]
  return { decisions, edges, nodes: [] as never[] }
}

// ── Gate ──────────────────────────────────────────────────────────────────

describe('Phase 4 — observability gate', () => {
  it('returns null when the gate is disabled via explicit flag', () => {
    const out = collectInstitutionalObservability(richGraph(), {
      enabled: false,
    })
    expect(out).toBeNull()
  })

  it('returns null when no flag is provided and env is unset', () => {
    const original = process.env.IGG_OBSERVABILITY_ENABLED
    delete process.env.IGG_OBSERVABILITY_ENABLED
    try {
      expect(collectInstitutionalObservability(richGraph())).toBeNull()
    } finally {
      if (original !== undefined)
        process.env.IGG_OBSERVABILITY_ENABLED = original
    }
  })

  it('respects IGG_OBSERVABILITY_ENABLED=1 from process.env', () => {
    const original = process.env.IGG_OBSERVABILITY_ENABLED
    process.env.IGG_OBSERVABILITY_ENABLED = '1'
    try {
      const out = collectInstitutionalObservability(richGraph())
      expect(out).not.toBeNull()
    } finally {
      if (original === undefined)
        delete process.env.IGG_OBSERVABILITY_ENABLED
      else process.env.IGG_OBSERVABILITY_ENABLED = original
    }
  })

  it('explicit enabled=true overrides env', () => {
    const original = process.env.IGG_OBSERVABILITY_ENABLED
    delete process.env.IGG_OBSERVABILITY_ENABLED
    try {
      const out = collectInstitutionalObservability(richGraph(), {
        enabled: true,
      })
      expect(out).not.toBeNull()
    } finally {
      if (original !== undefined)
        process.env.IGG_OBSERVABILITY_ENABLED = original
    }
  })
})

// ── Snapshot shape ────────────────────────────────────────────────────────

describe('Phase 4 — observability snapshot shape (counts only)', () => {
  it('emits an empty-but-structured snapshot for an empty graph', () => {
    const out = collectInstitutionalObservability({}, { enabled: true })
    expect(out).not.toBeNull()
    expect(out!.substrate).toEqual({ nodes: 0, edges: 0, decisions: 0 })
    expect(out!.timeline.entries).toBe(0)
    expect(out!.evidence.entries).toBe(0)
    expect(out!.continuity.entries).toBe(0)
    expect(out!.provenance.totalDecisions).toBe(0)
    expect(typeof out!.generatedAt).toBe('string')
    expect(() => new Date(out!.generatedAt).toISOString()).not.toThrow()
  })

  it('counts substrate / timeline / evidence / continuity / provenance', () => {
    const out = collectInstitutionalObservability(richGraph(), {
      enabled: true,
    })
    expect(out).not.toBeNull()
    expect(out!.substrate.decisions).toBe(3)
    expect(out!.substrate.edges).toBe(1)
    expect(out!.substrate.nodes).toBe(0)
    expect(out!.timeline.entries).toBeGreaterThan(0)
    expect(out!.evidence.entries).toBe(3)
    expect(out!.continuity.entries).toBeGreaterThan(0)
    expect(out!.provenance.totalDecisions).toBe(3)
    expect(out!.provenance.decisionsWithEvidence).toBe(2)
    expect(out!.provenance.decisionsWithKnowledge).toBe(1)
    expect(out!.provenance.decisionsWithPolicy).toBe(1)
    expect(out!.provenance.decisionsWithLineage).toBeGreaterThan(0)
  })

  it('exposes ONLY counts and labels — no ratios, scores, weights, or rankings', () => {
    const out = collectInstitutionalObservability(richGraph(), {
      enabled: true,
    })!
    const forbiddenKeys = [
      'score',
      'rank',
      'ranking',
      'weight',
      'ratio',
      'percent',
      'percentage',
      'average',
      'mean',
      'efficiency',
      'stability',
      'caucus',
      'prediction',
      'forecast',
      'recommendation',
      'trustScore',
    ]
    const blob = JSON.stringify(out).toLowerCase()
    for (const k of forbiddenKeys) {
      expect(blob.includes(k.toLowerCase())).toBe(false)
    }
  })

  it('produces deterministic counts across repeated invocations on the same graph', () => {
    const g = richGraph()
    const a = collectInstitutionalObservability(g, { enabled: true })!
    const b = collectInstitutionalObservability(g, { enabled: true })!
    expect(a.substrate).toEqual(b.substrate)
    expect(a.timeline).toEqual(b.timeline)
    expect(a.evidence).toEqual(b.evidence)
    expect(a.continuity).toEqual(b.continuity)
    expect(a.provenance).toEqual(b.provenance)
  })
})

// ── Doctrine fence ────────────────────────────────────────────────────────

describe('Phase 4 — observability doctrine fence', () => {
  it('redacts protected decisions before counting them', () => {
    const protectedCategory = IGG_PROTECTED_DECISION_CATEGORIES[0]
    const protectedKind = IGG_PROTECTED_EVENT_KINDS[0]
    expect(protectedCategory).toBeDefined()
    expect(protectedKind).toBeDefined()

    const decisions = [
      decision('d-ok', 'org-1', '2024-01-01T00:00:00Z', 'motion_outcome', {
        evidence: ['ev-1'],
      }),
      decision(
        'd-protected',
        'org-1',
        '2024-02-01T00:00:00Z',
        protectedCategory!,
        { evidence: ['ev-x'] },
        protectedKind!,
      ),
    ]
    const out = collectInstitutionalObservability(
      { decisions },
      { enabled: true },
    )!
    // Only the non-protected decision should survive the substrate fence.
    expect(out.substrate.decisions).toBe(1)
    expect(out.provenance.totalDecisions).toBe(1)
    expect(out.evidence.entries).toBe(1)
  })
})
