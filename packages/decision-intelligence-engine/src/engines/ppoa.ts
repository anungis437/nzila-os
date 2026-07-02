import { randomUUID } from 'node:crypto'
import {
  ppoaAnalysisSchema,
  ppoaAnalysisInputSchema,
  potentialRiskSchema,
  potentialOpportunitySchema,
  type PPOAAnalysis,
  type PPOAAnalysisInput,
  type PotentialRisk,
  type PotentialOpportunity,
  type ReadinessReport,
} from '../schema/ppoa.js'
import type { PPOAStore } from '../store.js'

// ─── PPOA Engine ──────────────────────────────────────────────────────────────

export class PPOAEngine {
  readonly #store: PPOAStore

  constructor(store: PPOAStore) {
    this.#store = store
  }

  /**
   * Create a new Potential Problem / Opportunity Analysis.
   * Operational readiness and rollout confidence are computed as risks and
   * opportunities are added.
   */
  async create(input: PPOAAnalysisInput): Promise<PPOAAnalysis> {
    const validated = ppoaAnalysisInputSchema.parse(input)

    const now = new Date().toISOString()

    const analysis: PPOAAnalysis = ppoaAnalysisSchema.parse({
      ...validated,
      id: randomUUID(),
      risks: [],
      opportunities: [],
      operationalReadinessScore: 100,
      rolloutConfidenceScore: 100,
      criticalRiskCount: 0,
      createdAt: now,
      updatedAt: now,
    })

    await this.#store.append(analysis)
    return analysis
  }

  /**
   * Add a potential risk with computed risk score (probability × severity).
   * Recomputes readiness and confidence scores.
   */
  async addRisk(
    analysisId: string,
    input: Omit<PotentialRisk, 'id' | 'riskScore' | 'status'>,
  ): Promise<PPOAAnalysis> {
    const analysis = await this.#getOrThrow(analysisId)

    const riskScore = input.probability * input.severity

    const risk: PotentialRisk = potentialRiskSchema.parse({
      ...input,
      id: randomUUID(),
      riskScore,
      status: 'identified',
    })

    const updatedRisks = [...analysis.risks, risk]

    return this.#store.update(analysisId, {
      risks: updatedRisks,
      ...this.#recomputeScores(updatedRisks, analysis.opportunities, analysis.criticalRiskThreshold),
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Add a potential opportunity with computed opportunity score.
   * Recomputes rollout confidence score.
   */
  async addOpportunity(
    analysisId: string,
    input: Omit<PotentialOpportunity, 'id' | 'opportunityScore' | 'status'>,
  ): Promise<PPOAAnalysis> {
    const analysis = await this.#getOrThrow(analysisId)

    const opportunityScore = input.probability * input.impact

    const opportunity: PotentialOpportunity = potentialOpportunitySchema.parse({
      ...input,
      id: randomUUID(),
      opportunityScore,
      status: 'identified',
    })

    const updatedOpportunities = [...analysis.opportunities, opportunity]

    return this.#store.update(analysisId, {
      opportunities: updatedOpportunities,
      ...this.#recomputeScores(analysis.risks, updatedOpportunities, analysis.criticalRiskThreshold),
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Update the status of a risk (e.g. identified → mitigated).
   */
  async updateRiskStatus(
    analysisId: string,
    riskId: string,
    status: PotentialRisk['status'],
  ): Promise<PPOAAnalysis> {
    const analysis = await this.#getOrThrow(analysisId)

    const risks = analysis.risks.map((r) => (r.id === riskId ? { ...r, status } : r))

    return this.#store.update(analysisId, {
      risks,
      ...this.#recomputeScores(risks, analysis.opportunities, analysis.criticalRiskThreshold),
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Generate a readiness report with recommendation.
   */
  async generateReadinessReport(analysisId: string): Promise<ReadinessReport> {
    const analysis = await this.#getOrThrow(analysisId)

    const criticalRisks = analysis.risks.filter(
      (r) => r.riskScore >= analysis.criticalRiskThreshold && r.status !== 'mitigated',
    )

    const topOpportunities = analysis.opportunities
      .slice()
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, 5)

    const recommendation = this.#computeRecommendation(analysis)
    const rationale = this.#buildReadinessRationale(analysis, criticalRisks)

    return {
      analysisId,
      operationalReadinessScore: analysis.operationalReadinessScore,
      rolloutConfidenceScore: analysis.rolloutConfidenceScore,
      criticalRisks,
      topOpportunities,
      recommendation,
      rationale,
    }
  }

  async getById(id: string): Promise<PPOAAnalysis | undefined> {
    return this.#store.getById(id)
  }

  async getByOrg(orgId: string): Promise<PPOAAnalysis[]> {
    return this.#store.getByOrg(orgId)
  }

  // ─── Private scoring ──────────────────────────────────────────────────────────

  #recomputeScores(
    risks: PotentialRisk[],
    opportunities: PotentialOpportunity[],
    criticalThreshold: number,
  ): Pick<PPOAAnalysis, 'operationalReadinessScore' | 'rolloutConfidenceScore' | 'criticalRiskCount'> {
    const activeRisks = risks.filter((r) => r.status !== 'mitigated' && r.status !== 'accepted')
    const criticalRisks = activeRisks.filter((r) => r.riskScore >= criticalThreshold)
    const criticalRiskCount = criticalRisks.length

    // Readiness: starts at 100, deducted by active risk scores (weighted by severity)
    const totalRiskDeduction = activeRisks.reduce((sum, r) => sum + r.riskScore * 2, 0)
    const operationalReadinessScore = Math.max(0, Math.round(100 - totalRiskDeduction / Math.max(activeRisks.length, 1)))

    // Confidence: readiness boosted by opportunities, penalized by critical risks
    const opportunityBoost = Math.min(
      10,
      opportunities.filter((o) => o.status !== 'missed').reduce((sum, o) => sum + o.opportunityScore / 25, 0),
    )
    const criticalPenalty = criticalRiskCount * 15
    const rolloutConfidenceScore = Math.max(
      0,
      Math.min(100, Math.round(operationalReadinessScore + opportunityBoost - criticalPenalty)),
    )

    return { operationalReadinessScore, rolloutConfidenceScore, criticalRiskCount }
  }

  #computeRecommendation(analysis: PPOAAnalysis): ReadinessReport['recommendation'] {
    if (analysis.rolloutConfidenceScore >= 80) return 'proceed'
    if (analysis.rolloutConfidenceScore >= 60) return 'proceed-with-conditions'
    if (analysis.rolloutConfidenceScore >= 30) return 'defer'
    return 'abort'
  }

  #buildReadinessRationale(analysis: PPOAAnalysis, criticalRisks: PotentialRisk[]): string {
    const parts: string[] = []

    parts.push(
      `Operational readiness: ${analysis.operationalReadinessScore}/100. ` +
        `Rollout confidence: ${analysis.rolloutConfidenceScore}/100.`,
    )

    if (criticalRisks.length > 0) {
      parts.push(
        `${criticalRisks.length} critical risk(s) identified that require attention before proceeding.`,
      )
    }

    if (analysis.opportunities.length > 0) {
      parts.push(
        `${analysis.opportunities.length} opportunity/opportunities identified that may be leveraged.`,
      )
    }

    return parts.join(' ')
  }

  async #getOrThrow(id: string): Promise<PPOAAnalysis> {
    const analysis = await this.#store.getById(id)
    if (!analysis) throw new Error(`PPOAAnalysis ${id} not found`)
    return analysis
  }
}
