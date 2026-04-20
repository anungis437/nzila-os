/**
 * @nzila/platform-intelligence-home — Funding Service
 *
 * Enriches the @nzila/platform-lakehouse funding-radar catalog with
 * application tracking metadata: current status, confidence score,
 * deadline calculations, and operational notes.
 *
 * TODO: Replace static overlay with DB queries from lh_funding_applications
 */
import { CANADIAN_FUNDING_PROGRAMS, getFundingByType, getRollingPrograms } from '@nzila/platform-lakehouse/funding-radar'
import type { FundingOpportunity, FundingStatus } from './types'

// ── Application Tracking Overlay ─────────────────────────────────────────────
// Static operational status applied over the catalog.
// In production, this would come from lh_funding_applications table.

interface FundingOverlay {
  status: FundingStatus
  /** Absolute ISO date or null for rolling programs */
  deadlineIso: string | null
  /** 0-100 confidence score: eligibility × timing × effort priority */
  confidenceScore: number
  notes: string | null
}

const FUNDING_OVERLAYS: Record<string, FundingOverlay> = {
  'nrc-irap': {
    status: 'watch',
    deadlineIso: null, // rolling
    confidenceScore: 88,
    notes: 'Contact NRC ITA in Ontario to initiate. Michel to lead — strong CCPC fit for UE + FairCase AI.',
  },
  sred: {
    status: 'watch',
    deadlineIso: null, // annual with tax return
    confidenceScore: 95,
    notes: 'File with FY tax return. Ensure engineering time logs are structured quarterly. Non-negotiable annual claim.',
  },
  'canexport-sme': {
    status: 'apply',
    deadlineIso: null, // rolling
    confidenceScore: 72,
    notes: 'Strong fit for Zonga international music push and Union Eyes US labour expansion. Up to $75K.',
  },
  'feddev-ontario-tis': {
    status: 'apply',
    deadlineIso: '2026-06-30T23:59:59Z',
    confidenceScore: 80,
    notes: 'FedDev Ontario TIS is strong for Flow + Union Eyes. Target $200K–$500K. Deadline June 30.',
  },
  'strategic-innovation-fund': {
    status: 'watch',
    deadlineIso: null,
    confidenceScore: 45,
    notes: 'Too large for current stage (min $10M). Revisit when Nzila is post-Series A.',
  },
  'oci-starter-company': {
    status: 'apply',
    deadlineIso: '2026-05-15T23:59:59Z',
    confidenceScore: 78,
    notes: 'Ontario Starter Company Plus — up to $5K. Low effort, good for early traction proof.',
  },
  'ontario-transfer-payment': {
    status: 'watch',
    deadlineIso: null,
    confidenceScore: 55,
    notes: 'Complex procurement process. Worth tracking for Union Eyes government distribution.',
  },
  'ontario-cultural-media-fund': {
    status: 'apply',
    deadlineIso: '2026-05-31T23:59:59Z',
    confidenceScore: 68,
    notes: 'Zonga qualifies as digital cultural media. Submit before May 31. $25K–$150K.',
  },
  'factor-music': {
    status: 'apply',
    deadlineIso: '2026-06-01T23:59:59Z',
    confidenceScore: 75,
    notes: 'FACTOR Digital Distribution — perfect fit for Zonga. Michel to connect with FACTOR adviser.',
  },
  'canada-council-digital': {
    status: 'watch',
    deadlineIso: null,
    confidenceScore: 60,
    notes: 'Canada Council Digital Strategies — Zonga African music heritage angle. Next intake Q3 2026.',
  },
}

// ── Service Functions ────────────────────────────────────────────────────────

function calcDaysUntilDeadline(deadlineIso: string | null, now: Date): number | null {
  if (!deadlineIso) return null
  const deadline = new Date(deadlineIso)
  const diffMs = deadline.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}

/** Returns all funding opportunities with enriched overlay data */
export function getFundingOpportunities(now: Date = new Date()): FundingOpportunity[] {
  return CANADIAN_FUNDING_PROGRAMS.map((program) => {
    const overlay = FUNDING_OVERLAYS[program.id] ?? {
      status: 'watch' as FundingStatus,
      deadlineIso: null,
      confidenceScore: 50,
      notes: null,
    }

    return {
      id: program.id,
      name: program.name,
      agency: program.agency,
      government: program.government,
      fundingType: program.fundingType,
      typicalMinCad: program.typicalMinCad,
      typicalMaxCad: program.typicalMaxCad,
      deadline: overlay.deadlineIso,
      daysUntilDeadline: calcDaysUntilDeadline(overlay.deadlineIso, now),
      status: overlay.status,
      confidenceScore: overlay.confidenceScore,
      nzilaFit: program.nzilaFit,
      relevantDomains: program.relevantDomains,
      isRecurring: program.isRecurring,
      intakeTiming: program.intakeTiming,
      url: program.url,
      notes: overlay.notes,
    } satisfies FundingOpportunity
  })
}

/** Returns only actionable (apply or watch) opportunities, sorted by confidence desc */
export function getOpenOpportunities(now: Date = new Date()): FundingOpportunity[] {
  return getFundingOpportunities(now)
    .filter((o) => o.status === 'apply' || o.status === 'watch')
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
}

/** Returns opportunities with deadlines in the next N days */
export function getUpcomingDeadlines(daysAhead: number, now: Date = new Date()): FundingOpportunity[] {
  return getFundingOpportunities(now).filter(
    (o) => o.daysUntilDeadline !== null && o.daysUntilDeadline >= 0 && o.daysUntilDeadline <= daysAhead
  ).sort((a, b) => (a.daysUntilDeadline ?? 999) - (b.daysUntilDeadline ?? 999))
}

/** Returns rolling programs ready to apply immediately */
export function getImmediateActions(now: Date = new Date()): FundingOpportunity[] {
  const rolling = getRollingPrograms().map((p) => p.id)
  return getFundingOpportunities(now).filter(
    (o) => rolling.includes(o.id) && (o.status === 'apply' || o.status === 'watch')
  )
}

/** KPI rollup */
export function getFundingKpis(now: Date = new Date()) {
  const all = getFundingOpportunities(now)
  const open = all.filter((o) => o.status === 'apply' || o.status === 'watch')
  const applyNow = all.filter((o) => o.status === 'apply')
  const deadlines30 = getUpcomingDeadlines(30, now)
  const totalMaxCad = open.reduce((sum, o) => sum + (o.typicalMaxCad ?? 0), 0)
  const taxCredits = getFundingByType('tax_credit').length

  return {
    total: all.length,
    openCount: open.length,
    applyNowCount: applyNow.length,
    deadlinesIn30d: deadlines30.length,
    totalMaxAvailableCad: totalMaxCad,
    taxCreditPrograms: taxCredits,
  }
}
