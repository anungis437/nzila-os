import { randomUUID } from 'node:crypto'
import {
  problemAnalysisSchema,
  problemAnalysisInputSchema,
  rootCauseHypothesisSchema,
  mitigationRecommendationSchema,
  type ProblemAnalysis,
  type ProblemAnalysisInput,
  type RootCauseHypothesis,
  type MitigationRecommendation,
} from '../schema/problem.js'
import type { ProblemAnalysisStore } from '../store.js'

// ─── Problem Analysis Engine ──────────────────────────────────────────────────

export class ProblemAnalysisEngine {
  readonly #store: ProblemAnalysisStore

  constructor(store: ProblemAnalysisStore) {
    this.#store = store
  }

  /**
   * Initiate a new structured problem analysis using the KT Is / Is Not framework.
   */
  async initiate(input: ProblemAnalysisInput): Promise<ProblemAnalysis> {
    const validated = problemAnalysisInputSchema.parse(input)

    const now = new Date().toISOString()

    const analysis: ProblemAnalysis = problemAnalysisSchema.parse({
      ...validated,
      id: randomUUID(),
      hypotheses: [],
      confirmedCause: null,
      confirmedCauseHypothesisId: null,
      mitigations: [],
      analysisConfidence: 0,
      confidenceSemantics: 'insufficient-evidence',
      evidenceCompleteness: this.#computeEvidenceCompleteness(validated.evidenceRefs),
      assumptionDensity: 0,
      unresolvedUnknowns: 1,
      dependencyVolatility: 'moderate',
      createdAt: now,
      updatedAt: now,
      closedAt: null,
    })

    await this.#store.append(analysis)
    return analysis
  }

  /**
   * Add a root-cause hypothesis to an existing analysis.
   * Each hypothesis must explain the IS observations and NOT the IS NOT observations.
   */
  async addHypothesis(
    analysisId: string,
    input: Omit<RootCauseHypothesis, 'id' | 'status'>,
  ): Promise<ProblemAnalysis> {
    const analysis = await this.#getOrThrow(analysisId)

    const hypothesis: RootCauseHypothesis = rootCauseHypothesisSchema.parse({
      ...input,
      id: randomUUID(),
      status: 'proposed',
    })

    const updated = await this.#store.update(analysisId, {
      hypotheses: [...analysis.hypotheses, hypothesis],
      analysisConfidence: this.#computeConfidence([...analysis.hypotheses, hypothesis]),
      confidenceSemantics: this.#confidenceSemantics(
        this.#computeConfidence([...analysis.hypotheses, hypothesis]),
        analysis.evidenceCompleteness,
      ),
      updatedAt: new Date().toISOString(),
    })

    return updated
  }

  /**
   * Update the status of a hypothesis (proposed → testing → supported/refuted).
   */
  async updateHypothesisStatus(
    analysisId: string,
    hypothesisId: string,
    status: RootCauseHypothesis['status'],
  ): Promise<ProblemAnalysis> {
    const analysis = await this.#getOrThrow(analysisId)

    const hypotheses = analysis.hypotheses.map((h) =>
      h.id === hypothesisId ? { ...h, status } : h,
    )

    return this.#store.update(analysisId, {
      hypotheses,
      analysisConfidence: this.#computeConfidence(hypotheses),
      confidenceSemantics: this.#confidenceSemantics(
        this.#computeConfidence(hypotheses),
        analysis.evidenceCompleteness,
      ),
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Confirm the root cause by linking a hypothesis.
   * Sets analysis status to 'confirmed'.
   */
  async confirmCause(analysisId: string, hypothesisId: string): Promise<ProblemAnalysis> {
    const analysis = await this.#getOrThrow(analysisId)

    const hypothesis = analysis.hypotheses.find((h) => h.id === hypothesisId)
    if (!hypothesis) {
      throw new Error(`Hypothesis ${hypothesisId} not found in analysis ${analysisId}`)
    }

    const hypotheses = analysis.hypotheses.map((h) =>
      h.id === hypothesisId ? { ...h, status: 'confirmed' as const } : h,
    )

    return this.#store.update(analysisId, {
      hypotheses,
      confirmedCause: hypothesis.hypothesis,
      confirmedCauseHypothesisId: hypothesisId,
      status: 'confirmed',
      analysisConfidence: 100,
      confidenceSemantics: 'high',
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Add a mitigation recommendation to a confirmed or investigating analysis.
   */
  async addMitigation(
    analysisId: string,
    input: Omit<MitigationRecommendation, 'id' | 'status'>,
  ): Promise<ProblemAnalysis> {
    const analysis = await this.#getOrThrow(analysisId)

    const mitigation: MitigationRecommendation = mitigationRecommendationSchema.parse({
      ...input,
      id: randomUUID(),
      status: 'proposed',
    })

    return this.#store.update(analysisId, {
      mitigations: [...analysis.mitigations, mitigation],
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Close an analysis once all mitigations are complete or accepted.
   */
  async close(analysisId: string): Promise<ProblemAnalysis> {
    return this.#store.update(analysisId, {
      status: 'closed',
      closedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  async getById(id: string): Promise<ProblemAnalysis | undefined> {
    return this.#store.getById(id)
  }

  async getByOrg(orgId: string): Promise<ProblemAnalysis[]> {
    return this.#store.getByOrg(orgId)
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Analysis confidence is driven by hypothesis quality:
   * - confirmed hypothesis → 100
   * - multiple 'supported' hypotheses → weighted average of individual confidence
   * - no hypotheses → 0
   */
  #computeConfidence(hypotheses: RootCauseHypothesis[]): number {
    if (hypotheses.length === 0) return 0

    const confirmed = hypotheses.find((h) => h.status === 'confirmed')
    if (confirmed) return 100

    const supported = hypotheses.filter((h) => h.status === 'supported')
    if (supported.length === 0) return Math.min(hypotheses.length * 5, 30)

    const avg = supported.reduce((s, h) => s + h.confidence, 0) / supported.length
    return Math.round(avg)
  }

  async #getOrThrow(id: string): Promise<ProblemAnalysis> {
    const analysis = await this.#store.getById(id)
    if (!analysis) throw new Error(`ProblemAnalysis ${id} not found`)
    return analysis
  }

  #computeEvidenceCompleteness(evidenceRefs: string[]): number {
    if (evidenceRefs.length === 0) return 0
    if (evidenceRefs.length >= 5) return 90
    return Math.min(80, evidenceRefs.length * 20)
  }

  #confidenceSemantics(
    confidence: number,
    evidenceCompleteness: number,
  ): ProblemAnalysis['confidenceSemantics'] {
    if (evidenceCompleteness < 30) return 'insufficient-evidence'
    if (confidence >= 80) return 'high'
    if (confidence >= 50) return 'moderate'
    return 'low'
  }
}
