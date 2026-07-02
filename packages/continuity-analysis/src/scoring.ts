import type {
  ContinuityRiskSignal,
  ContinuityRiskScore,
  GovernanceMaturityIndicator,
  InstitutionalMemoryCoverage,
} from './schema.js'

// ─── Signal Risk Index ────────────────────────────────────────────────────────

/**
 * Compute the composite risk index for a single continuity signal.
 * Formula: severity × exposure × (6 − detectability)
 * Detectability is inverted: harder to detect = higher contribution.
 * Maximum value: 5 × 5 × 5 = 125
 */
export function computeSignalRiskIndex(
  severity: number,
  exposure: number,
  detectability: number,
): number {
  const invertedDetectability = 6 - detectability // harder to detect = 5, trivial = 1
  return severity * exposure * invertedDetectability
}

// ─── Governance Drift Score ───────────────────────────────────────────────────

/**
 * Governance drift score (0–100) is derived from the proportion of signals in
 * the governance-related categories and their weighted risk indexes.
 */
export function computeGovernanceDriftScore(signals: ContinuityRiskSignal[]): number {
  const governanceCategories = new Set([
    'governance-drift',
    'evidence-chain-degradation',
    'escalation-instability',
    'undocumented-process',
  ])

  const relevant = signals.filter((s) => governanceCategories.has(s.category))
  if (relevant.length === 0) return 0

  const maxIndex = 125
  const avgIndex = relevant.reduce((sum, s) => sum + s.riskIndex, 0) / relevant.length
  return Math.min(100, Math.round((avgIndex / maxIndex) * 100))
}

// ─── Operational Fragility Index ─────────────────────────────────────────────

/**
 * Operational fragility index (0–100) measures concentration and dependency risk.
 */
export function computeOperationalFragilityIndex(signals: ContinuityRiskSignal[]): number {
  const fragilityCategories = new Set([
    'founder-dependency',
    'operational-concentration',
    'knowledge-concentration',
    'continuity-debt',
    'organizational-entropy',
  ])

  const relevant = signals.filter((s) => fragilityCategories.has(s.category))
  if (relevant.length === 0) return 0

  const maxIndex = 125
  const avgIndex = relevant.reduce((sum, s) => sum + s.riskIndex, 0) / relevant.length
  return Math.min(100, Math.round((avgIndex / maxIndex) * 100))
}

// ─── Institutional Memory Score ───────────────────────────────────────────────

/**
 * Institutional memory score (0–100, higher = better coverage).
 * Derived from weighted average of domain coverage percentages.
 */
export function computeInstitutionalMemoryScore(coverage: InstitutionalMemoryCoverage[]): number {
  if (coverage.length === 0) return 0
  const avg = coverage.reduce((sum, c) => sum + c.coveragePct, 0) / coverage.length
  return Math.round(avg)
}

// ─── Escalation Instability Score ────────────────────────────────────────────

/**
 * Escalation instability score (0–100) based on escalation-related signals.
 */
export function computeEscalationInstabilityScore(signals: ContinuityRiskSignal[]): number {
  const relevant = signals.filter((s) => s.category === 'escalation-instability')
  if (relevant.length === 0) return 0

  const maxIndex = 125
  const max = relevant.reduce((best, s) => Math.max(best, s.riskIndex), 0)
  return Math.min(100, Math.round((max / maxIndex) * 100))
}

// ─── Governance Maturity Composite ────────────────────────────────────────────

/**
 * Weighted composite governance maturity score (0–100, higher = more mature).
 */
export function computeGovernanceMaturityComposite(
  indicators: GovernanceMaturityIndicator[],
): number {
  if (indicators.length === 0) return 0

  // Weight map — critical dimensions get higher weighting
  const weights: Record<string, number> = {
    'evidence-completeness': 1.5,
    'audit-readiness': 1.5,
    'decision-traceability': 1.3,
    'continuity-documentation': 1.3,
    'succession-planning': 1.2,
    'policy-coverage': 1.0,
    'process-formalisation': 1.0,
    'knowledge-distribution': 1.0,
  }

  let weightedSum = 0
  let totalWeight = 0

  for (const ind of indicators) {
    const w = weights[ind.dimension] ?? 1.0
    weightedSum += ind.score * w
    totalWeight += w
  }

  return totalWeight === 0 ? 0 : Math.round(weightedSum / totalWeight)
}

// ─── Overall Risk Score ───────────────────────────────────────────────────────

/**
 * Composite overall continuity risk score (0–100, higher = riskier).
 * Memory score is inverted because higher coverage = lower risk.
 */
