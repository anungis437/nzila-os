/**
 * @nzila/platform-intelligence-home — Risk Service
 *
 * Deterministic risk detection engine.
 * Synthesizes signals from deal pipeline, funding radar, product scoring,
 * and data sync health to surface the most pressing operational risks.
 *
 * Risks are categorized and severity-rated for display in the Risk Center.
 */
import type { Risk, RiskSeverity, RiskCategory } from './types'
import { getStaleDeals, getActiveDeals, getDealPipeline } from './deal-service'
import { getUpcomingDeadlines, getFundingOpportunities } from './funding-service'
import { scoreProducts, getPriorityProduct } from './scoring-service'
import { getSyncHealthKpis } from './data-sync-service'

function makeRisk(
  id: string,
  category: RiskCategory,
  severity: RiskSeverity,
  title: string,
  detail: string,
  recommendedAction: string,
  now: Date
): Risk {
  return { id, category, severity, title, detail, recommendedAction, detectedAt: now.toISOString() }
}

// ── Risk Detectors ────────────────────────────────────────────────────────────

function detectPipelineRisks(now: Date): Risk[] {
  const risks: Risk[] = []
  const stale = getStaleDeals(14)
  const active = getActiveDeals()
  const all = getDealPipeline()
  const closedWon = all.filter((d) => d.stage === 'closed_won')

  if (closedWon.length === 0) {
    risks.push(makeRisk(
      'risk-no-closed-pilots',
      'pipeline',
      'critical',
      'No pilots closed to revenue yet',
      'Pipeline has active deals but zero closed-won revenue. Every active pilot remains at risk of ghosting or delay.',
      'Prioritize closing the Unifor pilot MOU this week. A first closed deal changes the credibility trajectory.',
      now
    ))
  }

  if (stale.length >= 3) {
    risks.push(makeRisk(
      'risk-stale-pipeline',
      'pipeline',
      'high',
      `${stale.length} deals stale (no activity > 14 days)`,
      `Stale deals: ${stale.map((d) => d.name).join(', ')}. Without regular touchpoints, deals die silently.`,
      'Block 2 hours this week for pipeline hygiene. For each stale deal: send a short, direct message with a concrete next step.',
      now
    ))
  } else if (stale.length > 0) {
    risks.push(makeRisk(
      'risk-stale-pipeline-medium',
      'pipeline',
      'medium',
      `${stale.length} deal${stale.length > 1 ? 's' : ''} approaching staleness`,
      `${stale.map((d) => d.name).join(', ')} — last activity ${stale[0].daysSinceActivity} days ago.`,
      'Send a brief check-in message to each stale deal contact this week.',
      now
    ))
  }

  if (active.length > 10) {
    risks.push(makeRisk(
      'risk-too-many-deals',
      'strategic',
      'medium',
      'Deal pipeline may be too broad to close effectively',
      `${active.length} active deals across ${new Set(active.map((d) => d.product)).size} products. Spreading focus thin risks closing none.`,
      'Qualify and deprioritize deals below 40% probability. Focus on top 5 highest-value, highest-probability deals.',
      now
    ))
  }

  return risks
}

function detectFundingRisks(now: Date): Risk[] {
  const risks: Risk[] = []
  const deadlines30 = getUpcomingDeadlines(30, now)
  const deadlines14 = getUpcomingDeadlines(14, now)
  const all = getFundingOpportunities(now)
  const rollingNotStarted = all.filter(
    (o) => o.isRecurring && (o.status === 'watch') && o.confidenceScore >= 75
  )

  if (deadlines14.length > 0) {
    risks.push(makeRisk(
      'risk-grant-deadline-imminent',
      'timing',
      'critical',
      `Grant deadline in ≤ 14 days: ${deadlines14[0].name}`,
      `${deadlines14[0].name} closes in ${deadlines14[0].daysUntilDeadline} days. Status: ${deadlines14[0].status}.`,
      `Start or complete the ${deadlines14[0].name} application immediately. Contact the program officer today.`,
      now
    ))
  } else if (deadlines30.length > 0) {
    risks.push(makeRisk(
      'risk-grant-deadline-30d',
      'timing',
      'high',
      `${deadlines30.length} grant deadline${deadlines30.length > 1 ? 's' : ''} within 30 days`,
      `Upcoming: ${deadlines30.map((d) => `${d.name} (${d.daysUntilDeadline}d)`).join('; ')}.`,
      'Prioritize application prep this week. Assign deadline to calendar immediately.',
      now
    ))
  }

  if (rollingNotStarted.length >= 2) {
    risks.push(makeRisk(
      'risk-rolling-grants-idle',
      'capital',
      'high',
      `${rollingNotStarted.length} high-confidence rolling grants not yet applied`,
      `${rollingNotStarted.map((o) => o.name).join(', ')} — all have rolling intake and high eligibility scores but remain in "watch" status.`,
      'Move NRC IRAP and CanExport to "apply" status. Contact ITAs and program officers this week.',
      now
    ))
  }

  return risks
}

