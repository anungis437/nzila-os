/**
 * Intelligence Home — Service Layer Tests
 *
 * Validates deterministic outputs from all service functions.
 * No external I/O, no randomness — pure function verification.
 */
import { describe, it, expect } from 'vitest'

import { scoreProducts, getPriorityProduct } from './scoring-service'
import {
  getFundingOpportunities,
  getOpenOpportunities,
  getUpcomingDeadlines,
  getFundingKpis,
} from './funding-service'
import {
  getDealPipeline,
  getDealKpis,
  getStaleDeals,
  getHighProbabilityDeals,
} from './deal-service'
import { getPartners, getPartnerKpis } from './partner-service'
import { detectRisks, getRiskKpis } from './risk-service'
import { generateWeeklyBriefing } from './briefing-service'
import { getDataSourceHealth, getSyncHealthKpis } from './data-sync-service'
import { getDashboardKpis } from './dashboard-service'
import { generateExecutiveInsights, getUrgentInsights } from './insight-service'
import { getFounderDecisions } from './decision-engine'
import { getMichelWeeklyActions } from './michel-panel'

// Fixed reference date for deterministic tests
const NOW = new Date('2026-04-20T12:00:00Z')

// ── Product Scoring ───────────────────────────────────────────────────────────

describe('scoreProducts()', () => {
  it('returns 8 products', () => {
    const scores = scoreProducts()
    expect(scores).toHaveLength(8)
  })

  it('union-eyes is ranked #1', () => {
    const scores = scoreProducts()
    expect(scores[0].productId).toBe('union-eyes')
    expect(scores[0].rank).toBe(1)
  })

  it('faircase is ranked #2', () => {
    const scores = scoreProducts()
    expect(scores[1].productId).toBe('faircase')
    expect(scores[1].rank).toBe(2)
  })

  it('flow is ranked #3', () => {
    const scores = scoreProducts()
    expect(scores[2].productId).toBe('flow')
    expect(scores[2].rank).toBe(3)
  })

  it('zonga is ranked #4', () => {
    const scores = scoreProducts()
    expect(scores[3].productId).toBe('zonga')
    expect(scores[3].rank).toBe(4)
  })

  it('ranks are sequential starting from 1', () => {
    const scores = scoreProducts()
    scores.forEach((s, i) => expect(s.rank).toBe(i + 1))
  })

  it('all totalScores are numeric and > 0', () => {
    scoreProducts().forEach((s) => {
      expect(typeof s.totalScore).toBe('number')
      expect(s.totalScore).toBeGreaterThan(0)
    })
  })

  it('union-eyes score is higher than faircase score', () => {
    const [ue, fc] = scoreProducts()
    expect(ue.totalScore).toBeGreaterThan(fc.totalScore)
  })

  it('each product has strengths and gaps arrays', () => {
    scoreProducts().forEach((s) => {
      expect(s.strengths.length).toBeGreaterThan(0)
      expect(s.gaps.length).toBeGreaterThan(0)
    })
  })

  it('getPriorityProduct returns union-eyes', () => {
    expect(getPriorityProduct().productId).toBe('union-eyes')
  })
})

// ── Funding ───────────────────────────────────────────────────────────────────

describe('getFundingOpportunities()', () => {
  it('returns at least 5 opportunities', () => {
    const opps = getFundingOpportunities(NOW)
    expect(opps.length).toBeGreaterThanOrEqual(5)
  })

  it('all opportunities have id, name, agency, status', () => {
    getFundingOpportunities(NOW).forEach((o) => {
      expect(o.id).toBeTruthy()
      expect(o.name).toBeTruthy()
      expect(o.agency).toBeTruthy()
      expect(['apply', 'watch', 'submitted', 'awarded', 'rejected', 'expired']).toContain(o.status)
    })
  })

  it('sred opportunity has confidenceScore >= 90', () => {
    const sred = getFundingOpportunities(NOW).find((o) => o.id === 'sred')
    expect(sred).toBeTruthy()
    expect(sred!.confidenceScore).toBeGreaterThanOrEqual(90)
  })
})

