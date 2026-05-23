/**
 * Tests for continuity-intelligence-foundations (Wave 2 scaffolding).
 *
 * These tests assert:
 *   1. The pure derivations behave correctly on representative inputs.
 *   2. The protected-fence is enforced at the foundation boundary.
 */
import { describe, expect, it } from 'vitest'

import type { ContinuityEntry, SuccessionBreakpoint } from './continuity'
import {
  CONTINUITY_INTELLIGENCE_FOUNDATIONS_VERSION,
  deriveContinuityBreakpoints,
  deriveInstitutionalMemoryGaps,
  deriveLineageBreaks,
  deriveUnresolvedTransitions,
} from './continuity-intelligence-foundations'
import { IGG_PROTECTED_DECISION_CATEGORIES, IGG_PROTECTED_EVENT_KINDS } from './protected'

function entry(over: Partial<ContinuityEntry> = {}): ContinuityEntry {
  return {
    occurredAt: '2026-01-01T00:00:00.000Z',
    kind: 'role_tenure_event',
    entityRef: 'ent_1',
    summary: 'Role tenure opened',
    status: 'open',
    ...over,
  }
}

function breakpoint(over: Partial<SuccessionBreakpoint> = {}): SuccessionBreakpoint {
  return {
    occurredAt: '2026-02-01T00:00:00.000Z',
    edgeId: 'edge_1',
    predecessorEntityId: 'ent_a',
    successorEntityId: 'ent_b',
    ...over,
  }
}

describe('continuity-intelligence-foundations', () => {
  it('exports a stable scaffolding version', () => {
    expect(CONTINUITY_INTELLIGENCE_FOUNDATIONS_VERSION).toMatch(/wave2-scaffold/)
  })

  describe('deriveUnresolvedTransitions', () => {
    it('returns transitions with no matching close on the same entity', () => {
      const out = deriveUnresolvedTransitions([
        entry({ entityRef: 'ent_1', status: 'open' }),
        entry({ entityRef: 'ent_2', status: 'open' }),
        entry({ entityRef: 'ent_2', status: 'closed' }),
      ])
      expect(out).toHaveLength(1)
      expect(out[0]!.entityRef).toBe('ent_1')
    })

    it('ignores succession breakpoints and cba ratifications', () => {
      const out = deriveUnresolvedTransitions([
        entry({ kind: 'succession_breakpoint', entityRef: 'ent_x' }),
        entry({ kind: 'cba_ratified', entityRef: 'ent_y' }),
      ])
      expect(out).toHaveLength(0)
    })

    it('throws if any protected event kind leaks through', () => {
      const leaked = entry({
        kind: 'role_tenure_event',
        // simulate upstream forgetting to redact
        category: IGG_PROTECTED_DECISION_CATEGORIES[0]!,
      }) as ContinuityEntry
      expect(() => deriveUnresolvedTransitions([leaked])).toThrowError(
        /Protected governance semantics leaked/,
      )
    })
  })

  describe('deriveContinuityBreakpoints', () => {
    it('marks bracketed breakpoints when memory ref present', () => {
      const out = deriveContinuityBreakpoints([breakpoint()], new Set(['ent_a']))
      expect(out[0]!.hasInstitutionalMemoryRef).toBe(true)
    })

    it('marks unbracketed breakpoints when no memory ref present', () => {
      const out = deriveContinuityBreakpoints([breakpoint()], new Set())
      expect(out[0]!.hasInstitutionalMemoryRef).toBe(false)
    })
  })

  describe('deriveLineageBreaks', () => {
    it('returns no_predecessor_record when predecessor cohort absent', () => {
      const out = deriveLineageBreaks([breakpoint()], new Map([['ent_b', new Set(['c1'])]]))
      expect(out[0]!.reason).toBe('no_predecessor_record')
    })

    it('returns no_successor_record when successor cohort absent', () => {
      const out = deriveLineageBreaks([breakpoint()], new Map([['ent_a', new Set(['c1'])]]))
      expect(out[0]!.reason).toBe('no_successor_record')
    })

    it('returns no_shared_cohort when cohorts disjoint', () => {
      const out = deriveLineageBreaks(
        [breakpoint()],
        new Map([
          ['ent_a', new Set(['c1'])],
          ['ent_b', new Set(['c2'])],
        ]),
      )
      expect(out[0]!.reason).toBe('no_shared_cohort')
    })

    it('returns empty when cohorts intersect', () => {
      const out = deriveLineageBreaks(
        [breakpoint()],
        new Map([
          ['ent_a', new Set(['c1', 'shared'])],
          ['ent_b', new Set(['c2', 'shared'])],
        ]),
      )
      expect(out).toHaveLength(0)
    })
  })

  describe('deriveInstitutionalMemoryGaps', () => {
    it('flags entries missing evidence, knowledge, or policy refs', () => {
      const out = deriveInstitutionalMemoryGaps(
        [entry({ entityRef: 'ent_1' })],
        new Map(),
      )
      expect(out).toHaveLength(1)
      expect(out[0]!.missing).toEqual(['evidence', 'knowledge', 'policy'])
    })

    it('returns no gap when all categories present', () => {
      const out = deriveInstitutionalMemoryGaps(
        [entry({ entityRef: 'ent_1' })],
        new Map([
          [
            'ent_1',
            {
              evidence: new Set(['e1']),
              knowledge: new Set(['k1']),
              policy: new Set(['p1']),
            },
          ],
        ]),
      )
      expect(out).toHaveLength(0)
    })

    it('throws if a protected event kind leaks through', () => {
      const leaked = entry({
        kind: IGG_PROTECTED_EVENT_KINDS[0]! as ContinuityEntry['kind'],
      }) as ContinuityEntry
      expect(() => deriveInstitutionalMemoryGaps([leaked], new Map())).toThrowError(
        /Protected governance semantics leaked/,
      )
    })
  })
})