function detectStrategicRisks(now: Date): Risk[] {
  const risks: Risk[] = []
  const ranked = scoreProducts()
  const topProduct = ranked[0]
  const tooManyHighPriority = ranked.filter((p) => p.totalScore >= 70).length

  if (tooManyHighPriority >= 4) {
    risks.push(makeRisk(
      'risk-too-many-priorities',
      'strategic',
      'high',
      'Too many products ranked as high priority',
      `${tooManyHighPriority} products score ≥ 70/100. With a small team, pursuing all simultaneously risks excellence at none.`,
      `Choose a primary bet (${topProduct.productName}) and secondary (${ranked[1]?.productName}). All others to maintenance or park.`,
      now
    ))
  }

  return risks
}

function detectDataRisks(now: Date): Risk[] {
  const risks: Risk[] = []
  const syncKpis = getSyncHealthKpis()

  if (syncKpis.failed > 0) {
    risks.push(makeRisk(
      'risk-sync-failures',
      'data',
      'high',
      `${syncKpis.failed} data source sync${syncKpis.failed > 1 ? 's' : ''} failing`,
      `${syncKpis.failed} ingestion pipelines are in error state. Stale data degrades intelligence quality.`,
      'Review failed sync logs. Fix ingestion connector or refresh API credentials. Target < 5% sync failure rate.',
      now
    ))
  } else if (syncKpis.stale > 2) {
    risks.push(makeRisk(
      'risk-sync-stale',
      'data',
      'medium',
      `${syncKpis.stale} data sources are stale`,
      'Several public data sources have not been refreshed past their expected cadence.',
      'Run on-demand sync for stale sources. Review ingestion schedule configuration.',
      now
    ))
  }

  if (syncKpis.healthPct < 60) {
    risks.push(makeRisk(
      'risk-data-health-low',
      'data',
      'high',
      `Data source health at ${syncKpis.healthPct}% — intelligence quality degraded`,
      'More than 40% of data sources are unhealthy. Funding radar and market intelligence may be out of date.',
      'Run full ingestion sweep. Prioritize public government sources (open.canada.ca, canlii) as highest value.',
      now
    ))
  }

  return risks
}

function detectExecutionRisks(now: Date): Risk[] {
  const risks: Risk[] = []
  const priorityProduct = getPriorityProduct()

  if (priorityProduct.pipelineDemand >= 85 && priorityProduct.recommendedFocusHours < 15) {
    risks.push(makeRisk(
      'risk-underfocused-top-product',
      'execution',
      'medium',
      `${priorityProduct.productName} is top priority but may be underfunded in time`,
      `${priorityProduct.productName} scores ${priorityProduct.totalScore}/100 (rank #1) but only ${priorityProduct.recommendedFocusHours}h/week recommended. With active deals closing, this needs more founder time.`,
      `Block dedicated ${priorityProduct.productName} time in calendar. Delegate non-${priorityProduct.productName} tasks this week.`,
      now
    ))
  }

  return risks
}

// ── Service Functions ────────────────────────────────────────────────────────

export function detectRisks(now: Date = new Date()): Risk[] {
  const allRisks = [
    ...detectPipelineRisks(now),
    ...detectFundingRisks(now),
    ...detectStrategicRisks(now),
    ...detectDataRisks(now),
    ...detectExecutionRisks(now),
  ]

  // Sort: critical first, then high, then medium, then low
  const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
  allRisks.sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4))

  return allRisks
}

export function getRiskKpis(now: Date = new Date()) {
  const risks = detectRisks(now)
  return {
    total: risks.length,
    critical: risks.filter((r) => r.severity === 'critical').length,
    high: risks.filter((r) => r.severity === 'high').length,
    medium: risks.filter((r) => r.severity === 'medium').length,
    low: risks.filter((r) => r.severity === 'low').length,
  }
}