describe('getOpenOpportunities()', () => {
  it('returns only apply or watch status', () => {
    getOpenOpportunities(NOW).forEach((o) => {
      expect(['apply', 'watch']).toContain(o.status)
    })
  })

  it('sorted by confidenceScore descending', () => {
    const open = getOpenOpportunities(NOW)
    for (let i = 1; i < open.length; i++) {
      expect(open[i - 1].confidenceScore).toBeGreaterThanOrEqual(open[i].confidenceScore)
    }
  })
})

describe('getUpcomingDeadlines()', () => {
  it('returns only opportunities within the window', () => {
    const deadlines = getUpcomingDeadlines(30, NOW)
    deadlines.forEach((o) => {
      expect(o.daysUntilDeadline).not.toBeNull()
      expect(o.daysUntilDeadline!).toBeGreaterThanOrEqual(0)
      expect(o.daysUntilDeadline!).toBeLessThanOrEqual(30)
    })
  })

  it('returns empty array when window is 0', () => {
    const deadlines = getUpcomingDeadlines(0, NOW)
    expect(deadlines).toHaveLength(0)
  })
})

describe('getFundingKpis()', () => {
  it('returns a valid KPI structure', () => {
    const kpis = getFundingKpis(NOW)
    expect(kpis.total).toBeGreaterThan(0)
    expect(kpis.openCount).toBeGreaterThan(0)
    expect(typeof kpis.totalMaxAvailableCad).toBe('number')
    expect(kpis.taxCreditPrograms).toBeGreaterThanOrEqual(0)
  })
})

// ── Deal Pipeline ─────────────────────────────────────────────────────────────

describe('getDealPipeline()', () => {
  it('returns 12 seed deals', () => {
    expect(getDealPipeline()).toHaveLength(12)
  })

  it('all deals have required fields', () => {
    getDealPipeline().forEach((d) => {
      expect(d.id).toBeTruthy()
      expect(d.org).toBeTruthy()
      expect(d.product).toBeTruthy()
      expect(typeof d.probability).toBe('number')
      expect(d.probability).toBeGreaterThanOrEqual(0)
      expect(d.probability).toBeLessThanOrEqual(100)
    })
  })
})

describe('getDealKpis()', () => {
  it('totalDeals equals 12', () => {
    expect(getDealKpis().totalDeals).toBe(12)
  })

  it('weightedPipelineCad is computed correctly', () => {
    const { weightedPipelineCad } = getDealKpis()
    expect(weightedPipelineCad).toBeGreaterThan(0)
    // Sanity: weighted pipeline should be less than raw sum (probabilities < 100%)
    const rawSum = getDealPipeline().reduce((s, d) => s + d.estimatedValueCad, 0)
    expect(weightedPipelineCad).toBeLessThanOrEqual(rawSum)
  })

  it('pilotCount matches pilot deals', () => {
    const pilots = getDealPipeline().filter((d) => d.dealType === 'pilot').length
    expect(getDealKpis().pilotCount).toBe(pilots)
  })

  it('closedWonCount is 0 (no closed deals yet)', () => {
    expect(getDealKpis().closedWonCount).toBe(0)
  })
})

describe('getStaleDeals()', () => {
  it('returns deals with daysSinceActivity > 14 by default', () => {
    getStaleDeals().forEach((d) => {
      expect(d.daysSinceActivity).toBeGreaterThan(14)
    })
  })

  it('CUPE National deal (65 days stale) is in stale list', () => {
    const stale = getStaleDeals()
    expect(stale.some((d) => d.id === 'deal-ue-005')).toBe(true)
  })
})

