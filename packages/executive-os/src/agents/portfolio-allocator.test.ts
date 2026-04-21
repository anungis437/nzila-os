import { describe, expect, it } from 'vitest'
import { portfolioAllocatorAgent, type PortfolioSignal } from './portfolio-allocator'

const base = (overrides: Partial<PortfolioSignal> = {}): PortfolioSignal => ({
  initiatives: [],
  ...overrides,
})

const req = (input: PortfolioSignal, now = new Date('2026-04-21T12:00:00Z')) => ({
  orgId: 'org-1',
  triggeredBy: 'manual' as const,
  now,
  input,
})

describe('portfolioAllocatorAgent', () => {
  it('nominal when empty', async () => {
    const r = await portfolioAllocatorAgent.run(req(base()))
    expect(r.insights).toHaveLength(0)
    expect(r.summary).toMatch(/balanced/)
  })

  it('flags overdue in-progress as critical + action', async () => {
    const r = await portfolioAllocatorAgent.run(
      req(base({
        initiatives: [
          { id: 'i1', title: 'X', venture: 'v', zone: 'z', owner: 'A', status: 'in-progress', dueDate: '2026-01-01', urgent: false, ageDays: 50 },
        ],
      })),
    )
    expect(r.insights.some((i) => i.severity === 'critical')).toBe(true)
    expect(r.actions).toHaveLength(1)
  })

  it('flags ownerless in-progress', async () => {
    const r = await portfolioAllocatorAgent.run(
      req(base({
        initiatives: [
          { id: 'i1', title: 'X', venture: 'v', zone: 'z', owner: null, status: 'in-progress', dueDate: null, urgent: false, ageDays: 1 },
        ],
      })),
    )
    expect(r.insights.some((i) => i.title.toLowerCase().includes('without an owner'))).toBe(true)
  })

  it('flags venture over concurrency cap', async () => {
    const inits = Array.from({ length: 7 }, (_, i) => ({
      id: `i${i}`, title: `T${i}`, venture: 'agri', zone: 'z', owner: 'A',
      status: 'in-progress' as const, dueDate: null, urgent: false, ageDays: 1,
    }))
    const r = await portfolioAllocatorAgent.run(req(base({ initiatives: inits, maxConcurrentInProgress: 5 })))
    expect(r.insights.some((i) => i.title.includes('agri') && i.title.includes('7'))).toBe(true)
  })

  it('flags missing required zone', async () => {
    const r = await portfolioAllocatorAgent.run(
      req(base({
        initiatives: [
          { id: 'i1', title: 'X', venture: 'v', zone: 'build', owner: 'A', status: 'in-progress', dueDate: null, urgent: false, ageDays: 1 },
        ],
        requiredZones: ['build', 'ship'],
      })),
    )
    expect(r.insights.some((i) => i.title.includes('ship'))).toBe(true)
  })
})
