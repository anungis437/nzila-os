/**
 * @nzila/platform-intelligence-home — Product Scoring Service
 *
 * Deterministic product prioritization engine.
 * Scores each Nzila product on 5 dimensions and outputs a ranked list
 * to guide leadership focus decisions.
 *
 * Scoring Dimensions:
 *   pipelineDemand       (25%) — Active deals, inbound interest, partner traction
 *   strategicFit         (20%) — Alignment with Nzila mission and founder strengths
 *   revenueSpeed         (25%) — Time-to-revenue, market size, deal structure
 *   implementationReady  (20%) — Code maturity, deployment readiness, team capacity
 *   founderLeverage      (10%) — Michel's unique unfair advantage in this domain
 */
import type { ProductScore } from './types'

// ── Scoring Weights ───────────────────────────────────────────────────────────

const WEIGHTS = {
  pipelineDemand: 0.25,
  strategicFit: 0.20,
  revenueSpeed: 0.25,
  implementationReadiness: 0.20,
  founderLeverage: 0.10,
} as const

// ── Raw Scores ────────────────────────────────────────────────────────────────
// All scores 0-100. Calibrated as of April 2026.

interface RawScore {
  productId: string
  productName: string
  pipelineDemand: number
  strategicFit: number
  revenueSpeed: number
  implementationReadiness: number
  founderLeverage: number
  strengths: string[]
  gaps: string[]
  recommendedFocusHours: number
}

const RAW_SCORES: RawScore[] = [
  {
    productId: 'union-eyes',
    productName: 'Union Eyes',
    pipelineDemand: 90,
    strategicFit: 95,
    revenueSpeed: 72,
    implementationReadiness: 85,
    founderLeverage: 95,
    strengths: [
      'Largest active deal pipeline of any product',
      "Michel's labour law background = strongest founder-market fit",
      'Multiple union pilots actively negotiating',
      'Clear B2B SaaS revenue model per local',
      'Strategic grants (IRAP, FedDev) available for AI features',
    ],
    gaps: [
      'No pilot closed to paid subscription yet',
      'Pension intelligence module not complete',
      'Sales cycle with unions is 6-12 months',
    ],
    recommendedFocusHours: 20,
  },
  {
    productId: 'faircase',
    productName: 'FairCase',
    pipelineDemand: 75,
    strategicFit: 87,
    revenueSpeed: 80,
    implementationReadiness: 75,
    founderLeverage: 90,
    strengths: [
      'Law firm distribution deals in negotiation (Dentons $200K)',
      "Legal + access to justice is Michel's second strongest domain",
      'A2AJ data partnership unlocks unique legal AI data moat',
      'Per-seat pricing enables rapid ARR growth',
    ],
    gaps: [
      'Government legal aid procurement is long cycle',
      'Needs more law firm logos for credibility',
    ],
    recommendedFocusHours: 15,
  },
  {
    productId: 'flow',
    productName: 'Flow',
    pipelineDemand: 60,
    strategicFit: 70,
    revenueSpeed: 85,
    implementationReadiness: 70,
    founderLeverage: 65,
    strengths: [
      'SMB automation = horizontal market, fastest path to unit economics',
      'Channel deal (BIPOC Business Network) enables low-cost distribution',
      'FedDev grant applicability for southern Ontario SMBs',
      'CanExport integration unlocks federal distribution partner',
    ],
    gaps: [
      'Competitive market — needs clear differentiation vs. Zapier/Make',
      'Not Michels primary domain — needs dedicated champion',
      'Channel deal not yet signed',
    ],
    recommendedFocusHours: 10,
  },
  {
    productId: 'zonga',
    productName: 'Zonga',
    pipelineDemand: 55,
    strategicFit: 80,
    revenueSpeed: 65,
    implementationReadiness: 65,
    founderLeverage: 80,
    strengths: [
      'African diaspora music market is underserved and growing',
      'FACTOR grant ($75K) in active application',
      'Cultural mission resonates with Nzila brand identity',
      'Streaming + artist services = multiple revenue streams',
    ],
    gaps: [
      'Music streaming infrastructure is complex and capital-intensive',
      'Licensing deals with labels needed before scale',
      'Revenue slower than B2B products',
    ],
    recommendedFocusHours: 8,
  },
  {
    productId: 'cfo',
    productName: 'CFO Suite',
    pipelineDemand: 45,
    strategicFit: 62,
    revenueSpeed: 72,
    implementationReadiness: 65,
    founderLeverage: 62,
    strengths: [
      'High ARPU potential ($1K+/month per CFO seat)',
      'Natural cross-sell to Flow customers',
      'Finance automation is a clear pain point for SMBs',
    ],
    gaps: [
      'Crowded market (Bench, Pilot.com, etc.)',
      'Not a mission-critical domain for Nzila identity',
      'Needs dedicated finance-domain marketing',
    ],
    recommendedFocusHours: 5,
  },
  {
    productId: 'mobility',
    productName: 'Mobility',
    pipelineDemand: 35,
    strategicFit: 65,
    revenueSpeed: 55,
    implementationReadiness: 60,
    founderLeverage: 50,
    strengths: [
      'Community mobility = social impact alignment',
      'Government grant eligibility (transit, social infrastructure)',
    ],
    gaps: [
      'Very early stage — no closed deals',
      'Complex regulatory environment',
      'Not a primary focus until Union Eyes / FairCase are scaled',
    ],
    recommendedFocusHours: 3,
  },
  {
    productId: 'agrimo',
    productName: 'Agrimo',
    pipelineDemand: 30,
    strategicFit: 70,
    revenueSpeed: 40,
    implementationReadiness: 50,
    founderLeverage: 45,
    strengths: [
      'Food security + African agriculture = strong mission narrative',
      'AgTech government funding available federally',
    ],
    gaps: [
      'Very early — no active deals',
      'Long enterprise sales cycles in agriculture',
      'Not a 2026 priority — park until 2027',
    ],
    recommendedFocusHours: 2,
  },
  {
    productId: 'platform',
    productName: 'Platform / Infrastructure',
    pipelineDemand: 20,
    strategicFit: 52,
    revenueSpeed: 28,
    implementationReadiness: 92,
    founderLeverage: 70,
    strengths: [
      'Most mature codebase in the monorepo',
      'Enables all other products — foundational leverage',
      'IRAP eligibility for AI/ML infrastructure components',
    ],
    gaps: [
      'Internal infrastructure — no direct revenue',
      'Over-investment risk — balance with product focus',
    ],
    recommendedFocusHours: 5,
  },
]

