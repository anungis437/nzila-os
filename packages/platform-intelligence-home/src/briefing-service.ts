/**
 * @nzila/platform-intelligence-home — Weekly CEO Briefing Engine
 *
 * Deterministic generator for "This Week's Highest Leverage Moves".
 * Synthesizes signals from all intelligence services to produce a
 * ranked, actionable briefing for leadership.
 *
 * The briefing is deterministic: same inputs → same output. No ML, no
 * randomness. Logic is auditable and testable.
 */
import type { BriefingAction, BriefingActionCategory, WeeklyBriefing } from './types'
import { getOpenOpportunities, getUpcomingDeadlines } from './funding-service'
import { getStaleDeals, getHighProbabilityDeals } from './deal-service'
import { getTopProducts } from './scoring-service'
import { getSyncHealthKpis, getFailedSyncs } from './data-sync-service'

let _actionCounter = 0
function nextId(): string {
  return `brief-action-${++_actionCounter}`
}

function isoWeekEnding(now: Date): string {
  const d = new Date(now)
  const day = d.getDay() // 0=Sun, 5=Fri, 6=Sat
  const daysToFriday = day <= 5 ? 5 - day : 6
  d.setDate(d.getDate() + daysToFriday)
  return d.toISOString().slice(0, 10)
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── Action Generators ─────────────────────────────────────────────────────────

function grantDeadlineActions(now: Date): BriefingAction[] {
  const actions: BriefingAction[] = []
  const imminent = getUpcomingDeadlines(14, now)
  const soon = getUpcomingDeadlines(30, now).filter(
    (d) => d.daysUntilDeadline !== null && d.daysUntilDeadline > 14
  )

  for (const opp of imminent.slice(0, 2)) {
    actions.push({
      id: nextId(),
      priority: 1,
      category: 'funding',
      title: `Submit ${opp.name.split('—')[0].trim()} application (deadline in ${opp.daysUntilDeadline} days)`,
      rationale: `${opp.agency} deadline is ${opp.deadline?.slice(0, 10)}. Confidence score: ${opp.confidenceScore}/100. ${opp.notes ?? ''}`,
      estimatedImpact: opp.typicalMaxCad ? `Up to $${(opp.typicalMaxCad).toLocaleString()} CAD` : 'Tax credit / grant',
      dueDate: opp.deadline?.slice(0, 10) ?? null,
      product: opp.relevantDomains[0] ?? null,
    })
  }

  for (const opp of soon.slice(0, 1)) {
    actions.push({
      id: nextId(),
      priority: 2,
      category: 'funding',
      title: `Prepare ${opp.name.split('—')[0].trim()} application (${opp.daysUntilDeadline} days away)`,
      rationale: `Deadline: ${opp.deadline?.slice(0, 10)}. Confidence: ${opp.confidenceScore}/100. Start now to avoid rushing.`,
      estimatedImpact: opp.typicalMaxCad ? `Up to $${(opp.typicalMaxCad).toLocaleString()} CAD` : 'Grant',
      dueDate: opp.deadline?.slice(0, 10) ?? null,
      product: opp.relevantDomains[0] ?? null,
    })
  }

  return actions
}

function rollingGrantActions(now: Date): BriefingAction[] {
  const actions: BriefingAction[] = []
  const rolling = getOpenOpportunities(now)
    .filter((o) => o.isRecurring && o.status !== 'submitted' && o.confidenceScore >= 78)
    .slice(0, 2)

  for (const opp of rolling) {
    actions.push({
      id: nextId(),
      priority: 2,
      category: 'funding',
      title: `Initiate ${opp.name.split('—')[0].trim()} — rolling intake, high confidence`,
      rationale: `${opp.intakeTiming}. Confidence: ${opp.confidenceScore}/100. ${opp.notes ?? ''}`,
      estimatedImpact: opp.typicalMaxCad ? `Up to $${(opp.typicalMaxCad).toLocaleString()} CAD` : 'Tax credit',
      dueDate: null,
      product: opp.relevantDomains[0] ?? null,
    })
  }

  return actions
}

function dealActions(now: Date): BriefingAction[] {
  const actions: BriefingAction[] = []

  // High-probability deals that need a push
  const hotDeals = getHighProbabilityDeals(60).slice(0, 2)
  for (const deal of hotDeals) {
    actions.push({
      id: nextId(),
      priority: 1,
      category: 'deal',
      title: `Advance ${deal.org} — ${deal.product} ${deal.dealType.replace('_', ' ')} (${deal.probability}% probability)`,
      rationale: `${deal.nextStep}`,
      estimatedImpact: deal.estimatedValueCad > 0
        ? `$${deal.estimatedValueCad.toLocaleString()} CAD potential`
        : 'Strategic pilot — unlocks reference customer',
      dueDate: deal.expectedCloseDate,
      product: deal.product,
    })
  }

  // Stale deals
  const stale = getStaleDeals(14).slice(0, 2)
  for (const deal of stale) {
    actions.push({
      id: nextId(),
      priority: 2,
      category: 'deal',
      title: `Re-engage ${deal.org} — ${deal.daysSinceActivity} days stale`,
      rationale: `${deal.product} deal has had no activity for ${deal.daysSinceActivity} days. Deals die in silence.`,
      estimatedImpact: deal.estimatedValueCad > 0 ? `$${deal.estimatedValueCad.toLocaleString()} at risk` : 'Pilot opportunity at risk',
      dueDate: addDays(now.toISOString().slice(0, 10), 3),
      product: deal.product,
    })
  }

  return actions
}

function productFocusActions(): BriefingAction[] {
  const topThree = getTopProducts(3)
  const [top, second] = topThree

  return [
    {
      id: nextId(),
      priority: 2,
      category: 'product',
      title: `Protect ${top.productName} focus — ${top.recommendedFocusHours}h this week minimum`,
      rationale: `${top.productName} ranks #1 (${top.totalScore}/100). With active pilots negotiating, founder time is the bottleneck. Block it in calendar.`,
      estimatedImpact: 'Closing 1 pilot unlocks credibility + ARR',
      dueDate: null,
      product: top.productId,
    },
    ...(second
      ? [
          {
            id: nextId(),
            priority: 3,
            category: 'product' as BriefingActionCategory,
            title: `${second.productName} — advance distribution deal this week`,
            rationale: `${second.productName} is #2 ranked (${second.totalScore}/100). Dentons law firm channel deal in negotiation — move it forward.`,
            estimatedImpact: 'Law firm channel = $200K ARR potential at scale',
            dueDate: null,
            product: second.productId,
          },
        ]
      : []),
  ]
}

function srtaxActions(now: Date): BriefingAction[] {
  const month = now.getMonth()
  // Q1 = Jan-Mar (file Q1 docs), Q2 = Apr-Jun, Q3 = Jul-Sep, Q4 = Oct-Dec
  const quarter = `Q${Math.floor(month / 3) + 1}`
  return [
    {
      id: nextId(),
      priority: 3,
      category: 'admin',
      title: `Update SR&ED documentation for ${quarter} engineering activity`,
      rationale: 'SR&ED is a recurring annual claim worth 35% ITC on R&D labor. Documentation must be maintained quarterly — not reconstructed at year end. Never skip this.',
      estimatedImpact: 'Estimated $50K–$150K refundable tax credit annually',
      dueDate: null,
      product: 'platform',
    },
  ]
}

function dataSyncActions(): BriefingAction[] {
  const failed = getFailedSyncs()
  if (failed.length === 0) return []

  return [
    {
      id: nextId(),
      priority: 3,
      category: 'data',
      title: `Fix ${failed.length} failed data ingestion source${failed.length > 1 ? 's' : ''}`,
      rationale: `${failed.map((s) => s.sourceName).join(', ')} — sync errors degrade intelligence quality and funding radar accuracy.`,
      estimatedImpact: 'Maintains data freshness and intelligence quality',
      dueDate: null,
      product: null,
    },
  ]
}

function generateNorthStar(now: Date): string {
  const topProduct = getTopProducts(1)[0]
  const openDeadlines = getUpcomingDeadlines(30, now).length
  const hotDeals = getHighProbabilityDeals(60).length

  if (openDeadlines > 0) {
    return `This week: close grant applications, advance ${topProduct.productName} pilot negotiations, and protect deep-work time. Capital + pipeline focus.`
  }
  if (hotDeals >= 3) {
    return `Strong pipeline momentum. This week: convert probability into closed agreements. Every day of delay costs credibility.`
  }
  return `Build the funnel. This week: advance top grant applications, book two new pilot conversations, and document SR&ED work. Compound the leverage.`
}

// ── Main Generator ────────────────────────────────────────────────────────────

export function generateWeeklyBriefing(now: Date = new Date()): WeeklyBriefing {
  _actionCounter = 0 // reset counter for deterministic IDs

  const syncKpis = getSyncHealthKpis()
  const deadlines30 = getUpcomingDeadlines(30, now)
  const staleDeals = getStaleDeals(14)

  const rawActions = [
    ...grantDeadlineActions(now),
    ...dealActions(now),
    ...rollingGrantActions(now),
    ...productFocusActions(),
    ...srtaxActions(now),
    ...dataSyncActions(),
  ]

  // De-duplicate and re-rank
  rawActions.forEach((a, i) => { a.priority = i + 1 })

  return {
    generatedAt: now.toISOString(),
    weekEnding: isoWeekEnding(now),
    northStar: generateNorthStar(now),
    actions: rawActions.slice(0, 10), // top 10 actions
    fundingDeadlinesIn30d: deadlines30.length,
    staleDeals: staleDeals.length,
    openRisks: syncKpis.failed + (deadlines30.length > 0 ? 1 : 0),
  }
}
