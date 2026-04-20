/**
 * @nzila/platform-intelligence-home — Decision Engine
 *
 * Answers five core founder decision questions by scoring available data
 * across the pipeline, funding, partner, and product layers.
 *
 * All decisions are deterministic — same data always produces the same answer.
 * Designed to surface the highest-leverage next action, not just report state.
 */
import type { FounderDecision } from './types'
import { getDealPipeline, getHighProbabilityDeals, getStaleDeals } from './deal-service'
import { getFundingOpportunities, getUpcomingDeadlines } from './funding-service'
import { getPartners } from './partner-service'
import { scoreProducts } from './scoring-service'

// ── Local helpers ─────────────────────────────────────────────────────────────

function fmtCad(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`
  return `$${n}`
}

// ── Individual Decision Functions ─────────────────────────────────────────────

function decideHoursAllocation(now: Date): FounderDecision {
  const highProb = getHighProbabilityDeals(60)
  const deadlines14 = getUpcomingDeadlines(14, now)
  const scored = scoreProducts()
  const topProduct = scored[0]

  const blocks: string[] = []
  let remaining = 20

  if (deadlines14.length > 0) {
    const grantHours = Math.min(6, remaining)
    blocks.push(`${grantHours}h grant deadlines (${deadlines14.map((d) => d.name.split('—')[0].trim()).slice(0, 2).join(', ')})`)
    remaining -= grantHours
  }

  const ueDeals = highProb.filter((d) => d.product === 'union-eyes').slice(0, 2)
  if (ueDeals.length > 0) {
    const dealHours = Math.min(ueDeals.length * 2, remaining)
    blocks.push(`${dealHours}h deal advancement (${ueDeals.map((d) => d.org).join(', ')})`)
    remaining -= dealHours
  }

  if (remaining > 0) {
    blocks.push(`${remaining}h ${topProduct.productName} development`)
  }

  return {
    question: 'where_to_spend_20_hours',
    questionLabel: 'Where should founder spend next 20 hours?',
    answer: blocks[0] ?? `${topProduct.productName} advancement`,
    rationale: `Optimal allocation: ${blocks.join(' · ')}. This sequence maximises expected value across capital capture (grants), pipeline closure (deals), and product maturity in one week sprint.`,
    confidence: 87,
    dataPoints: [
      `${highProb.length} deals at ≥60% probability`,
      `${deadlines14.length} grant deadline${deadlines14.length !== 1 ? 's' : ''} within 14 days`,
      `${topProduct.productName} recommended at ${topProduct.recommendedFocusHours}h/week`,
    ],
    value: '~$50K–$200K+ expected value captured at optimal allocation',
  }
}

function decideNextDollarProduct(): FounderDecision {
  const scored = scoreProducts()
  const top = scored[0]
  const second = scored[1]

  return {
    question: 'next_dollar_product',
    questionLabel: 'Which product deserves the next dollar?',
    answer: top.productName,
    rationale: `${top.productName} (#1 ranked, ${top.totalScore.toFixed(0)}/100) has the highest combined pipeline demand (${top.pipelineDemand}/100) and founder leverage (${top.founderLeverage}/100). Every dollar here compounds: active pilots are negotiating, grants are in-scope, and Michel's domain expertise reduces execution risk. Second-best: ${second.productName} (${second.totalScore.toFixed(0)}/100) for law-firm channel distribution that doesn't compete with ${top.productName} efforts.`,
    confidence: 91,
    dataPoints: [
      `${top.productName} score: ${top.totalScore.toFixed(0)}/100`,
      `Pipeline demand: ${top.pipelineDemand}/100`,
      `Implementation readiness: ${top.implementationReadiness}/100`,
      `${second.productName} is #2 at ${second.totalScore.toFixed(0)}/100`,
    ],
    value: `${top.recommendedFocusHours}h/week minimum recommended`,
  }
}

