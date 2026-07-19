import { randomUUID } from 'node:crypto'
import {
  continuityRiskScoreSchema,
  continuityDriftEventSchema,
  type ContinuityRiskScore,
  type ContinuityRiskSignal,
  type ContinuityDriftEvent,
  type ContinuityAssessmentInput,
} from './schema'
import type { ContinuityAnalysisStore } from './store'
import {
  computeSignalRiskIndex,
  computeGovernanceDriftScore,
  computeOperationalFragilityIndex,
  computeInstitutionalMemoryScore,
  computeEscalationInstabilityScore,
  computeOverallRiskScore,
  computeTrend,
} from './scoring'

// ─── Continuity Analysis Engine ───────────────────────────────────────────────

export class ContinuityAnalysisEngine {
  readonly #store: ContinuityAnalysisStore

  constructor(store: ContinuityAnalysisStore) {
    this.#store = store
  }

  /**
   * Run a full continuity assessment for an org.
   * Computes all composite scores and stores the result as an append-only snapshot.
   */
  async assess(input: ContinuityAssessmentInput): Promise<ContinuityRiskScore> {
    const now = new Date().toISOString()

    // Hydrate signals with computed risk indexes
    const signals: ContinuityRiskSignal[] = input.signals.map((s) => ({
      ...s,
      id: randomUUID(),
      riskIndex: computeSignalRiskIndex(s.severity, s.exposure, s.detectability),
      detectedAt: now,
      updatedAt: now,
    }))

    const governanceDriftScore = computeGovernanceDriftScore(signals)
    const operationalFragilityIndex = computeOperationalFragilityIndex(signals)
    const institutionalMemoryScore = computeInstitutionalMemoryScore(input.memoryCoverage)
    const escalationInstabilityScore = computeEscalationInstabilityScore(signals)
    const overallRiskScore = computeOverallRiskScore({
      governanceDriftScore,
      operationalFragilityIndex,
      institutionalMemoryScore,
      escalationInstabilityScore,
    })

    const previous = input.previousScore
    const trend = computeTrend(overallRiskScore, previous?.overallRiskScore)
    const trendDelta = previous ? overallRiskScore - previous.overallRiskScore : 0

    const score: ContinuityRiskScore = continuityRiskScoreSchema.parse({
      orgId: input.orgId,
      computedAt: now,
      overallRiskScore,
      governanceDriftScore,
      operationalFragilityIndex,
      institutionalMemoryScore,
      escalationInstabilityScore,
      signals,
      maturityIndicators: input.maturityIndicators,
      memoryCoverage: input.memoryCoverage,
      trend,
      trendDelta,
      alertThreshold: 65,
      criticalThreshold: 80,
    })

    await this.#store.appendScore(score)
    return score
  }

  /**
   * Retrieve the latest continuity risk score for an org.
   */
  async getLatestScore(orgId: string): Promise<ContinuityRiskScore | undefined> {
    return this.#store.getLatestScore(orgId)
  }

  /**
   * Retrieve historical scores for trend analysis.
   */
  async getScoreHistory(orgId: string, limit = 12): Promise<ContinuityRiskScore[]> {
    return this.#store.getScoreHistory(orgId, limit)
  }

  /**
   * Record a continuity drift event.
   */
  async recordDriftEvent(
    input: Omit<ContinuityDriftEvent, 'id'>,
  ): Promise<ContinuityDriftEvent> {
    const event: ContinuityDriftEvent = continuityDriftEventSchema.parse({
      ...input,
      id: randomUUID(),
    })

    await this.#store.appendDriftEvent(event)
    return event
  }

  /**
   * Resolve a drift event.
   */
  async resolveDriftEvent(
    id: string,
    remediation: string,
  ): Promise<ContinuityDriftEvent> {
    return this.#store.updateDriftEvent(id, {
      status: 'resolved',
      resolvedAt: new Date().toISOString(),
      remediation,
    })
  }

  /**
   * Get all active (non-resolved) drift events for an org.
   */
  async getActiveDriftEvents(orgId: string): Promise<ContinuityDriftEvent[]> {
    const all = await this.#store.getDriftEvents(orgId)
    return all.filter((e) => e.status !== 'resolved' && e.status !== 'accepted')
  }

  /**
   * Determine if the org is above the alert threshold.
   */
  isAtRisk(score: ContinuityRiskScore): boolean {
    return score.overallRiskScore >= score.alertThreshold
  }

  /**
   * Determine if the org is at a critical continuity risk level.
   */
  isCritical(score: ContinuityRiskScore): boolean {
    return score.overallRiskScore >= score.criticalThreshold
  }
}
