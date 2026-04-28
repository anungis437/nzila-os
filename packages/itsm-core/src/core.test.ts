import { describe, expect, it } from 'vitest'
import {
  computeAssetRiskScore,
  computeMttr,
  computeSlaAttainment,
  computeSlaDueDates,
  DEFAULT_SLA_TARGETS,
  evaluateAutomationRules,
  generateTicketNumber,
  isSlaBreached,
  minutesUntilBreach,
  ticketNumberPrefix,
  VIP_P1_ESCALATION_TEMPLATE,
} from './index'

describe('itsm-core', () => {
  it('generates ticket identifiers with expected prefixes and padding', () => {
    expect(generateTicketNumber('incident', 7)).toBe('INC-0007')
    expect(generateTicketNumber('change_request', 42)).toBe('CHG-0042')
    expect(ticketNumberPrefix('problem')).toBe('PRB')
  })

  it('computes SLA due dates and breach calculations', () => {
    const now = new Date('2026-01-01T00:00:00.000Z')
    const due = computeSlaDueDates('p1_critical', DEFAULT_SLA_TARGETS, now)

    expect(due.responseDue).toBe('2026-01-01T00:15:00.000Z')
    expect(due.resolutionDue).toBe('2026-01-01T04:00:00.000Z')
    expect(isSlaBreached(due.resolutionDue, 'open', new Date('2026-01-01T05:00:00.000Z'))).toBe(true)
    expect(minutesUntilBreach(due.resolutionDue, new Date('2026-01-01T03:00:00.000Z'))).toBe(60)
  })

  it('computes attainment and MTTR for ticket cohorts', () => {
    expect(computeSlaAttainment([{ slaBreached: false }, { slaBreached: true }, { slaBreached: false }])).toBe(67)

    const mttr = computeMttr([
      { createdAt: '2026-01-01T00:00:00.000Z', resolvedAt: '2026-01-01T01:00:00.000Z' },
      { createdAt: '2026-01-01T02:00:00.000Z', resolvedAt: '2026-01-01T04:00:00.000Z' },
      { createdAt: '2026-01-01T06:00:00.000Z', resolvedAt: null },
    ])
    expect(mttr).toBe(90)
  })

  it('scores asset risk with lifecycle, incidents, and vulnerability signals', () => {
    const score = computeAssetRiskScore(
      {
        lifecycle: 'retired',
        warrantyExpiry: '2025-01-01T00:00:00.000Z',
        purchaseDate: '2018-01-01T00:00:00.000Z',
        openIncidentCount: 5,
        vulnerabilityScore: 80,
      },
      new Date('2026-01-01T00:00:00.000Z'),
    )

    expect(score).toBe(100)
  })

  it('triggers automation templates when conditions match', () => {
    const rules = [
      {
        ...VIP_P1_ESCALATION_TEMPLATE,
        id: 'rule-1',
        orgId: 'org-1',
      },
    ]

    const fired = evaluateAutomationRules(rules, {
      priority: 'p1_critical',
      tags: 'vip',
    })

    expect(fired).toHaveLength(1)
    expect(fired[0].ruleName).toContain('VIP P1')
    expect(fired[0].actions.length).toBeGreaterThan(0)
  })
})
