import { describe, it, expect } from 'vitest'
import {
  crossDomainSynthesisAgent,
  synthesizeFindings,
  type SynthesisSignal,
} from './cross-domain-synthesis'

const emptySignal: SynthesisSignal = {
  runwayMonths: null,
  accounts: [],
  incidents: [],
  grants: [],
  portfolio: [],
}

describe('crossDomainSynthesisAgent', () => {
  it('returns empty result on empty signal', async () => {
    const res = await crossDomainSynthesisAgent.run({ orgId: 'o' })
    expect(res.insights).toEqual([])
    expect(res.actions).toEqual([])
    expect(res.summary).toMatch(/no compound/i)
  })

  it('detects churn risk: renewal + bad health + stale QBR', async () => {
    const findings = synthesizeFindings({
      ...emptySignal,
      accounts: [
        {
          accountId: 'a1',
          clientName: 'ACME',
          contractValueCad: 120_000,
          healthScore: 'red',
          renewalInDays: 45,
          openSupportTickets: 2,
          lastQbrDaysAgo: 180,
          overdueArCad: 0,
        },
      ],
    })
    const churn = findings.find((f) => f.id === 'churn-risk:a1')
    expect(churn).toBeDefined()
    expect(churn!.kind).toBe('risk')
    expect(churn!.domains).toContain('revenue')
    expect(churn!.rank.score).toBeGreaterThan(0)
  })

  it('does NOT flag healthy renewals', () => {
    const findings = synthesizeFindings({
      ...emptySignal,
      accounts: [
        {
          accountId: 'a1',
          clientName: 'Healthy Co',
          contractValueCad: 120_000,
          healthScore: 'green',
          renewalInDays: 45,
          openSupportTickets: 1,
          lastQbrDaysAgo: 30,
          overdueArCad: 0,
        },
      ],
    })
    expect(findings.find((f) => f.id.startsWith('churn-risk'))).toBeUndefined()
  })

  it('detects dollars-at-risk: overdue AR + unhealthy account', () => {
    const findings = synthesizeFindings({
      ...emptySignal,
      accounts: [
        {
          accountId: 'a2',
          clientName: 'Late Payer Inc',
          contractValueCad: 50_000,
          healthScore: 'yellow',
          renewalInDays: null,
          openSupportTickets: 0,
          lastQbrDaysAgo: null,
          overdueArCad: 15_000,
        },
      ],
    })
    const ar = findings.find((f) => f.id === 'ar-risk:a2')
    expect(ar).toBeDefined()
    expect(ar!.domains).toContain('finance')
  })

  it('flags premium-account incidents as cross-domain (platform + revenue)', () => {
    const findings = synthesizeFindings({
      ...emptySignal,
      accounts: [
        {
          accountId: 'premium-1',
          clientName: 'BigCo',
          contractValueCad: 250_000,
          healthScore: 'green',
          renewalInDays: 200,
          openSupportTickets: 0,
          lastQbrDaysAgo: 30,
          overdueArCad: 0,
        },
      ],
      incidents: [
        {
          ticketId: 'inc1',
          title: 'API 5xx spike',
          priority: 'p1_critical',
          affectedClientIds: ['premium-1'],
          ageHours: 2,
        },
      ],
    })
    const incFinding = findings.find((f) => f.id === 'incident-premium:inc1')
    expect(incFinding).toBeDefined()
    expect(incFinding!.domains).toEqual(expect.arrayContaining(['platform', 'revenue']))
    // P1 hitting premium should be 'now' or 'today' bucket
    expect(['now', 'today']).toContain(incFinding!.rank.bucket)
  })

  it('elevates grant opportunity when runway is tight', () => {
    const tightRunway = synthesizeFindings({
      ...emptySignal,
      runwayMonths: 3,
      grants: [
        {
          grantId: 'g1',
          programName: 'ISED Fund',
          amountRequestedCad: 100_000,
          daysUntilDeadline: 20,
          stage: 'drafting',
        },
      ],
    })
    const longRunway = synthesizeFindings({
      ...emptySignal,
      runwayMonths: 36,
      grants: [
        {
          grantId: 'g1',
          programName: 'ISED Fund',
          amountRequestedCad: 100_000,
          daysUntilDeadline: 20,
          stage: 'drafting',
        },
      ],
    })
    expect(tightRunway[0].rank.score).toBeGreaterThan(longRunway[0].rank.score)
  })

  it('detects portfolio drag: high founder hours, low revenue, low fit', () => {
    const findings = synthesizeFindings({
      ...emptySignal,
      portfolio: [
        {
          productKey: 'sideProject',
          founderHoursPerWeek: 12,
          revenueContributionCad: 5_000,
          strategicFit: 'low',
        },
      ],
    })
    const drag = findings.find((f) => f.id === 'portfolio-drag:sideProject')
    expect(drag).toBeDefined()
    expect(drag!.kind).toBe('opportunity')
  })

  it('findings are sorted by rank score descending', () => {
    const findings = synthesizeFindings({
      ...emptySignal,
      runwayMonths: 4,
      accounts: [
        {
          accountId: 'a1',
          clientName: 'Small',
          contractValueCad: 5_000,
          healthScore: 'yellow',
          renewalInDays: 80,
          openSupportTickets: 6,
          lastQbrDaysAgo: 200,
          overdueArCad: 0,
        },
        {
          accountId: 'a2',
          clientName: 'Enterprise',
          contractValueCad: 500_000,
          healthScore: 'red',
          renewalInDays: 20,
          openSupportTickets: 10,
          lastQbrDaysAgo: 300,
          overdueArCad: 50_000,
        },
      ],
    })
    for (let i = 1; i < findings.length; i++) {
      expect(findings[i - 1].rank.score).toBeGreaterThanOrEqual(findings[i].rank.score)
    }
  })

  it('agent emits risk + opportunity insights separately', async () => {
    const res = await crossDomainSynthesisAgent.run({
      orgId: 'o',
      input: {
        ...emptySignal,
        runwayMonths: 5,
        accounts: [
          {
            accountId: 'a1',
            clientName: 'ACME',
            contractValueCad: 200_000,
            healthScore: 'red',
            renewalInDays: 30,
            openSupportTickets: 8,
            lastQbrDaysAgo: 200,
            overdueArCad: 10_000,
          },
        ],
        grants: [
          {
            grantId: 'g1',
            programName: 'Grant X',
            amountRequestedCad: 80_000,
            daysUntilDeadline: 15,
            stage: 'drafting',
          },
        ],
      },
    })
    const riskInsight = res.insights.find((i) => /compound risk/i.test(i.title))
    const oppInsight = res.insights.find((i) => /opportunity signal/i.test(i.title))
    expect(riskInsight).toBeDefined()
    expect(oppInsight).toBeDefined()
    // Risk insight should drive actions; ensure at least one action is generated
    expect(res.actions.length).toBeGreaterThan(0)
  })

  it('graceful no-data fallback: all insights empty returns summary only', async () => {
    const res = await crossDomainSynthesisAgent.run({ orgId: 'o', input: emptySignal })
    expect(res.insights).toHaveLength(0)
    expect(res.actions).toHaveLength(0)
  })
})