// ── Scoring Engine ────────────────────────────────────────────────────────────

function computeWeightedScore(raw: RawScore): number {
  return Math.round(
    raw.pipelineDemand * WEIGHTS.pipelineDemand +
    raw.strategicFit * WEIGHTS.strategicFit +
    raw.revenueSpeed * WEIGHTS.revenueSpeed +
    raw.implementationReadiness * WEIGHTS.implementationReadiness +
    raw.founderLeverage * WEIGHTS.founderLeverage
  )
}

// ── Service Functions ────────────────────────────────────────────────────────

/** Returns all products ranked by total weighted score */
export function scoreProducts(): ProductScore[] {
  const scored = RAW_SCORES.map((raw) => ({
    productId: raw.productId,
    productName: raw.productName,
    totalScore: computeWeightedScore(raw),
    pipelineDemand: raw.pipelineDemand,
    strategicFit: raw.strategicFit,
    revenueSpeed: raw.revenueSpeed,
    implementationReadiness: raw.implementationReadiness,
    founderLeverage: raw.founderLeverage,
    strengths: raw.strengths,
    gaps: raw.gaps,
    recommendedFocusHours: raw.recommendedFocusHours,
    rank: 0,
  }))

  scored.sort((a, b) => b.totalScore - a.totalScore)
  scored.forEach((s, i) => { s.rank = i + 1 })

  return scored
}

/** Returns top N products by score */
export function getTopProducts(n: number): ProductScore[] {
  return scoreProducts().slice(0, n)
}

/** Returns the single highest-ranked product */
export function getPriorityProduct(): ProductScore {
  return scoreProducts()[0]
}

/** Returns total recommended focus hours across all products */
export function getTotalRecommendedHours(): number {
  return RAW_SCORES.reduce((sum, r) => sum + r.recommendedFocusHours, 0)
}

/** Returns products that are under-prioritized relative to pipeline demand */
export function getUnderPrioritizedProducts(): ProductScore[] {
  return scoreProducts().filter(
    (p) => p.pipelineDemand >= 70 && p.recommendedFocusHours < 10
  )
}
