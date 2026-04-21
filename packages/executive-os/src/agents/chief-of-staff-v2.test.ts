import { describe, expect, it } from 'vitest'
import { chiefOfStaffV2Agent, type CosV2Signal } from './chief-of-staff-v2.js'

const base = (overrides: Partial<CosV2Signal> = {}): CosV2Signal => ({
  recentInsights: [],
  agentRuns: [],
  ...overrides,
})

const req = (input: CosV2Signal) => ({
  orgId: 'org-1',
  triggeredBy: 'manual' as const,
  now: new Date('2026-04-21T12:00:00Z'),
  input,
})

describe('chiefOfStaffV2Agent', () => {
  it('nominal when nothing to synthesize', async () => {
    const r = await chiefOfStaffV2Agent.run(req(base()))
    expect(r.insights).toHaveLength(0)
    expect(r.summary).toMatch(/All agents green/)
  })

  it('surfaces cross-domain criticals + operating-review action', async () => {
    const r = await chiefOfStaffV2Agent.run(req(base({
      recentInsights: [
        { agentKey: 'audit', domain: 'governance', title: 'Broken chain', severity: 'critical', confidence: 0.9, createdAt: '2026-04-20T10:00:00Z' },
        { agentKey: 'treasury', domain: 'finance', title: 'Runway <60d', severity: 'critical', confidence: 0.95, createdAt: '2026-04-19T10:00:00Z' },
      ],
    })))
    expect(r.insights.some((i) => i.severity === 'critical' && i.title.includes('critical signal'))).toBe(true)
    expect(r.actions.some((a) => a.title.includes('Operating-review'))).toBe(true)
  })

  it('flags warn-load when >10 warnings', async () => {
    const recent = Array.from({ length: 12 }, (_, i) => ({
      agentKey: 'x', domain: 'operations' as const, title: `warn ${i}`, severity: 'warn' as const, confidence: 0.7, createdAt: '2026-04-20T10:00:00Z',
    }))
    const r = await chiefOfStaffV2Agent.run(req(base({ recentInsights: recent })))
    expect(r.insights.some((i) => i.title.includes('warnings open'))).toBe(true)
  })

  it('flags silent agents as blind spots', async () => {
    const r = await chiefOfStaffV2Agent.run(req(base({
      agentRuns: [
        { agentKey: 'tax', domain: 'finance', lastRunAt: null, ageDays: null },
        { agentKey: 'fpa', domain: 'finance', lastRunAt: '2026-03-01T00:00:00Z', ageDays: 50 },
      ],
      silentAgentDays: 7,
    })))
    expect(r.insights.some((i) => i.title.includes('silent'))).toBe(true)
  })

  it('clusters recurring keywords across agents', async () => {
    const r = await chiefOfStaffV2Agent.run(req(base({
      recentInsights: [
        { agentKey: 'a', domain: 'finance', title: 'Runway below threshold', severity: 'critical', confidence: 0.9, createdAt: '2026-04-20T10:00:00Z' },
        { agentKey: 'b', domain: 'portfolio', title: 'Runway drift detected', severity: 'warn', confidence: 0.7, createdAt: '2026-04-20T10:00:00Z' },
      ],
    })))
    expect(r.insights.some((i) => i.title.includes('recurring theme'))).toBe(true)
  })

  it('detects net-new criticals vs previous synthesis', async () => {
    const r = await chiefOfStaffV2Agent.run(req(base({
      recentInsights: [
        { agentKey: 'a', domain: 'finance', title: 'Old issue', severity: 'critical', confidence: 0.9, createdAt: '2026-04-20T10:00:00Z' },
        { agentKey: 'b', domain: 'platform', title: 'Brand new issue', severity: 'critical', confidence: 0.9, createdAt: '2026-04-20T10:00:00Z' },
      ],
      previousCriticalTitles: ['Old issue'],
    })))
    expect(r.insights.some((i) => i.title.includes('new critical'))).toBe(true)
  })
})
