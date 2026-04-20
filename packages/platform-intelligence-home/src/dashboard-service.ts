/**
 * @nzila/platform-intelligence-home — Dashboard Aggregation Service
 *
 * Computes the top-level DashboardKpis by pulling signals from
 * every other service. Single call, full picture.
 */
import type { DashboardKpis } from './types'
import { getFundingKpis } from './funding-service'
import { getDealKpis } from './deal-service'
import { getPartnerKpis } from './partner-service'
import { scoreProducts } from './scoring-service'
import { getSyncHealthKpis } from './data-sync-service'
import { getRiskKpis } from './risk-service'

export function getDashboardKpis(now: Date = new Date()): DashboardKpis {
  const funding = getFundingKpis(now)
  const deals = getDealKpis()
  const partners = getPartnerKpis()
  const scored = scoreProducts()
  const sync = getSyncHealthKpis()
  const risks = getRiskKpis(now)

  const productsInFocus = scored.filter((p) => p.totalScore >= 70).length

  return {
    openFundingCount: funding.openCount,
    totalFundingAvailableCad: funding.totalMaxAvailableCad,
    weightedPipelineCad: deals.weightedPipelineCad,
    activePartners: partners.activePartners,
    productsInFocus,
    deadlinesIn30d: funding.deadlinesIn30d,
    dataSourceHealthPct: sync.healthPct,
    openRisksCount: risks.total,
    criticalRisksCount: risks.critical,
  }
}
