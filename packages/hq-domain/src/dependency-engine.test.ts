import { describe, expect, it } from 'vitest'
import { computeAllDependencyScores, computeFounderBottleneckScore } from './dependency-engine'
import type { Contact, Opportunity, Task, Venture } from './types'

const NOW = '2026-04-28T00:00:00.000Z'
const FOUNDER = 'user-founder'

function venture(overrides: Partial<Venture> = {}): Venture {
  return {
    id: 'v1',
    slug: 'demo',
    name: 'Demo Venture',
    mission: 'Demo',
    icp: 'Anyone',
    ownerUserId: FOUNDER,
    secondOwnerUserId: null,
    stage: 'pilot',
    monthlyRecurringRevenueCents: 0,
    pipelineValueCents: 0,
    weightedPipelineCents: 0,
    pilotsLive: 0,
    blockers: [],
    next30Days: [],
    confidence: 'medium',
    consoleAppId: null,
    externalLinks: {},
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'demo',
    context: '',
    queue: 'operator-actions',
    ownerUserId: FOUNDER,
    dueAt: null,
    status: 'open',
    ventureSlug: 'demo',
    opportunityId: null,
    ...overrides,
  }
}

function opportunity(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: 'o1',
    ventureSlug: 'demo',
    organizationId: 'o',
    name: 'demo',
    stage: 'qualified',
    estimatedValueCents: 100_00,
    probability: 0.5,
    ownerUserId: FOUNDER,
    nextAction: '',
    daysStale: 1,
    blockers: [],
    expectedCloseAt: null,
    founderTouchRequired: false,
    ...overrides,
  }
}

function contact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 'c1',
    organizationId: 'o',
    fullName: 'X',
    title: 'Y',
    email: null,
    phone: null,
    ownerUserId: FOUNDER,
    warmIntroPath: [],
    lastInteractionAt: null,
    nextStep: null,
  }
}

describe('dependency-engine', () => {
  it('returns green for a fully delegated venture with no founder ownership', () => {
    const v = venture({ secondOwnerUserId: 'user-ops', blockers: [] })
    const scores = computeAllDependencyScores({
      founderUserId: FOUNDER,
      ventures: [v],
      opportunities: [opportunity({ ownerUserId: 'user-ops', founderTouchRequired: false })],
      tasks: [task({ ownerUserId: 'user-ops' })],
      contacts: [
        contact({ ownerUserId: 'user-ops', lastInteractionAt: NOW, warmIntroPath: ['user-ops'] }),
      ],
      now: NOW,
    })
    expect(scores).toHaveLength(1)
    expect(scores[0].signal).toBe('green')
    expect(scores[0].score).toBeLessThan(40)
  })

  it('returns red when founder owns everything and has no second owner', () => {
    const v = venture({ secondOwnerUserId: null, blockers: ['Awaiting founder approval'] })
    const scores = computeAllDependencyScores({
      founderUserId: FOUNDER,
      ventures: [v],
      opportunities: [
        opportunity({
          ownerUserId: FOUNDER,
          founderTouchRequired: true,
          estimatedValueCents: 1_000_00,
        }),
        opportunity({
          id: 'o2',
          ownerUserId: FOUNDER,
          founderTouchRequired: true,
          estimatedValueCents: 2_000_00,
        }),
      ],
      tasks: [task({ ownerUserId: FOUNDER }), task({ id: 't2', ownerUserId: FOUNDER })],
      contacts: [contact({ ownerUserId: FOUNDER, lastInteractionAt: null })],
      now: NOW,
    })
    expect(scores[0].signal).toBe('red')
    expect(scores[0].score).toBeGreaterThanOrEqual(70)
    expect(scores[0].reasons.length).toBeGreaterThan(0)
  })

  it('weights bottleneck by venture revenue and pipeline', () => {
    const big = venture({
      slug: 'big',
      monthlyRecurringRevenueCents: 100_000_00,
      weightedPipelineCents: 1_000_000_00,
    })
    const small = venture({
      slug: 'small',
      monthlyRecurringRevenueCents: 100,
      weightedPipelineCents: 100,
    })
    const summary = computeFounderBottleneckScore(
      [
        { ventureSlug: 'big', score: 80, signal: 'red', reasons: [], computedAt: NOW },
        { ventureSlug: 'small', score: 10, signal: 'green', reasons: [], computedAt: NOW },
      ],
      [big, small],
    )
    expect(summary.signal).toBe('red')
    expect(summary.score).toBeGreaterThan(70)
  })

  it('handles empty input', () => {
    const summary = computeFounderBottleneckScore([], [])
    expect(summary).toEqual({ score: 0, signal: 'green' })
  })
})
