import { describe, it, expect, vi } from 'vitest'
import { createPrioritizationEngine } from '../../src/engine/prioritizationEngine.js'
import { createWorkloadOrchestrator } from '../../src/orchestration/workloadOrchestrator.js'
import { toPanelData, getConfidenceIndicator } from '../../src/contracts/ui.js'
import { generateExplanation } from '../../src/explanations/generateExplanation.js'
import type { WorkItem } from '../../src/models/types.js'

// ─── Helpers ─────────────────────────────────────────────────────

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 'item-1',
    orgId: 'org-1',
    type: 'grievance',
    title: 'Test item',
    createdAt: new Date().toISOString(),
    stakeholders: ['steward-1'],
    urgencySignals: [],
    riskSignals: [],
    strategicSignals: [],
    metadata: {},
    ...overrides,
  }
}

// ─── Edge Cases ──────────────────────────────────────────────────

describe('edge cases', () => {
  describe('high risk vs high urgency conflict', () => {
    it('degrades confidence when signals conflict', async () => {
      const engine = createPrioritizationEngine(null)

      // High risk, no urgency
      const conflictItem = makeItem({
        id: 'conflicted',
        riskSignals: [{ type: 'legal', severity: 'high' }],
        urgencySignals: [],
        // No deadline → low urgency, but high risk
      })

      // Aligned signals — both high
      const alignedItem = makeItem({
        id: 'aligned',
        riskSignals: [{ type: 'legal', severity: 'high' }],
        urgencySignals: [{ type: 'escalation', weight: 0.9 }],
        dueAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
      })

      const items = [conflictItem, alignedItem]
      const result = await engine.prioritize('org-1', items)

      const conflicted = result.find((r) => r.id === 'conflicted')!
      const aligned = result.find((r) => r.id === 'aligned')!

      // Conflicting signals should have lower confidence
      expect(conflicted.confidence).toBeLessThan(aligned.confidence)
    })
  })

  describe('empty signals', () => {
    it('returns low confidence for items with no signals', async () => {
      const engine = createPrioritizationEngine(null)
      const item = makeItem({
        urgencySignals: [],
        riskSignals: [],
        strategicSignals: [],
      })

      const result = await engine.prioritize('org-1', [item])
      expect(result[0]!.confidence).toBeLessThanOrEqual(0.42)
      expect(result[0]!.priorityLevel).toBe('low')
    })
  })

  describe('overload scenario (10+ items)', () => {
    it('handles 15 items correctly and returns sorted results', async () => {
      const engine = createPrioritizationEngine(null)

      const items: WorkItem[] = Array.from({ length: 15 }, (_, i) =>
        makeItem({
          id: `item-${i}`,
          title: `Work item ${i}`,
          stakeholders: ['steward-1', 'steward-2'],
          riskSignals:
            i < 3 ? [{ type: 'legal', severity: 'high' }] : [],
          urgencySignals:
            i < 5
              ? [{ type: 'escalation', weight: 0.8 - i * 0.1 }]
              : [],
          dueAt:
            i < 5
              ? new Date(Date.now() + (i + 1) * 12 * 3600_000).toISOString()
              : undefined,
        }),
      )

      const result = await engine.prioritize('org-1', items)

      expect(result).toHaveLength(15)
      // First results should be the high-risk items with escalation
      expect(result[0]!.priorityScore).toBeGreaterThanOrEqual(result[1]!.priorityScore)
      // Verify monotonically descending scores
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1]!.priorityScore).toBeGreaterThanOrEqual(result[i]!.priorityScore)
      }
    })

    it('saturation increases for overlapping stakeholders', async () => {
      const engine = createPrioritizationEngine(null)

      // All share the same stakeholder → saturation should be high
      const items: WorkItem[] = Array.from({ length: 8 }, (_, i) =>
        makeItem({
          id: `item-${i}`,
          stakeholders: ['shared-steward'],
          riskSignals: [{ type: 'legal', severity: 'medium' }],
        }),
      )

      const result = await engine.prioritize('org-1', items)

      // With 7 overlapping items, saturation should be at or near max (7/5 = 1.0 capped)
      // This should boost scores compared to isolated items
      const isolatedItem = makeItem({
        id: 'isolated',
        orgId: 'org-2',
        stakeholders: ['unique-steward'],
        riskSignals: [{ type: 'legal', severity: 'medium' }],
      })
      const isolatedResult = await engine.prioritize('org-2', [isolatedItem])

      // Items with saturation should score higher than isolated
      expect(result[0]!.priorityScore).toBeGreaterThan(isolatedResult[0]!.priorityScore)
    })
  })

  describe('overdue items', () => {
    it('overdue items get maximum urgency', async () => {
      const engine = createPrioritizationEngine(null)
      const overdueItem = makeItem({
        id: 'overdue',
        dueAt: new Date(Date.now() - 48 * 3600_000).toISOString(), // 2 days ago
      })
      const futureItem = makeItem({
        id: 'future',
        dueAt: new Date(Date.now() + 7 * 24 * 3600_000).toISOString(),
      })

      const result = await engine.prioritize('org-1', [overdueItem, futureItem])
      expect(result[0]!.id).toBe('overdue')
    })
  })

  describe('all item types', () => {
    it('handles every work item type', async () => {
      const engine = createPrioritizationEngine(null)
      const types = [
        'grievance', 'member_call', 'committee',
        'bargaining', 'arbitration', 'settlement', 'admin',
      ] as const

      const items = types.map((type, i) =>
        makeItem({ id: `${type}-${i}`, type }),
      )

      const result = await engine.prioritize('org-1', items)
      expect(result).toHaveLength(types.length)
    })
  })
})