export function computeOverallRiskScore(params: {
  governanceDriftScore: number
  operationalFragilityIndex: number
  institutionalMemoryScore: number  // higher = better = lower risk contribution
  escalationInstabilityScore: number
}): number {
  const memoryRisk = 100 - params.institutionalMemoryScore

  const weighted =
    params.governanceDriftScore * 0.30 +
    params.operationalFragilityIndex * 0.25 +
    memoryRisk * 0.25 +
    params.escalationInstabilityScore * 0.20

  return Math.min(100, Math.round(weighted))
}

// ─── Trend Computation ────────────────────────────────────────────────────────

export function computeTrend(
  currentScore: number,
  previousScore: number | undefined,
): ContinuityRiskScore['trend'] {
  if (previousScore === undefined) return 'insufficient-data'

  const delta = currentScore - previousScore
  if (Math.abs(delta) <= 2) return 'stable'
  if (delta < -5) return 'improving'
  if (delta > 10) return 'volatile'
  if (delta > 0) return 'worsening'
  return 'improving'
}

// ─── Drift Diagnostics ────────────────────────────────────────────────────────

export interface ContinuityTrendPoint {
  at: string
  overallRiskScore: number
  governanceDriftScore: number
  operationalFragilityIndex: number
  institutionalMemoryScore: number
  escalationInstabilityScore: number
}

export interface DriftDiagnostics {
  trajectory: 'improving' | 'stable' | 'degrading' | 'volatile' | 'insufficient-data'
  overallVelocityPct: number
  governanceDriftVelocityPct: number
  operationalConcentrationVelocityPct: number
  institutionalMemoryVelocityPct: number
  escalationInstabilityVelocityPct: number
  accelerationPct: number
}

/**
 * Compute continuity drift diagnostics from ordered time-series points.
 * Velocity is measured as percentage change from first to last point.
 * Acceleration is measured as change in velocity between first half and second half.
 */
export function computeDriftDiagnostics(history: ContinuityTrendPoint[]): DriftDiagnostics {
  if (history.length < 2) {
    return {
      trajectory: 'insufficient-data',
      overallVelocityPct: 0,
      governanceDriftVelocityPct: 0,
      operationalConcentrationVelocityPct: 0,
      institutionalMemoryVelocityPct: 0,
      escalationInstabilityVelocityPct: 0,
      accelerationPct: 0,
    }
  }

  const first = history[0]
  const last = history[history.length - 1]

  const overallVelocityPct = pctChange(first.overallRiskScore, last.overallRiskScore)
  const governanceDriftVelocityPct = pctChange(first.governanceDriftScore, last.governanceDriftScore)
  const operationalConcentrationVelocityPct = pctChange(
    first.operationalFragilityIndex,
    last.operationalFragilityIndex,
  )
  const institutionalMemoryVelocityPct = pctChange(
    first.institutionalMemoryScore,
    last.institutionalMemoryScore,
  )
  const escalationInstabilityVelocityPct = pctChange(
    first.escalationInstabilityScore,
    last.escalationInstabilityScore,
  )

  const mid = Math.floor(history.length / 2)
  const earlyFirst = history[0]
  const earlyLast = history[Math.max(mid - 1, 0)]
  const lateFirst = history[mid]
  const lateLast = history[history.length - 1]
  const earlyVelocity = pctChange(earlyFirst.overallRiskScore, earlyLast.overallRiskScore)
  const lateVelocity = pctChange(lateFirst.overallRiskScore, lateLast.overallRiskScore)
  const accelerationPct = round2(lateVelocity - earlyVelocity)

  const trajectory = classifyTrajectory(overallVelocityPct, accelerationPct)

  return {
    trajectory,
    overallVelocityPct,
    governanceDriftVelocityPct,
    operationalConcentrationVelocityPct,
    institutionalMemoryVelocityPct,
    escalationInstabilityVelocityPct,
    accelerationPct,
  }
}

function classifyTrajectory(
  overallVelocityPct: number,
  accelerationPct: number,
): DriftDiagnostics['trajectory'] {
  if (Math.abs(overallVelocityPct) <= 3) return 'stable'
  if (overallVelocityPct > 0 && Math.abs(accelerationPct) > 10) return 'volatile'
  if (overallVelocityPct > 0) return 'degrading'
  return 'improving'
}

function pctChange(start: number, end: number): number {
  if (start === 0) return end === 0 ? 0 : 100
  return round2(((end - start) / Math.abs(start)) * 100)
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
