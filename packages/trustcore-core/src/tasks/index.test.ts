import { describe, expect, it } from 'vitest'
import { priorityForSeverity, scheduleFromRisk, slaDeadlineFor } from './index'

const NOW = new Date('2026-01-01T00:00:00.000Z')

describe('priorityForSeverity', () => {
  it('maps severities to priorities', () => {
    expect(priorityForSeverity('critical')).toBe('p0')
    expect(priorityForSeverity('high')).toBe('p1')
    expect(priorityForSeverity('medium')).toBe('p2')
    expect(priorityForSeverity('low')).toBe('p3')
  })
})

describe('slaDeadlineFor', () => {
  it('p0 → +24h', () => {
    expect(slaDeadlineFor('p0', NOW)).toBe('2026-01-02T00:00:00.000Z')
  })
  it('p1 → +72h', () => {
    expect(slaDeadlineFor('p1', NOW)).toBe('2026-01-04T00:00:00.000Z')
  })
  it('p2 → +7 days', () => {
    expect(slaDeadlineFor('p2', NOW)).toBe('2026-01-08T00:00:00.000Z')
  })
  it('p3 → +30 days', () => {
    expect(slaDeadlineFor('p3', NOW)).toBe('2026-01-31T00:00:00.000Z')
  })
})

describe('scheduleFromRisk', () => {
  it('wires riskId, title, priority, dueAt from a seed', () => {
    const t = scheduleFromRisk(
      { riskId: 'r-1', title: 'Patch CVE', severity: 'critical' },
      NOW,
    )
    expect(t).toEqual({
      riskId: 'r-1',
      title: 'Patch CVE',
      priority: 'p0',
      dueAt: '2026-01-02T00:00:00.000Z',
    })
  })
})