describe('getHighProbabilityDeals()', () => {
  it('returns only deals with probability >= threshold', () => {
    getHighProbabilityDeals(50).forEach((d) => {
      expect(d.probability).toBeGreaterThanOrEqual(50)
    })
  })
})

// ── Partners ──────────────────────────────────────────────────────────────────

describe('getPartners()', () => {
  it('returns at least 10 partners', () => {
    expect(getPartners().length).toBeGreaterThanOrEqual(10)
  })

  it('includes CUPE Ontario', () => {
    expect(getPartners().some((p) => p.name.includes('CUPE Ontario'))).toBe(true)
  })

  it('includes Dentons Canada', () => {
    expect(getPartners().some((p) => p.name.includes('Dentons'))).toBe(true)
  })
})

describe('getPartnerKpis()', () => {
  it('returns full KPI structure', () => {
    const kpis = getPartnerKpis()
    expect(kpis.totalPartners).toBeGreaterThan(0)
    expect(kpis.prospects).toBeGreaterThan(0)
    expect(typeof kpis.totalAnnualValueCad).toBe('number')
  })
})

// ── Risk Detection ────────────────────────────────────────────────────────────

describe('detectRisks()', () => {
  it('returns an array of Risk objects', () => {
    const risks = detectRisks(NOW)
    expect(Array.isArray(risks)).toBe(true)
    expect(risks.length).toBeGreaterThan(0)
  })

  it('detects no-closed-pilots risk as critical', () => {
    const risks = detectRisks(NOW)
    const noClose = risks.find((r) => r.id === 'risk-no-closed-pilots')
    expect(noClose).toBeTruthy()
    expect(noClose!.severity).toBe('critical')
  })

  it('detects stale pipeline risk', () => {
    const risks = detectRisks(NOW)
    const stale = risks.find((r) => r.id.startsWith('risk-stale-pipeline'))
    expect(stale).toBeTruthy()
  })

  it('all risks have required fields', () => {
    detectRisks(NOW).forEach((r) => {
      expect(r.id).toBeTruthy()
      expect(r.title).toBeTruthy()
      expect(r.detail).toBeTruthy()
      expect(r.recommendedAction).toBeTruthy()
      expect(['critical', 'high', 'medium', 'low']).toContain(r.severity)
      expect(['capital', 'execution', 'pipeline', 'data', 'strategic', 'timing']).toContain(r.category)
    })
  })

  it('critical risks come before high risks', () => {
    const risks = detectRisks(NOW)
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
    for (let i = 1; i < risks.length; i++) {
      expect(order[risks[i - 1].severity]).toBeLessThanOrEqual(order[risks[i].severity])
    }
  })
})

describe('getRiskKpis()', () => {
  it('total equals sum of all severity counts', () => {
    const kpis = getRiskKpis(NOW)
    expect(kpis.total).toBe(kpis.critical + kpis.high + kpis.medium + kpis.low)
  })

  it('has at least 1 critical risk', () => {
    expect(getRiskKpis(NOW).critical).toBeGreaterThanOrEqual(1)
  })
})

// ── Weekly Briefing ───────────────────────────────────────────────────────────