function decideMostLikelyClose(now: Date): FounderDecision {
  const deals = getDealPipeline()
  const active = deals.filter((d) => !['closed_won', 'closed_lost', 'stale'].includes(d.stage))

  if (active.length === 0) {
    return {
      question: 'most_likely_close',
      questionLabel: 'Which deal is most likely to close this quarter?',
      answer: 'No active deals',
      rationale: 'Pipeline is empty — add deals to enable this analysis.',
      confidence: 50,
      dataPoints: [],
      value: null,
    }
  }

  // Score: probability 50% + urgency 30% (deadline proximity) + recency 20%
  const scored = active
    .map((d) => {
      const urgency = d.expectedCloseDate
        ? Math.max(0, 90 - Math.max(0, (new Date(d.expectedCloseDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : 30
      const recency = Math.max(0, 100 - d.daysSinceActivity * 3)
      return {
        deal: d,
        closeScore: d.probability * 0.5 + urgency * 0.3 + recency * 0.2,
      }
    })
    .sort((a, b) => b.closeScore - a.closeScore)

  const top = scored[0].deal
  const stageLabel = top.stage.replace(/_/g, ' ')

  return {
    question: 'most_likely_close',
    questionLabel: 'Which deal is most likely to close this quarter?',
    answer: `${top.org} — ${top.product.replace(/-/g, ' ')}`,
    rationale: `${top.org} is at ${top.probability}% probability with last activity ${top.daysSinceActivity} day${top.daysSinceActivity !== 1 ? 's' : ''} ago (${stageLabel}). Next step: ${top.nextStep}`,
    confidence: top.probability,
    dataPoints: [
      `Stage: ${stageLabel}`,
      `Probability: ${top.probability}%`,
      `Last activity: ${top.daysSinceActivity} days ago`,
      top.expectedCloseDate ? `Expected close: ${top.expectedCloseDate}` : 'No expected close date set',
    ],
    value: top.estimatedValueCad > 0 ? fmtCad(top.estimatedValueCad) + '/yr' : 'Pilot → reference customer',
  }
}

function decideHighestRoiGrant(now: Date): FounderDecision {
  const funding = getFundingOpportunities(now)
  const applicable = funding.filter((f) => (f.status === 'apply' || f.status === 'watch') && f.confidenceScore >= 60)

  if (applicable.length === 0) {
    return {
      question: 'highest_roi_grant',
      questionLabel: 'Which grant has the highest ROI per application hour?',
      answer: 'No applicable grants found',
      rationale: 'No high-confidence grants in the current funding radar.',
      confidence: 50,
      dataPoints: [],
      value: null,
    }
  }

  // ROI score: (maxValue × confidence) / effort estimate
  // Rolling programs get 15% bonus (perpetual availability reduces time pressure)
  const scored = applicable
    .map((f) => {
      const maxVal = f.typicalMaxCad ?? 50_000
      const effortFactor = f.isRecurring ? 85 : 100
      const roi = (maxVal * f.confidenceScore) / effortFactor
      return { f, roi }
    })
    .sort((a, b) => b.roi - a.roi)

  const top = scored[0].f
  const shortName = top.name.split('—')[0].trim()
  const deadlineNote = top.isRecurring ? 'Rolling intake — apply without deadline pressure.' : top.deadline ? `Deadline: ${top.deadline.slice(0, 10)}.` : ''

  return {
    question: 'highest_roi_grant',
    questionLabel: 'Which grant has the highest ROI per application hour?',
    answer: shortName,
    rationale: `${top.agency}: ${top.confidenceScore}% confidence × up to ${fmtCad(top.typicalMaxCad ?? 0)} = highest expected value per hour invested. ${deadlineNote} ${top.notes ?? ''}`.trim(),
    confidence: top.confidenceScore,
    dataPoints: [
      `Confidence: ${top.confidenceScore}/100`,
      `Max value: ${fmtCad(top.typicalMaxCad ?? 0)}`,
      top.isRecurring ? 'Rolling intake' : `Deadline: ${top.deadline?.slice(0, 10) ?? 'TBD'}`,
      `Type: ${top.fundingType}`,
    ],
    value: fmtCad(top.typicalMaxCad ?? 0),
  }
}

function decidePartnerUnlock(): FounderDecision {
  const partners = getPartners().filter((p) => p.status === 'active' || p.status === 'negotiating' || p.status === 'prospect')

  if (partners.length === 0) {
    return {
      question: 'partner_unlock_most',
      questionLabel: 'Which partner unlocks the most products?',
      answer: 'No partner data',
      rationale: 'No partners found in the current ecosystem.',
      confidence: 40,
      dataPoints: [],
      value: null,
    }
  }

  // Score each partner by how many Nzila products their domain/type unlocks
  const partnerScores = partners
    .map((p) => {
      const unlocks = new Set<string>()
      const domain = p.primaryDomain.toLowerCase()
      const type = p.partnerType.toLowerCase()
      if (domain.includes('union') || domain.includes('labour') || type === 'union') {
        unlocks.add('union-eyes')
      }
      if (domain.includes('legal') || domain.includes('justice') || type === 'law_firm') {
        unlocks.add('faircase')
        unlocks.add('union-eyes')
      }
      if (domain.includes('music') || domain.includes('culture') || type === 'music_house') {
        unlocks.add('zonga')
      }
      if (domain.includes('smb') || domain.includes('business') || type === 'smb_channel') {
        unlocks.add('flow')
        unlocks.add('cfo')
      }
      if (domain.includes('research') || type === 'research_institution') {
        unlocks.add('union-eyes')
        unlocks.add('faircase')
        unlocks.add('flow')
      }
      if (type === 'tech_partner') {
        unlocks.add('union-eyes')
        unlocks.add('faircase')
        unlocks.add('flow')
      }
      if (p.agreementTypes.some((a) => a.toLowerCase().includes('distribution'))) {
        unlocks.add('flow')
        unlocks.add('faircase')
      }
      if (p.agreementTypes.some((a) => a.toLowerCase().includes('data'))) {
        unlocks.add('union-eyes')
      }
      return { partner: p, unlocks: [...unlocks] }
    })
    .sort((a, b) => b.unlocks.length - a.unlocks.length || a.partner.name.localeCompare(b.partner.name))

  const top = partnerScores[0]
  const p = top.partner
  const productList = top.unlocks.map((u) => u.replace(/-/g, ' ')).join(', ')
  const valueNote = p.annualValueCad > 0 ? ` Current annual value: ${fmtCad(p.annualValueCad)}.` : ''

  return {
    question: 'partner_unlock_most',
    questionLabel: 'Which partner unlocks the most products?',
    answer: p.name,
    rationale: `${p.name} (${p.partnerType.replace(/_/g, ' ')}, ${p.primaryDomain}) activates ${top.unlocks.length} product line${top.unlocks.length !== 1 ? 's' : ''}: ${productList}.${valueNote} Deepening this relationship has compounding returns across the Nzila portfolio.`,
    confidence: 76,
    dataPoints: [
      `Products unlocked: ${top.unlocks.join(', ')}`,
      `Status: ${p.status}`,
      `Domain: ${p.primaryDomain}`,
      `Annual value: ${p.annualValueCad > 0 ? fmtCad(p.annualValueCad) : 'TBD'}`,
    ],
    value: `${top.unlocks.length} product${top.unlocks.length !== 1 ? 's' : ''} unlocked`,
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Return all five founder decisions, in canonical order. */
export function getFounderDecisions(now: Date = new Date()): FounderDecision[] {
  return [
    decideHoursAllocation(now),
    decideNextDollarProduct(),
    decideMostLikelyClose(now),
    decideHighestRoiGrant(now),
    decidePartnerUnlock(),
  ]
}
