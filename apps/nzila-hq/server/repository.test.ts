import { describe, expect, it } from 'vitest'
import { getHqRepository } from './repository'

describe('HqRepository', () => {
  const repo = getHqRepository()

  it('returns a populated portfolio snapshot', () => {
    const snap = repo.portfolioSnapshot()
    expect(snap.activeVentures).toBeGreaterThan(0)
    expect(snap.totalMrrCents).toBeGreaterThan(0)
    expect(snap.founderBottleneckScore).toBeGreaterThanOrEqual(0)
    expect(snap.founderBottleneckScore).toBeLessThanOrEqual(100)
  })

  it('computes a dependency score per venture', () => {
    const scores = repo.dependencyScores()
    expect(scores.length).toBe(repo.listVentures().length)
    for (const s of scores) {
      expect(['green', 'amber', 'red']).toContain(s.signal)
    }
  })

  it('produces alerts including stale-deal and founder-overload classes', () => {
    const alerts = repo.alerts()
    const codes = new Set(alerts.map((a) => a.ruleCode))
    // Seed includes a 21-day-stale deal and founder-led tasks.
    expect(codes.has('STALE_DEAL_14D')).toBe(true)
  })

  it('generates a weekly CEO brief with markdown', () => {
    const report = repo.weeklyCeoBrief()
    expect(report.markdown).toContain('# Weekly CEO Brief')
    expect(report.sections.length).toBeGreaterThan(0)
  })
})
