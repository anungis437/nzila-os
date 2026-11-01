import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const { loadCognitionMemory } = vi.hoisted(() => ({ loadCognitionMemory: vi.fn() }))
vi.mock('@/lib/knowledge-transfer/cognition-memory/memory-store', () => ({ loadCognitionMemory }))
vi.mock('@/lib/knowledge-transfer/governance/interview-access', () => ({ derivedAnalyticsCondition: () => 'condition' }))
vi.mock('@/db/db', () => ({ db: {} }))
vi.mock('@/db/schema', () => ({ exitInterviews: {} }))
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }))

import { categorize, tagHasKeyword } from '@/lib/knowledge-transfer/topic-graph/topic-graph-builder'
import { trackMitigationEffectiveness } from '@/lib/knowledge-transfer/mitigation-effectiveness/effectiveness-tracker'
import { PROVENANCE_KEY } from '@/lib/knowledge-transfer/cognition-memory/memory-models'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

const entry = (id: string, memoryType: string, date: string, score: number | null) => ({
  id, title: id, memoryType, createdAt: `${date}T00:00:00.000Z`, resilienceScoreAtCapture: score, tags: [], sessionId: null,
})

describe('Gate 0 batch B77: honest cognition inputs and outputs', () => {
  describe('topic categories match whole words only', () => {
    it('does not find a keyword inside an unrelated word', () => {
      expect(tagHasKeyword('message board', ['esa'])).toBe(false)
      expect(categorize('stool inventory')).toBe('general')
      expect(categorize('Tuesday agenda')).toBe('general')
    })

    it('still categorizes a keyword as a word, a phrase or a plural', () => {
      expect(categorize('ESA')).toBe('compliance')
      expect(categorize('labour board hearings')).toBe('compliance')
      expect(categorize('payroll tools')).toBe('system')
      expect(categorize('Vendor contract')).toBe('vendor')
      expect(categorize('policy committee')).toBe('governance')
    })
  })

  describe('mitigation effectiveness reads an association, in a window, for one intervention', () => {
    it('reads the next resilience baseline only, never another kind of entry', async () => {
      loadCognitionMemory.mockResolvedValue({
        entries: [
          entry('m1', 'mitigation_comparison', '2026-01-01', 50),
          entry('brief', 'decision_brief', '2026-01-03', 90),
          entry('b1', 'resilience_baseline', '2026-01-10', 60),
        ],
      })
      const report = await trackMitigationEffectiveness('org')
      expect(report.outcomes).toHaveLength(1)
      expect(report.outcomes[0]).toMatchObject({ resilienceAfter: 60, scoreChange: 10 })
      expect(report.attribution).toBe('association_not_causation')
    })

    it('leaves an intervention unverified when the baseline is outside the 90-day window', async () => {
      loadCognitionMemory.mockResolvedValue({
        entries: [entry('m1', 'mitigation_comparison', '2026-01-01', 50), entry('b1', 'resilience_baseline', '2026-06-01', 80)],
      })
      const report = await trackMitigationEffectiveness('org')
      expect(report.outcomes).toHaveLength(0)
      expect(report.unverifiedInterventions[0]).toMatchObject({ id: 'm1', unverifiedReason: 'no_baseline_in_window' })
    })

    it('leaves an intervention unverified when another one was recorded before the baseline', async () => {
      loadCognitionMemory.mockResolvedValue({
        entries: [
          entry('m1', 'mitigation_comparison', '2026-01-01', 50),
          entry('m2', 'continuity_assessment', '2026-01-05', 52),
          entry('b1', 'resilience_baseline', '2026-01-10', 70),
        ],
      })
      const report = await trackMitigationEffectiveness('org')
      expect(report.outcomes.map((o) => o.interventionId)).toEqual(['m2'])
      expect(report.unverifiedInterventions[0]).toMatchObject({ id: 'm1', unverifiedReason: 'other_intervention_in_window' })
    })
  })

  it('stamps each saved memory entry as officer-asserted with its author, and refuses the reserved key and oversize input', () => {
    const store = src('lib/knowledge-transfer/cognition-memory/memory-store.ts')
    expect(store).toContain("[PROVENANCE_KEY]: { source: 'officer_asserted', recordedBy: userId }")
    expect(store).toContain("source: 'officer_asserted' as const")
    expect(PROVENANCE_KEY).toBe('__provenance')
    const route = src('app/api/exit-interviews/cognition-memory/route.ts')
    expect(route).toContain('is reserved')
    expect(route).toContain('payload must be at most 16 KB')
    expect(route).toContain('.max(20)')
  })

  it('computes the governance timeline counts in SQL over the whole window and refuses an oversize interview window', () => {
    const route = src('app/api/exit-interviews/governance-timeline/route.ts')
    expect(route).toContain('.groupBy(exitInterviewEvents.eventType)')
    expect(route).toContain('MAX_INTERVIEWS_IN_WINDOW + 1')
    expect(route).not.toContain('eventTypeCounts[event.eventType]')
  })

  it('verified: the analytics timeline reports no coverage rate or score for an empty month', () => {
    const route = src('app/api/exit-interviews/analytics/route.ts')
    expect(route).toContain('consentCoverageRate: number | null')
    expect(route).toContain('currentExposureScore: number | null')
    expect(route).toContain('MAX_GOVERNANCE_SNAPSHOT_ROWS + 1')
  })
})
