import { describe, it, expect, vi } from 'vitest'
import { createPrioritizationEngine } from '../../src/engine/prioritizationEngine.js'
import { computePriorityScore, scoreToPriorityLevel } from '../../src/scoring/priorityScore.js'
import type { WorkItem, PrioritizedWorkItem } from '../../src/models/types.js'

// ─── Helpers ─────────────────────────────────────────────────────

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'item-1',
    orgId: 'org-1',
    type: 'grievance',
    title: 'Test grievance',
    createdAt: new Date().toISOString(),
    stakeholders: ['steward-1'],
    urgencySignals: [],
    riskSignals: [],
    strategicSignals: [],
    metadata: {},
    ...overrides,
  }
}

const NOW = new Date('2026-04-08T12:00:00Z')

// ─── Priority Score Tests ────────────────────────────────────────

describe('computePriorityScore', () => {
  it('returns 0 for item with no signals and no deadline', () => {
    const item = makeItem()
    const { score } = computePriorityScore(item, [item], undefined, NOW)
    // No deadline → urgency 0.3 baseline, all other signals 0
    // score = 0.30 * 0.3 + 0.35 * 0 + 0.20 * 0 + 0.15 * 0 = 0.09
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(0.15)
  })

  it('scores higher for items with deadline urgency', () => {
    const soon = new Date(NOW.getTime() + 12 * 3600_000).toISOString() // 12h from now
    const later = new Date(NOW.getTime() + 30 * 24 * 3600_000).toISOString() // 30 days

    const urgentItem = makeItem({ id: 'urgent', dueAt: soon })
    const relaxedItem = makeItem({ id: 'relaxed', dueAt: later })
    const items = [urgentItem, relaxedItem]

    const { score: urgentScore } = computePriorityScore(urgentItem, items, undefined, NOW)
    const { score: relaxedScore } = computePriorityScore(relaxedItem, items, undefined, NOW)

    expect(urgentScore).toBeGreaterThan(relaxedScore)
  })

  it('weights risk heavily', () => {
    const highRiskItem = makeItem({
      id: 'risky',
      riskSignals: [{ type: 'legal', severity: 'high' }],
    })
    const lowRiskItem = makeItem({
      id: 'safe',
      riskSignals: [{ type: 'pattern_detected', severity: 'low' }],
    })
    const items = [highRiskItem, lowRiskItem]

    const { score: riskyScore } = computePriorityScore(highRiskItem, items, undefined, NOW)
    const { score: safeScore } = computePriorityScore(lowRiskItem, items, undefined, NOW)

    expect(riskyScore).toBeGreaterThan(safeScore)
  })

  it('includes strategic importance in scoring', () => {
    const strategicItem = makeItem({
      id: 'strategic',
      strategicSignals: [{ type: 'bargaining_phase', impact: 0.9 }],
    })
    const plainItem = makeItem({ id: 'plain' })
    const items = [strategicItem, plainItem]

    const { score: stratScore } = computePriorityScore(strategicItem, items, undefined, NOW)
    const { score: plainScore } = computePriorityScore(plainItem, items, undefined, NOW)

    expect(stratScore).toBeGreaterThan(plainScore)
  })
})

describe('scoreToPriorityLevel', () => {
  it('maps scores to correct levels', () => {
    expect(scoreToPriorityLevel(0.90)).toBe('critical')
    expect(scoreToPriorityLevel(0.75)).toBe('critical')
    expect(scoreToPriorityLevel(0.60)).toBe('high')
    expect(scoreToPriorityLevel(0.50)).toBe('high')
    expect(scoreToPriorityLevel(0.30)).toBe('medium')
    expect(scoreToPriorityLevel(0.10)).toBe('low')
    expect(scoreToPriorityLevel(0.00)).toBe('low')
  })
})

// ─── Prioritization Engine Tests ─────────────────────────────────

describe('createPrioritizationEngine', () => {
  it('returns empty array for empty input', async () => {
    const engine = createPrioritizationEngine(null)
    const result = await engine.prioritize('org-1', [])
    expect(result).toEqual([])
  })

  it('enforces orgId isolation', async () => {
    const engine = createPrioritizationEngine(null)
    const items = [
      makeItem({ id: 'item-1', orgId: 'org-1' }),
      makeItem({ id: 'item-2', orgId: 'org-2' }),
    ]

    const result = await engine.prioritize('org-1', items)
    expect(result).toHaveLength(1)
    expect(result[0]!.id).toBe('item-1')
  })

  it('produces auditId for every item', async () => {
    const engine = createPrioritizationEngine(null)
    const items = [makeItem(), makeItem({ id: 'item-2' })]
    const result = await engine.prioritize('org-1', items)

    for (const item of result) {
      expect(item.auditId).toBeTruthy()
      expect(typeof item.auditId).toBe('string')
    }
  })

  it('sorts by priority score descending', async () => {
    const engine = createPrioritizationEngine(null)
    const items = [
      makeItem({
        id: 'low',
        riskSignals: [],
        urgencySignals: [],
      }),
      makeItem({
        id: 'high',
        riskSignals: [{ type: 'legal', severity: 'high' }],
        urgencySignals: [{ type: 'escalation', weight: 0.9 }],
        dueAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
      }),
    ]

    const result = await engine.prioritize('org-1', items)
    expect(result[0]!.id).toBe('high')
    expect(result[0]!.priorityScore).toBeGreaterThan(result[1]!.priorityScore)
  })

  it('includes human-readable explanation', async () => {
    const engine = createPrioritizationEngine(null)
    const items = [
      makeItem({
        riskSignals: [{ type: 'legal', severity: 'high' }],
      }),
    ]

    const result = await engine.prioritize('org-1', items)
    expect(result[0]!.explanation).toBeTruthy()
    expect(typeof result[0]!.explanation).toBe('string')
  })

  it('integrates NIL reasoning when available', async () => {
    const mockNil = {
      reason: vi.fn().mockResolvedValue({
        success: true,
        explanation: { summary: 'NIL says this is critical due to CBA clause 14.3' },
        confidence: 0.85,
      }),
    }

    const engine = createPrioritizationEngine(mockNil)
    const items = [
      makeItem({
        riskSignals: [{ type: 'legal', severity: 'high' }],
      }),
    ]

    const result = await engine.prioritize('org-1', items)

    expect(mockNil.reason).toHaveBeenCalledOnce()
    expect(result[0]!.explanation).toContain('CBA clause 14.3')
  })

  it('falls back to heuristic when NIL fails', async () => {
    const mockNil = {
      reason: vi.fn().mockRejectedValue(new Error('NIL unavailable')),
    }

    const engine = createPrioritizationEngine(mockNil)
    const items = [
      makeItem({
        riskSignals: [{ type: 'legal', severity: 'high' }],
      }),
    ]

    const result = await engine.prioritize('org-1', items)
    expect(result).toHaveLength(1)
    expect(result[0]!.explanation).toBeTruthy()
  })

  it('competing deadlines: ranks closest deadline higher', async () => {
    const engine = createPrioritizationEngine(null)
    const items = [
      makeItem({
        id: 'tomorrow',
        dueAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
      }),
      makeItem({
        id: 'next-week',
        dueAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
      }),
      makeItem({
        id: 'next-month',
        dueAt: new Date(Date.now() + 30 * 24 * 3600_000).toISOString(),
      }),
    ]

    const result = await engine.prioritize('org-1', items)
    expect(result[0]!.id).toBe('tomorrow')
    expect(result[1]!.id).toBe('next-week')
    expect(result[2]!.id).toBe('next-month')
  })
})
