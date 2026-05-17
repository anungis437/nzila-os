/**
 * Tests for continuity-cognition (Wave 3).
 *
 * Validates that the pure summary derivations produce the expected shape
 * AND that the protected-fence remains enforced on every callable entry.
 */
import { describe, expect, it } from 'vitest'

import {
  CONTINUITY_COGNITION_VERSION,
  deriveProceduralFragilityRefs,
  deriveSuccessionPathway,
  summarizeContinuityBreakpoints,
  summarizeInstitutionalMemoryGaps,
  summarizeLineageBreaks,
  summarizeUnresolvedTransitions,
} from './continuity-cognition'
import type {
  ContinuityBreakpoint,
  InstitutionalMemoryGap,
  LineageBreak,
  UnresolvedTransition,
} from './continuity-intelligence-foundations'
import { IGG_PROTECTED_EVENT_KINDS } from './protected'

function unresolved(over: Partial<UnresolvedTransition> = {}): UnresolvedTransition {
  return {
    entityRef: 'ent_1',
    openedAt: '2026-01-01T00:00:00.000Z',
    kind: 'role_tenure_event',
    summary: 'opened',
    ...over,
  }
}

function bp(over: Partial<ContinuityBreakpoint> = {}): ContinuityBreakpoint {
  return {
    edgeId: 'edge_1',
    predecessorEntityId: 'ent_a',
    successorEntityId: 'ent_b',
    occurredAt: '2026-02-01T00:00:00.000Z',
    hasInstitutionalMemoryRef: true,
    ...over,
  }
}

function lb(over: Partial<LineageBreak> = {}): LineageBreak {
  return {
    edgeId: 'edge_x',
    predecessorEntityId: 'ent_a',
    successorEntityId: 'ent_b',
    occurredAt: '2026-03-01T00:00:00.000Z',
    reason: 'no_shared_cohort',
    ...over,
  }
}

function gap(over: Partial<InstitutionalMemoryGap> = {}): InstitutionalMemoryGap {
  return {
    entityRef: 'ent_1',
    occurredAt: '2026-01-01T00:00:00.000Z',
    missing: ['evidence'],
    summary: 'gap',
    ...over,
  }
}

describe('continuity-cognition', () => {
  it('exports a version constant', () => {
    expect(CONTINUITY_COGNITION_VERSION).toBe('2026.05-wave3')
  })

  describe('summarizeUnresolvedTransitions', () => {
    it('counts by kind and tracks oldest/newest', () => {
      const s = summarizeUnresolvedTransitions([
        unresolved({ openedAt: '2026-01-01T00:00:00.000Z' }),
        unresolved({ entityRef: 'ent_2', openedAt: '2026-04-01T00:00:00.000Z' }),
        unresolved({
          entityRef: 'ent_3',
          kind: 'affiliation_transition',
          openedAt: '2025-12-01T00:00:00.000Z',
        }),
      ])
      expect(s.totalCount).toBe(3)
      expect(s.byKind['role_tenure_event']).toBe(2)
      expect(s.byKind['affiliation_transition']).toBe(1)
      expect(s.oldestOccurredAt).toBe('2025-12-01T00:00:00.000Z')
      expect(s.newestOccurredAt).toBe('2026-04-01T00:00:00.000Z')
    })

    it('returns zeroes on empty input', () => {
      const s = summarizeUnresolvedTransitions([])
      expect(s.totalCount).toBe(0)
      expect(s.oldestOccurredAt).toBeUndefined()
    })

    it('rejects protected kinds at the boundary', () => {
      expect(() =>
        summarizeUnresolvedTransitions([
          unresolved({
            kind: IGG_PROTECTED_EVENT_KINDS[0] as unknown as UnresolvedTransition['kind'],
          }),
        ]),
      ).toThrow()
    })
  })

  describe('summarizeContinuityBreakpoints', () => {
    it('splits bracketed vs unbracketed', () => {
      const s = summarizeContinuityBreakpoints([
        bp({ hasInstitutionalMemoryRef: true }),
        bp({ edgeId: 'edge_2', hasInstitutionalMemoryRef: false }),
        bp({ edgeId: 'edge_3', hasInstitutionalMemoryRef: false }),
      ])
      expect(s.totalCount).toBe(3)
      expect(s.bracketedCount).toBe(1)
      expect(s.unbracketedCount).toBe(2)
    })
  })

  describe('summarizeLineageBreaks', () => {
    it('counts by reason', () => {
      const s = summarizeLineageBreaks([
        lb({ reason: 'no_shared_cohort' }),
        lb({ edgeId: 'e2', reason: 'no_predecessor_record' }),
        lb({ edgeId: 'e3', reason: 'no_predecessor_record' }),
        lb({ edgeId: 'e4', reason: 'no_successor_record' }),
      ])
      expect(s.totalCount).toBe(4)
      expect(s.byReason.no_shared_cohort).toBe(1)
      expect(s.byReason.no_predecessor_record).toBe(2)
      expect(s.byReason.no_successor_record).toBe(1)
    })
  })

  describe('summarizeInstitutionalMemoryGaps', () => {
    it('aggregates missing-category counts', () => {
      const s = summarizeInstitutionalMemoryGaps([
        gap({ missing: ['evidence', 'knowledge'] }),
        gap({ entityRef: 'ent_2', missing: ['policy'] }),
        gap({ entityRef: 'ent_3', missing: ['evidence', 'policy'] }),
      ])
      expect(s.totalCount).toBe(3)
      expect(s.missingEvidenceCount).toBe(2)
      expect(s.missingKnowledgeCount).toBe(1)
      expect(s.missingPolicyCount).toBe(2)
    })
  })

  describe('deriveSuccessionPathway', () => {
    it('orders breakpoints chronologically and preserves bracketing', () => {
      const p = deriveSuccessionPathway([
        bp({ occurredAt: '2026-05-01T00:00:00.000Z', edgeId: 'e_late' }),
        bp({ occurredAt: '2026-01-01T00:00:00.000Z', edgeId: 'e_early', hasInstitutionalMemoryRef: false }),
      ])
      expect(p[0]!.edgeId).toBe('e_early')
      expect(p[0]!.bracketedByInstitutionalMemory).toBe(false)
      expect(p[1]!.edgeId).toBe('e_late')
      expect(p[1]!.bracketedByInstitutionalMemory).toBe(true)
    })
  })

  describe('deriveProceduralFragilityRefs', () => {
    it('returns entities that appear in at least two signals', () => {
      const refs = deriveProceduralFragilityRefs(
        [unresolved({ entityRef: 'ent_overlap' }), unresolved({ entityRef: 'ent_solo' })],
        [gap({ entityRef: 'ent_overlap' })],
        [lb({ predecessorEntityId: 'ent_z', successorEntityId: 'ent_overlap' })],
      )
      const found = refs.find((r) => r.entityRef === 'ent_overlap')
      expect(found).toBeDefined()
      expect(found!.signals).toContain('unresolved_transition')
      expect(found!.signals).toContain('institutional_memory_gap')
      expect(found!.signals).toContain('lineage_break')
      // ent_solo only appears once → excluded.
      expect(refs.find((r) => r.entityRef === 'ent_solo')).toBeUndefined()
    })

    it('returns empty when no overlap exists', () => {
      const refs = deriveProceduralFragilityRefs(
        [unresolved({ entityRef: 'ent_a' })],
        [gap({ entityRef: 'ent_b' })],
        [],
      )
      expect(refs).toHaveLength(0)
    })
  })
})