// ─── Orchestrator Edge Cases ─────────────────────────────────────

describe('workloadOrchestrator', () => {
  it('throws on missing orgId', async () => {
    const source = { fetchActiveWorkItems: vi.fn() }
    const orchestrator = createWorkloadOrchestrator(source)

    await expect(
      orchestrator.generatePriorityQueue(''),
    ).rejects.toThrow('orgId is required')
  })

  it('handles source returning empty array', async () => {
    const source = {
      fetchActiveWorkItems: vi.fn().mockResolvedValue([]),
    }
    const orchestrator = createWorkloadOrchestrator(source)
    const result = await orchestrator.generatePriorityQueue('org-1')

    expect(result.items).toEqual([])
    expect(result.totalProcessed).toBe(0)
    expect(result.orgId).toBe('org-1')
  })

  it('getTopPriorities returns at most N items', async () => {
    const items = Array.from({ length: 10 }, (_, i) =>
      makeItem({
        id: `item-${i}`,
        riskSignals: [{ type: 'legal', severity: i < 3 ? 'high' : 'low' }],
      }),
    )
    const source = {
      fetchActiveWorkItems: vi.fn().mockResolvedValue(items),
    }
    const orchestrator = createWorkloadOrchestrator(source)
    const topThree = await orchestrator.getTopPriorities('org-1', 3)

    expect(topThree).toHaveLength(3)
  })
})

// ─── Explanation Edge Cases ──────────────────────────────────────

describe('generateExplanation', () => {
  it('produces fallback for items with no elevated signals', () => {
    const item = makeItem()
    const signals = { urgency: 0.1, risk: 0.1, strategic: 0.1, saturation: 0.1 }
    const { explanation, contributingFactors } = generateExplanation(item, signals, 0.1)

    expect(explanation).toBeTruthy()
    expect(contributingFactors.length).toBeGreaterThanOrEqual(1)
  })

  it('includes deadline info when urgency is high', () => {
    const item = makeItem({
      dueAt: new Date(Date.now() + 3 * 3600_000).toISOString(),
    })
    const signals = { urgency: 0.9, risk: 0.1, strategic: 0.1, saturation: 0.1 }
    const { contributingFactors } = generateExplanation(item, signals, 0.7)

    expect(contributingFactors.some((f) => f.includes('hours') || f.includes('Deadline'))).toBe(true)
  })
})

// ─── UI Contract Edge Cases ──────────────────────────────────────

describe('UI contracts', () => {
  it('toPanelData limits to 3 items', () => {
    const result = {
      orgId: 'org-1',
      items: Array.from({ length: 10 }, (_, i) => ({
        id: `item-${i}`,
        priorityScore: 0.9 - i * 0.05,
        priorityLevel: 'high' as const,
        explanation: 'Test explanation',
        confidence: 0.7,
        contributingFactors: ['Factor A'],
        auditId: `audit-${i}`,
      })),
      generatedAt: new Date().toISOString(),
      totalProcessed: 10,
      averageConfidence: 0.7,
    }

    const data = toPanelData(result)
    expect(data).toHaveLength(3)
    expect(data[0]!.rank).toBe(1)
    expect(data[2]!.rank).toBe(3)
  })

  it('getConfidenceIndicator maps correctly', () => {
    expect(getConfidenceIndicator(0.85).level).toBe('strong')
    expect(getConfidenceIndicator(0.85).color).toBe('green')

    expect(getConfidenceIndicator(0.55).level).toBe('moderate')
    expect(getConfidenceIndicator(0.55).color).toBe('amber')

    expect(getConfidenceIndicator(0.2).level).toBe('weak')
    expect(getConfidenceIndicator(0.2).color).toBe('red')
  })
})
