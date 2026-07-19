import { describe, expect, it } from 'vitest'
import {
  generateCapitalDirectionMemo,
  generateTodayTopFive,
  generateUrgentRiskDigest,
} from './chief-of-staff'
import type { Alert } from './automations'
import type { AllocationScore } from './allocation-engine'
import type { Opportunity, Task, Venture, DependencyScore } from './types'

const NOW = '2026-04-28T12:00:00.000Z'

describe('generateTodayTopFive', () => {
  it('returns inbox-zero summary when nothing pending', () => {
    const out = generateTodayTopFive({
      now: NOW,
      tasks: [],
      opportunities: [],
      alerts: [],
      founderUserId: 'u-f',
    })
    expect(out.bullets.length).toBe(0)
    expect(out.summary).toContain('Inbox zero')
  })

  it('ranks critical alerts above founder-touch deals above overdue tasks', () => {
    const alerts: Alert[] = [
      { id: 'a1', severity: 'critical', title: 'MRR drop', detail: '20%', ventureSlug: 'alpha', suggestedAction: 'investigate', ruleCode: 'MRR_DROP_MOM' },
    ]
    const opps: Opportunity[] = [
      {
        id: 'o1',
        name: 'Big deal',
        ventureSlug: 'alpha',
        organizationId: 'org-1',
        ownerUserId: 'u-f',
        stage: 'negotiation',
        probability: 0.8,
        estimatedValueCents: 100_000_00,
        nextAction: 'send proposal',
        daysStale: 5,
        blockers: [],
        expectedCloseAt: null,
        founderTouchRequired: true,
      },
    ]
    const tasks: Task[] = [
      {
        id: 't1',
        title: 'Approve PR',
        context: '',
        queue: 'founder-decisions',
        ownerUserId: 'u-f',
        dueAt: '2026-04-20T00:00:00.000Z', // 8 days overdue
        status: 'open',
        ventureSlug: 'alpha',
        opportunityId: null,
      },
    ]
    const out = generateTodayTopFive({
      now: NOW,
      tasks,
      opportunities: opps,
      alerts,
      founderUserId: 'u-f',
    })
    expect(out.bullets.length).toBeLessThanOrEqual(5)
    expect(out.bullets[0]).toContain('MRR drop') // critical wins
  })
})

describe('generateUrgentRiskDigest', () => {
  it('groups critical alerts and red dependencies', () => {
    const ventures: Venture[] = []
    const deps: DependencyScore[] = [
      { ventureSlug: 'alpha', score: 85, signal: 'red', reasons: ['Founder owns 90% of tasks'], computedAt: NOW },
    ]
    const alerts: Alert[] = [
      { id: 'a1', severity: 'critical', title: 'Cash low', detail: '<6mo runway', ventureSlug: null, suggestedAction: 'raise', ruleCode: 'MRR_DROP_MOM' },
    ]
    const out = generateUrgentRiskDigest({ now: NOW, alerts, dependencyScores: deps, ventures })
    expect(out.markdown).toContain('Founder-dependency RED')
    expect(out.summary).toContain('1 critical alert(s), 1 dependency-RED')
  })
})

describe('generateCapitalDirectionMemo', () => {
  it('groups by recommendation', () => {
    const scores: AllocationScore[] = [
      { ventureSlug: 'alpha', composite: 80, recommendation: 'invest-more', signal: 'green', axes: {} as unknown, reasons: ['strong'], computedAt: NOW },
      { ventureSlug: 'beta', composite: 25, recommendation: 'pause', signal: 'red', axes: {} as unknown, reasons: ['weak'], computedAt: NOW },
    ]
    const out = generateCapitalDirectionMemo({ now: NOW, scores })
    expect(out.markdown).toContain('alpha')
    expect(out.markdown).toContain('Where to pause')
    expect(out.summary).toContain('1 invest-more')
  })
})
