/**
 * Lead/deal scoring — interpretable, version-pinned logistic.
 *
 * Phase-1 honesty: NOT trained. Hand-calibrated coefficients with per-feature
 * contributions, exactly mirroring the cognition trajectory pattern.
 *
 * When `@nzila/ml-core` promotes a trained model with the same feature
 * contract, bump `LEAD_SCORE_MODEL_VERSION` and swap WEIGHTS.
 */
import { leadScoreSchema } from '../schemas'
import { listRecords, writeRecord } from '../store'
import type {
  GrowthScope,
  LeadScore,
  LeadScoreFeatures,
  LeadStage,
  ScoreContribution,
} from '../types'
import { clamp01, makeId, nowISO, scopeKey, sigmoid } from '../utils'

export const LEAD_SCORE_MODEL_VERSION = 'lead-logistic-v1'

const ENTITY = 'lead-score'

interface FeatureWeight {
  feature: keyof LeadScoreFeatures
  weight: number
  /** Maps a feature value to a normalized [0,1] saturated input. */
  normalize: (v: number | boolean) => number
}

const WEIGHTS: FeatureWeight[] = [
  // Recency: fresher = better. 30 days saturates to 0.
  { feature: 'recencyDays', weight: 1.4, normalize: (v) => clamp01(1 - Number(v) / 30) },
  // Event count: caps at 10 events.
  { feature: 'eventCount', weight: 0.9, normalize: (v) => clamp01(Number(v) / 10) },
  // Channel diversity: 4+ distinct channels saturates.
  { feature: 'channelDiversity', weight: 0.6, normalize: (v) => clamp01(Number(v) / 4) },
  // Positive signal sum: caps at 5.
  { feature: 'positiveSignal', weight: 0.8, normalize: (v) => clamp01(Number(v) / 5) },
  // Negative signal sum: caps at 5 — applied with negative coefficient via score input.
  { feature: 'negativeSignal', weight: -1.2, normalize: (v) => clamp01(Number(v) / 5) },
  // Has active pilot: large positive boost.
  { feature: 'hasActivePilot', weight: 1.6, normalize: (v) => (v ? 1 : 0) },
  // Procurement signal: substantive boost.
  { feature: 'hasProcurementSignal', weight: 1.0, normalize: (v) => (v ? 1 : 0) },
  // Partner-influenced: modest boost (channel quality).
  { feature: 'partnerInfluenced', weight: 0.5, normalize: (v) => (v ? 1 : 0) },
]

const INTERCEPT = -1.0

function dataConfidence(features: LeadScoreFeatures): number {
  if (features.eventCount < 1) return 0.05
  if (features.eventCount >= 10) return 1
  return 0.05 + (features.eventCount / 10) * 0.95
}

/**
 * Compute a score for a single subject. Pure; no IO.
 */
export function computeLeadScore(features: LeadScoreFeatures): {
  score: number
  contributions: ScoreContribution[]
  confidence: number
} {
  let logit = INTERCEPT
  const contributions: ScoreContribution[] = []
  for (const w of WEIGHTS) {
    const raw = features[w.feature] as number | boolean
    const value = w.normalize(raw)
    const contribution = w.weight * value
    logit += contribution
    contributions.push({
      feature: w.feature,
      weight: w.weight,
      value,
      contribution,
    })
  }
  return {
    score: clamp01(sigmoid(logit)),
    contributions,
    confidence: dataConfidence(features),
  }
}

/**
 * Map a [0,1] score + features to a {@link LeadStage}. Deterministic.
 *
 * Order of precedence (highest first):
 *   1. Active pilot AND high score    → 'in_pilot'
 *   2. Strong negative signal         → 'churn_risk'
 *   3. Recency > 60 days, no events   → 'dormant'
 *   4. score >= 0.7                   → 'qualified'
 *   5. score >= 0.45                  → 'engaged'
 *   6. score >= 0.25                  → 'warming'
 *   7. otherwise                      → 'cold'
 */
export function deriveLeadStage(score: number, features: LeadScoreFeatures): LeadStage {
  if (features.hasActivePilot && score >= 0.5) return 'in_pilot'
  if (features.negativeSignal >= 3 && score < 0.5) return 'churn_risk'
  if (features.recencyDays > 60 && features.eventCount === 0) return 'dormant'
  if (score >= 0.7) return 'qualified'
  if (score >= 0.45) return 'engaged'
  if (score >= 0.25) return 'warming'
  return 'cold'
}

export interface ScoreLeadInput {
  scope: GrowthScope
  subjectKind: LeadScore['subjectKind']
  subjectId: string
  features: LeadScoreFeatures
  scoredAt?: string
}

/** Score and persist. */
export function scoreLead(input: ScoreLeadInput): LeadScore {
  const { score, contributions, confidence } = computeLeadScore(input.features)
  const record: LeadScore = {
    id: makeId('score'),
    scope: input.scope,
    subjectKind: input.subjectKind,
    subjectId: input.subjectId,
    score,
    stage: deriveLeadStage(score, input.features),
    confidence,
    contributions,
    modelVersion: LEAD_SCORE_MODEL_VERSION,
    scoredAt: input.scoredAt ?? nowISO(),
  }
  return writeRecord(ENTITY, record.id, record, leadScoreSchema) as LeadScore
}

export function listLeadScores(scope?: GrowthScope, subjectId?: string): LeadScore[] {
  return (listRecords(ENTITY, leadScoreSchema) as LeadScore[]).filter((s) => {
    if (scope && scopeKey(s.scope) !== scopeKey(scope)) return false
    if (subjectId && s.subjectId !== subjectId) return false
    return true
  })
}

/** Most recent score per (subjectKind, subjectId) within scope. */
export function latestLeadScores(scope: GrowthScope): LeadScore[] {
  const all = listLeadScores(scope)
  const byKey = new Map<string, LeadScore>()
  for (const s of all) {
    const key = `${s.subjectKind}::${s.subjectId}`
    const cur = byKey.get(key)
    if (!cur || s.scoredAt > cur.scoredAt) byKey.set(key, s)
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score)
}
