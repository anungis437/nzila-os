import { describe, expect, it } from 'vitest'
import { recommendDelegationMoves } from './dependency-2'
import type { Contact, DependencyScore, Task, Venture } from './types'

const NOW = '2026-04-28T12:00:00.000Z'
const FOUNDER = 'u-founder'

const venture = (slug: string, withSecond: boolean): Venture => ({
  id: `v-${slug}`,
  slug,
  name: slug,
  mission: 'm',
  icp: 'i',
  ownerUserId: FOUNDER,
  secondOwnerUserId: withSecond ? 'u-second' : null,
  stage: 'scaling',
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
})

const task = (id: string, slug: string, owner: string): Task => ({
  id,
  title: `task ${id}`,
  context: '',
  queue: 'founder-decisions',
  ownerUserId: owner,
  dueAt: null,
  status: 'open',
  ventureSlug: slug,
  opportunityId: null,
})

const contact = (id: string, owner: string): Contact => ({
  id,
  organizationId: 'org-x',
  fullName: `contact ${id}`,
  title: 'lead',
  email: null,
  phone: null,
  ownerUserId: owner,
  warmIntroPath: [],
  lastInteractionAt: null,
  nextStep: null,
})

const score = (slug: string): DependencyScore => ({
  ventureSlug: slug,
  score: 80,
  signal: 'red',
  reasons: [],
  computedAt: NOW,
})

describe('recommendDelegationMoves', () => {
  it('flags missing second owner as the highest-impact move', () => {
    const moves = recommendDelegationMoves({
      founderUserId: FOUNDER,
      ventures: [venture('alpha', false)],
      tasks: [],
      contacts: [],
      scores: [score('alpha')],
    })
    expect(moves[0].kind).toBe('assign-second-owner')
    expect(moves[0].estimatedScoreReduction).toBe(15)
  })

  it('reassigns founder-owned tasks (max 3 per venture)', () => {
    const tasks = ['t1', 't2', 't3', 't4', 't5'].map((id) => task(id, 'alpha', FOUNDER))
    const moves = recommendDelegationMoves({
      founderUserId: FOUNDER,
      ventures: [venture('alpha', true)],
      tasks,
      contacts: [],
      scores: [score('alpha')],
    })
    const reassigns = moves.filter((m) => m.kind === 'reassign-task')
    expect(reassigns.length).toBe(3)
    expect(reassigns.every((m) => m.suggestedAssigneeUserId === 'u-second')).toBe(true)
  })

  it('skips sunset ventures', () => {
    const v = { ...venture('zed', false), stage: 'sunset' as const }
    const moves = recommendDelegationMoves({
      founderUserId: FOUNDER,
      ventures: [v],
      tasks: [],
      contacts: [],
      scores: [score('zed')],
    })
    expect(moves.length).toBe(0)
  })

  it('surfaces sole-owner contact handovers (top 2)', () => {
    const contacts = ['c1', 'c2', 'c3'].map((id) => contact(id, FOUNDER))
    const moves = recommendDelegationMoves({
      founderUserId: FOUNDER,
      ventures: [venture('alpha', true)],
      tasks: [],
      contacts,
      scores: [score('alpha')],
    })
    const intros = moves.filter((m) => m.kind === 'introduce-relationship')
    expect(intros.length).toBe(2)
  })
})