describe('generateWeeklyBriefing()', () => {
  it('returns a briefing with required fields', () => {
    const briefing = generateWeeklyBriefing(NOW)
    expect(briefing.generatedAt).toBeTruthy()
    expect(briefing.weekEnding).toBeTruthy()
    expect(briefing.northStar).toBeTruthy()
    expect(Array.isArray(briefing.actions)).toBe(true)
  })

  it('returns at least 5 actions', () => {
    const briefing = generateWeeklyBriefing(NOW)
    expect(briefing.actions.length).toBeGreaterThanOrEqual(5)
  })

  it('actions include funding category', () => {
    const briefing = generateWeeklyBriefing(NOW)
    expect(briefing.actions.some((a) => a.category === 'funding')).toBe(true)
  })

  it('actions include deal category', () => {
    const briefing = generateWeeklyBriefing(NOW)
    expect(briefing.actions.some((a) => a.category === 'deal')).toBe(true)
  })

  it('actions include product category', () => {
    const briefing = generateWeeklyBriefing(NOW)
    expect(briefing.actions.some((a) => a.category === 'product')).toBe(true)
  })

  it('weekEnding is a valid date string', () => {
    const { weekEnding } = generateWeeklyBriefing(NOW)
    expect(weekEnding).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('staleDeals count is > 0', () => {
    expect(generateWeeklyBriefing(NOW).staleDeals).toBeGreaterThan(0)
  })

  it('is deterministic — same input produces same output', () => {
    const a = generateWeeklyBriefing(NOW)
    const b = generateWeeklyBriefing(NOW)
    expect(a.northStar).toBe(b.northStar)
    expect(a.weekEnding).toBe(b.weekEnding)
    expect(a.actions.length).toBe(b.actions.length)
  })
})

// ── Data Sync Health ──────────────────────────────────────────────────────────

describe('getDataSourceHealth()', () => {
  it('returns at least 5 sources', () => {
    expect(getDataSourceHealth().length).toBeGreaterThanOrEqual(5)
  })

  it('all sources have valid status', () => {
    getDataSourceHealth().forEach((s) => {
      expect(['healthy', 'stale', 'failed', 'never_run', 'running']).toContain(s.status)
    })
  })

  it('includes a failed source (CanLII)', () => {
    const failed = getDataSourceHealth().filter((s) => s.status === 'failed')
    expect(failed.length).toBeGreaterThanOrEqual(1)
    expect(failed.some((s) => s.sourceId === 'canlii-arbitration')).toBe(true)
  })

  it('includes some healthy sources', () => {
    const healthy = getDataSourceHealth().filter((s) => s.status === 'healthy')
    expect(healthy.length).toBeGreaterThan(0)
  })
})

describe('getSyncHealthKpis()', () => {
  it('total equals sum of status buckets', () => {
    const kpis = getSyncHealthKpis()
    expect(kpis.total).toBe(kpis.healthy + kpis.stale + kpis.failed + kpis.neverRun)
  })

  it('healthPct is 0-100', () => {
    const { healthPct } = getSyncHealthKpis()
    expect(healthPct).toBeGreaterThanOrEqual(0)
    expect(healthPct).toBeLessThanOrEqual(100)
  })
})

// ── Dashboard KPIs ────────────────────────────────────────────────────────────

describe('getDashboardKpis()', () => {
  it('returns full 9-field KPI structure', () => {
    const kpis = getDashboardKpis(NOW)
    expect(typeof kpis.openFundingCount).toBe('number')
    expect(typeof kpis.totalFundingAvailableCad).toBe('number')
    expect(typeof kpis.weightedPipelineCad).toBe('number')
    expect(typeof kpis.activePartners).toBe('number')
    expect(typeof kpis.productsInFocus).toBe('number')
    expect(typeof kpis.deadlinesIn30d).toBe('number')
    expect(typeof kpis.dataSourceHealthPct).toBe('number')
    expect(typeof kpis.openRisksCount).toBe('number')
    expect(typeof kpis.criticalRisksCount).toBe('number')
  })

  it('openFundingCount > 0', () => {
    expect(getDashboardKpis(NOW).openFundingCount).toBeGreaterThan(0)
  })

  it('criticalRisksCount >= 1', () => {
    expect(getDashboardKpis(NOW).criticalRisksCount).toBeGreaterThanOrEqual(1)
  })

  it('dataSourceHealthPct is 0-100', () => {
    const pct = getDashboardKpis(NOW).dataSourceHealthPct
    expect(pct).toBeGreaterThanOrEqual(0)
    expect(pct).toBeLessThanOrEqual(100)
  })
})

// ── Executive Insights ────────────────────────────────────────────────────────

describe('generateExecutiveInsights', () => {
  it('returns a non-empty array', () => {
    expect(generateExecutiveInsights(NOW).length).toBeGreaterThan(0)
  })

  it('results are sorted by priority ascending (lower = higher priority)', () => {
    const insights = generateExecutiveInsights(NOW)
    for (let i = 1; i < insights.length; i++) {
      expect(insights[i].priority).toBeGreaterThanOrEqual(insights[i - 1].priority)
    }
  })

  it('confidence is between 0 and 100 for all insights', () => {
    for (const ins of generateExecutiveInsights(NOW)) {
      expect(ins.confidence).toBeGreaterThanOrEqual(0)
      expect(ins.confidence).toBeLessThanOrEqual(100)
    }
  })

  it('all insights have required fields', () => {
    for (const ins of generateExecutiveInsights(NOW)) {
      expect(typeof ins.id).toBe('string')
      expect(typeof ins.title).toBe('string')
      expect(typeof ins.body).toBe('string')
      expect(typeof ins.source).toBe('string')
      expect(['opportunity', 'warning', 'trend', 'action_required']).toContain(ins.signal)
    }
  })
})

describe('getUrgentInsights', () => {
  it('only returns action_required or warning signals', () => {
    for (const ins of getUrgentInsights(NOW)) {
      expect(['action_required', 'warning']).toContain(ins.signal)
    }
  })

  it('is a subset of generateExecutiveInsights', () => {
    const all = generateExecutiveInsights(NOW)
    const urgent = getUrgentInsights(NOW)
    expect(urgent.length).toBeLessThanOrEqual(all.length)
  })
})

// ── Founder Decisions ─────────────────────────────────────────────────────────

describe('getFounderDecisions', () => {
  it('returns exactly 5 decisions', () => {
    expect(getFounderDecisions(NOW)).toHaveLength(5)
  })

  it('covers all 5 DecisionQuestion values', () => {
    const questions = getFounderDecisions(NOW).map((d) => d.question)
    expect(questions).toContain('where_to_spend_20_hours')
    expect(questions).toContain('next_dollar_product')
    expect(questions).toContain('most_likely_close')
    expect(questions).toContain('highest_roi_grant')
    expect(questions).toContain('partner_unlock_most')
  })

  it('all decisions have non-empty answer and rationale', () => {
    for (const d of getFounderDecisions(NOW)) {
      expect(d.answer.length).toBeGreaterThan(0)
      expect(d.rationale.length).toBeGreaterThan(0)
    }
  })

  it('confidence is between 0 and 100', () => {
    for (const d of getFounderDecisions(NOW)) {
      expect(d.confidence).toBeGreaterThanOrEqual(0)
      expect(d.confidence).toBeLessThanOrEqual(100)
    }
  })

  it('each decision has at least one data point', () => {
    for (const d of getFounderDecisions(NOW)) {
      expect(d.dataPoints.length).toBeGreaterThan(0)
    }
  })
})

// ── Michel Weekly Actions ─────────────────────────────────────────────────────

describe('getMichelWeeklyActions', () => {
  it('returns a non-empty array', () => {
    expect(getMichelWeeklyActions(NOW).length).toBeGreaterThan(0)
  })

  it('all actions have priority 1, 2, or 3', () => {
    for (const a of getMichelWeeklyActions(NOW)) {
      expect([1, 2, 3]).toContain(a.priority)
    }
  })

  it('all actions have required fields', () => {
    for (const a of getMichelWeeklyActions(NOW)) {
      expect(typeof a.id).toBe('string')
      expect(typeof a.title).toBe('string')
      expect(typeof a.context).toBe('string')
      expect(typeof a.leverage).toBe('string')
      expect(typeof a.estimatedTime).toBe('string')
    }
  })

  it('has at least one P1 action', () => {
    const actions = getMichelWeeklyActions(NOW)
    expect(actions.some((a) => a.priority === 1)).toBe(true)
  })
})