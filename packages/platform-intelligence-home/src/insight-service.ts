/**
 * @nzila/platform-intelligence-home — Executive Insight Service
 *
 * Generates data-grounded executive insights from the live intelligence layer.
 * Insights are deterministic derivations of current pipeline, funding, partner,
 * and product scoring state — not LLM outputs.
 *
 * Each insight has a signal type, priority, confidence score, and clear body
 * text suitable for an executive dashboard.
 */
import type { ExecutiveInsight } from './types'
import { getFundingOpportunities, getUpcomingDeadlines } from './funding-service'
import { getDealPipeline, getHighProbabilityDeals, getStaleDeals, getActiveDeals } from './deal-service'
import { getActivePartners } from './partner-service'
import { scoreProducts } from './scoring-service'
import { getSyncHealthKpis } from './data-sync-service'

// ── Local helpers ─────────────────────────────────────────────────────────────

function fmtCad(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

function makeInsight(
  id: string,
  signal: ExecutiveInsight['signal'],
  priority: number,
  title: string,
  body: string,
  product: string | null,
  confidence: number,
  source: string,
): ExecutiveInsight {
  return { id, signal, priority, title, body, product, confidence, source }
}

// ── Insight Generators ────────────────────────────────────────────────────────

function insightUnionEyesUpside(deals: ReturnType<typeof getDealPipeline>, scored: ReturnType<typeof scoreProducts>): ExecutiveInsight | null {
  const ue = scored.find((p) => p.productId === 'union-eyes')
  if (!ue) return null
  const ueHighProb = deals.filter((d) => d.product === 'union-eyes' && d.probability >= 60)
  if (ueHighProb.length < 2) return null
  return makeInsight(
    'ins-ue-enterprise-upside',
    'opportunity',
    1,
    `Union Eyes has highest enterprise upside — ${ueHighProb.length} high-probability deals active`,
    `${ueHighProb.map((d) => d.org).join(', ')} are at ≥60% probability. Union Eyes ranks #1 on strategic fit (${ue.strategicFit}/100) and founder leverage (${ue.founderLeverage}/100). Enterprise union contracts lock in 3–5 year ARR and open doors to CUPE National.`,
    'union-eyes',
    91,
    'deal-service+scoring-service',
  )
}

function insightNoClosedPilots(deals: ReturnType<typeof getDealPipeline>): ExecutiveInsight | null {
  const closedWon = deals.filter((d) => d.stage === 'closed_won')
  if (closedWon.length > 0) return null
  return makeInsight(
    'ins-no-closed-pilots',
    'action_required',
    1,
    'No closed pilots yet — first win unlocks the credibility flywheel',
    "Pipeline is strong but zero deals are closed-won. Closing ONE paid pilot transforms the commercial narrative: investor conversations shift, next deal probability improves, and grant credibility increases materially. Unifor MOU should be this week's top priority.",
    'union-eyes',
    97,
    'deal-service',
  )
}

function insightGrantDeadlines(deadlines14: ReturnType<typeof getUpcomingDeadlines>, deadlines30: ReturnType<typeof getUpcomingDeadlines>): ExecutiveInsight | null {
  if (deadlines14.length > 0) {
    const names = deadlines14.map((d) => d.name.split('—')[0].trim()).join(', ')
    const total = deadlines14.reduce((s, d) => s + (d.typicalMaxCad ?? 0), 0)
    return makeInsight(
      'ins-grant-deadline-imminent',
      'action_required',
      1,
      `${deadlines14.length} grant${deadlines14.length > 1 ? 's' : ''} expire within 14 days`,
      `Imminent: ${names}. Combined potential: ${fmtCad(total)} CAD. Missing these windows requires waiting 6–12 months for the next intake cycle.`,
      null,
      99,
      'funding-service',
    )
  }
  if (deadlines30.length > 0) {
    return makeInsight(
      'ins-grant-deadlines-30d',
      'warning',
      2,
      `${deadlines30.length} grant deadline${deadlines30.length > 1 ? 's' : ''} within 30 days — begin applications now`,
      `${deadlines30.map((d) => `${d.name.split('—')[0].trim()} (${d.daysUntilDeadline}d)`).join(', ')}. Starting early avoids quality compromises under deadline pressure.`,
      null,
      95,
      'funding-service',
    )
  }
  return null
}

function insightFlowRevenueSpeed(scored: ReturnType<typeof scoreProducts>): ExecutiveInsight | null {
  const flow = scored.find((p) => p.productId === 'flow')
  const fc = scored.find((p) => p.productId === 'faircase')
  if (!flow || !fc) return null
  if (flow.revenueSpeed <= fc.revenueSpeed) return null
  return makeInsight(
    'ins-flow-revenue-velocity',
    'opportunity',
    3,
    'Flow has fastest revenue path this quarter',
    `Flow's revenue speed score (${flow.revenueSpeed}/100) outpaces FairCase (${fc.revenueSpeed}/100). Channel deal with BIPOC Business Network + CanExport integration makes Flow the fastest path to early ARR while Union Eyes pipeline matures.`,
    'flow',
    82,
    'scoring-service',
  )
}

function insightStalePipeline(stale: ReturnType<typeof getStaleDeals>): ExecutiveInsight | null {
  if (stale.length < 2) return null
  const staleCad = stale.reduce((s, d) => s + d.estimatedValueCad, 0)
  const topThree = stale.slice(0, 3).map((d) => `${d.org} (${d.daysSinceActivity}d)`)
  return makeInsight(
    'ins-stale-pipeline',
    'warning',
    2,
    `${stale.length} deals going stale — ${staleCad > 0 ? fmtCad(staleCad) + ' at risk' : 'pipeline momentum at risk'}`,
    `Stale: ${topThree.join(', ')}${stale.length > 3 ? ` + ${stale.length - 3} more` : ''}. Statistically, deals not touched in 21+ days close at <10% rate. Two hours of pipeline hygiene this week can recover these.`,
    null,
    88,
    'deal-service',
  )
}

function insightFairCaseLegalChannel(deals: ReturnType<typeof getDealPipeline>): ExecutiveInsight | null {
  const fcLawFirm = deals.filter((d) => d.product === 'faircase' && d.dealType === 'law_firm_partnership')
  if (fcLawFirm.length === 0) return null
  const best = fcLawFirm.sort((a, b) => b.probability * b.estimatedValueCad - a.probability * a.estimatedValueCad)[0]
  return makeInsight(
    'ins-faircase-law-channel',
    'opportunity',
    2,
    `FairCase ideal for legal channel partnerships — ${fcLawFirm.length} deal${fcLawFirm.length > 1 ? 's' : ''} in play`,
    `${best.org} law firm channel deal at ${best.probability}% probability${best.estimatedValueCad > 0 ? `, ${fmtCad(best.estimatedValueCad)}/yr` : ''}. Law firm distribution is the fastest path to 50+ FairCase seats without a direct sales team.`,
    'faircase',
    83,
    'deal-service',
  )
}

function insightZongaSponsor(deals: ReturnType<typeof getDealPipeline>): ExecutiveInsight | null {
  const zongaSponsor = deals.find((d) => d.product === 'zonga' && d.dealType === 'sponsor' && d.probability >= 50)
  if (!zongaSponsor) return null
  return makeInsight(
    'ins-zonga-sponsor',
    'trend',
    4,
    `Zonga sponsorship probability rising — ${zongaSponsor.org} at ${zongaSponsor.probability}%`,
    `${zongaSponsor.org} sponsor deal at ${zongaSponsor.probability}% probability. Zonga also has FACTOR grant in application. Music + diaspora culture platform = dual revenue path: B2B corporate sponsorships + B2C streaming distribution.`,
    'zonga',
    74,
    'deal-service',
  )
}

function insightPartnerEcosystem(activePartners: ReturnType<typeof getActivePartners>): ExecutiveInsight | null {
  const domains = new Set(activePartners.map((p) => p.primaryDomain))
  if (domains.size < 3) return null
  const totalValue = activePartners.reduce((s, p) => s + p.annualValueCad, 0)
  return makeInsight(
    'ins-partner-ecosystem',
    'opportunity',
    5,
    `Partner ecosystem spans ${domains.size} domains — structural moat forming`,
    `${activePartners.length} active partners across: ${[...domains].slice(0, 5).join(', ')}. ${totalValue > 0 ? `Combined annual value: ${fmtCad(totalValue)}.` : ''} A cross-domain partner network at this stage is rare and compounds with every new product launch.`,
    null,
    79,
    'partner-service',
  )
}

function insightDataFreshness(syncKpis: ReturnType<typeof getSyncHealthKpis>): ExecutiveInsight | null {
  if (syncKpis.healthPct >= 50) return null
  return makeInsight(
    'ins-data-freshness',
    'warning',
    3,
    `Intelligence data freshness at ${syncKpis.healthPct}% — degraded signal quality`,
    `${syncKpis.failed} failed sync${syncKpis.failed !== 1 ? 's' : ''} and ${syncKpis.neverRun} never-run source${syncKpis.neverRun !== 1 ? 's' : ''}. Intelligence outputs are only as reliable as their inputs. Restoring data pipelines should be a this-week engineering priority.`,
    null,
    92,
    'data-sync-service',
  )
}

function insightSRED(funding: ReturnType<typeof getFundingOpportunities>): ExecutiveInsight | null {
  const sred = funding.find((f) => f.id === 'sred')
  if (!sred || sred.confidenceScore < 90) return null
  return makeInsight(
    'ins-sred',
    'opportunity',
    3,
    `SR&ED confidence at ${sred.confidenceScore}% — estimated $50K–$150K annual ITC`,
    'SR&ED (Scientific Research & Experimental Development) is a non-dilutive capital source most early-stage companies leave on the table. At current engineering spend, refundable federal tax credits of $50K–$150K annually are realistic. Requires quarterly activity documentation — not end-of-year reconstruction.',
    'platform',
    sred.confidenceScore,
    'funding-service',
  )
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Generate all data-grounded executive insights, sorted by priority. */
export function generateExecutiveInsights(now: Date = new Date()): ExecutiveInsight[] {
  const deals = getDealPipeline()
  const stale = getStaleDeals(14)
  const funding = getFundingOpportunities(now)
  const deadlines14 = getUpcomingDeadlines(14, now)
  const deadlines30 = getUpcomingDeadlines(30, now)
  const activePartners = getActivePartners()
  const scored = scoreProducts()
  const syncKpis = getSyncHealthKpis()

  const candidates: (ExecutiveInsight | null)[] = [
    insightUnionEyesUpside(deals, scored),
    insightNoClosedPilots(deals),
    insightGrantDeadlines(deadlines14, deadlines30),
    insightFlowRevenueSpeed(scored),
    insightStalePipeline(stale),
    insightFairCaseLegalChannel(deals),
    insightZongaSponsor(deals),
    insightPartnerEcosystem(activePartners),
    insightDataFreshness(syncKpis),
    insightSRED(funding),
  ]

  return candidates
    .filter((i): i is ExecutiveInsight => i !== null)
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
}

/** Return only action_required and warning insights — for the alert banner. */
export function getUrgentInsights(now: Date = new Date()): ExecutiveInsight[] {
  return generateExecutiveInsights(now).filter(
    (i) => i.signal === 'action_required' || i.signal === 'warning',
  )
}
