/**
 * Next-best-action recommender.
 *
 * Pure deterministic rule layer over a {@link LeadScore}. Every recommendation
 * carries a rationale and inherits the score's confidence — no fabricated
 * urgency.
 */
import type { LeadScore, NextBestAction } from '../types'
import { nowISO } from '../utils'

export const NBA_VERSION = 'nba-rules-v1'

/**
 * Deterministic recommender. Returns null if no rule fires.
 */
export function recommendNextBestAction(score: LeadScore): NextBestAction | null {
  const features = featuresFromContributions(score)

  // Highest-impact rules first.

  if (score.stage === 'churn_risk') {
    return mk(score, 'escalate_to_founder',
      'Churn-risk stage: negative signals dominate; founder-level outreach reduces escalation probability.',
      24)
  }

  if (score.stage === 'in_pilot' && score.score >= 0.7) {
    return mk(score, 'request_testimonial',
      'Pilot is healthy and engaged: capture proof while momentum is high.',
      168 /* 7d */)
  }

  if (score.stage === 'qualified' && features.partnerInfluenced) {
    return mk(score, 'partner_co_sell',
      'Qualified deal with partner influence: co-sell motion converts faster than direct.',
      48)
  }

  if (score.stage === 'qualified') {
    return mk(score, 'send_proof_packet',
      'Qualified score with no partner influence: send the commercial packet to advance to proposal.',
      48)
  }

  if (score.stage === 'engaged' && features.hasProcurementSignal) {
    return mk(score, 'schedule_demo',
      'Engaged with procurement signals: a scoped demo is the highest-value next touch.',
      72)
  }

  if (score.stage === 'engaged') {
    return mk(score, 'send_followup',
      'Engaged but no procurement signal yet: targeted followup to surface buying intent.',
      48)
  }

  if (score.stage === 'warming') {
    return mk(score, 'send_followup',
      'Warming: nurture with a relevant proof asset to advance to engaged.',
      120 /* 5d */)
  }

  if (score.stage === 'dormant') {
    return mk(score, 'pause_outreach',
      'Dormant: pause active outreach until a re-engagement signal arrives.',
      720 /* 30d */)
  }

  if (score.stage === 'paid' && score.score >= 0.65) {
    return mk(score, 'upsell_pitch',
      'Paid customer with high score: surface an expansion or cross-sell offer.',
      336 /* 14d */)
  }

  return null
}

function mk(
  score: LeadScore,
  action: NextBestAction['action'],
  rationale: string,
  withinHours: number,
): NextBestAction {
  return {
    scope: score.scope,
    subjectKind: score.subjectKind,
    subjectId: score.subjectId,
    action,
    rationale,
    withinHours,
    confidence: score.confidence,
    sourceScoreId: score.id,
    generatedAt: nowISO(),
  }
}

interface QuickFeatures {
  partnerInfluenced: boolean
  hasProcurementSignal: boolean
  hasActivePilot: boolean
}

function featuresFromContributions(score: LeadScore): QuickFeatures {
  const find = (key: string) => score.contributions.find((c) => c.feature === key)?.value ?? 0
  return {
    partnerInfluenced: find('partnerInfluenced') > 0,
    hasProcurementSignal: find('hasProcurementSignal') > 0,
    hasActivePilot: find('hasActivePilot') > 0,
  }
}

/** Recommend across a list of latest scores; null actions are dropped. */
export function recommendBatch(scores: readonly LeadScore[]): NextBestAction[] {
  const out: NextBestAction[] = []
  for (const s of scores) {
    const a = recommendNextBestAction(s)
    if (a) out.push(a)
  }
  return out
}
