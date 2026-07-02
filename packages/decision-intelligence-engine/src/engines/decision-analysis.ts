import { randomUUID } from 'node:crypto'
import {
  decisionAnalysisSchema,
  decisionAnalysisInputSchema,
  alternativeSchema,
  approverSchema,
  riskAcceptanceSchema,
  mitigationCommitmentSchema,
  type DecisionAnalysis,
  type DecisionAnalysisInput,
  type Alternative,
  type Approver,
  type RiskAcceptance,
  type MitigationCommitment,
  type DecisionScoringResult,
} from '../schema/decision.js'
import type { DecisionAnalysisStore } from '../store.js'

// ─── Decision Analysis Engine ─────────────────────────────────────────────────

export class DecisionAnalysisEngine {
  readonly #store: DecisionAnalysisStore

  constructor(store: DecisionAnalysisStore) {
    this.#store = store
  }

  /**
   * Create a new decision analysis with MUST and WANT criteria scaffolded.
   * Alternatives are added separately to support iterative discovery.
   */
  async create(input: DecisionAnalysisInput): Promise<DecisionAnalysis> {
    const validated = decisionAnalysisInputSchema.parse(input)

    const now = new Date().toISOString()

    const decision: DecisionAnalysis = decisionAnalysisSchema.parse({
      ...validated,
      id: randomUUID(),
      alternatives: [],
      rejectedAlternatives: [],
      selectedAlternativeId: null,
      rationale: '',
      rationaleEvidenceRefs: [],
      riskAcceptances: [],
      mitigationCommitments: [],
      approvers: [],
      allApproversSignedOff: false,
      confidenceSemantics: validated.confidenceSemantics,
      evidenceCompleteness: validated.evidenceCompleteness,
      assumptionDensity: validated.assumptionDensity,
      unresolvedUnknowns: validated.unresolvedUnknowns,
      dependencyVolatility: validated.dependencyVolatility,
      supersededBy: null,
      createdAt: now,
      updatedAt: now,
      decidedAt: null,
    })

    await this.#store.append(decision)
    return decision
  }

  /**
   * Add an alternative option for evaluation.
   * Weighted scores are automatically computed from want criteria.
   */
  async addAlternative(
    decisionId: string,
    input: Omit<Alternative, 'id' | 'weightedScore' | 'passesAllMust'>,
  ): Promise<DecisionAnalysis> {
    const decision = await this.#getOrThrow(decisionId)

    const weightedScore = this.#computeWeightedScore(input, decision)
    const passesAllMust = this.#evaluateMustCriteria(input, decision)

    const alternative: Alternative = alternativeSchema.parse({
      ...input,
      id: randomUUID(),
      weightedScore,
      passesAllMust,
    })

    return this.#store.update(decisionId, {
      alternatives: [...decision.alternatives, alternative],
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Score all alternatives and return a structured scoring matrix.
   * Eliminates alternatives that fail any MUST criterion.
   */
  async score(decisionId: string): Promise<DecisionScoringResult> {
    const decision = await this.#getOrThrow(decisionId)

    const viable: Alternative[] = []
    const eliminated: DecisionScoringResult['eliminatedAlternatives'] = []

    for (const alt of decision.alternatives) {
      const failedCriteria: string[] = []

      for (const must of decision.mustCriteria) {
        const score = alt.mustScores[must.id]
        const passes = must.isGo ? score === true : score === false
        if (!passes) {
          failedCriteria.push(must.label)
        }
      }

      if (failedCriteria.length > 0) {
        eliminated.push({
          alternativeId: alt.id,
          name: alt.name,
          failedCriteria,
        })
      } else {
        viable.push(alt)
      }
    }

    const scoringMatrix = viable.map((alt) => ({
      alternativeId: alt.id,
      name: alt.name,
      weightedScore: alt.weightedScore,
      mustPass: alt.passesAllMust,
      criterionScores: decision.wantCriteria.map((crit) => {
        const score = alt.wantScores[crit.id] ?? 0
        return {
          criterionId: crit.id,
          label: crit.label,
          weight: crit.weight,
          score,
          weightedContribution: score * crit.weight,
        }
      }),
    }))

    const sorted = scoringMatrix.slice().sort((a, b) => b.weightedScore - a.weightedScore)
    const recommendedAlternativeId = sorted[0]?.alternativeId ?? null

    return {
      decisionId,
      viableAlternatives: viable,
      eliminatedAlternatives: eliminated,
      recommendedAlternativeId,
      scoringMatrix: sorted,
    }
  }

  /**
   * Record the final decision, linking the selected alternative and rationale.
   * Sets status to 'decided'.
   */
  async decide(
    decisionId: string,
    selectedAlternativeId: string,
    rationale: string,
    rationaleEvidenceRefs: string[] = [],
  ): Promise<DecisionAnalysis> {
    const decision = await this.#getOrThrow(decisionId)

    const alt = decision.alternatives.find((a) => a.id === selectedAlternativeId)
    if (!alt) {
      throw new Error(`Alternative ${selectedAlternativeId} not found in decision ${decisionId}`)
    }

    // Record alternatives that were not selected
    const rejected = decision.alternatives
      .filter((a) => a.id !== selectedAlternativeId)
      .map((a) => ({
        alternativeId: a.id,
        rejectionReason: 'Not selected in final decision',
        failedMustCriteria: Object.entries(a.mustScores)
          .filter(([criterionId, passes]) => {
            const must = decision.mustCriteria.find((c) => c.id === criterionId)
            if (!must) return false
            return must.isGo ? !passes : passes
          })
          .map(([criterionId]) => {
            return decision.mustCriteria.find((c) => c.id === criterionId)?.label ?? criterionId
          }),
      }))

    return this.#store.update(decisionId, {
      selectedAlternativeId,
      rationale,
      rationaleEvidenceRefs,
      rejectedAlternatives: rejected,
      confidenceSemantics: this.#computeConfidenceSemantics(decision, rationaleEvidenceRefs.length),
      status: 'decided',
      decidedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Add an approver sign-off.
   * Marks allApproversSignedOff when all registered approvers have signed.
   */
  async signOff(
    decisionId: string,
    approverId: string,
    notes: string = '',
  ): Promise<DecisionAnalysis> {
    const decision = await this.#getOrThrow(decisionId)

    const approvers = decision.approvers.map((a) =>
      a.actorId === approverId
        ? { ...a, signedOff: true, approvedAt: new Date().toISOString(), notes }
        : a,
    )

    const allSignedOff = approvers.length > 0 && approvers.every((a) => a.signedOff)

    return this.#store.update(decisionId, {
      approvers,
      allApproversSignedOff: allSignedOff,
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Add a risk acceptance to the decision record.
   */
  async addRiskAcceptance(
    decisionId: string,
    input: Omit<RiskAcceptance, 'id'>,
  ): Promise<DecisionAnalysis> {
    const decision = await this.#getOrThrow(decisionId)

    const risk: RiskAcceptance = riskAcceptanceSchema.parse({
      ...input,
      id: randomUUID(),
    })

    return this.#store.update(decisionId, {
      riskAcceptances: [...decision.riskAcceptances, risk],
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Add a mitigation commitment.
   */
  async addMitigationCommitment(
    decisionId: string,
    input: Omit<MitigationCommitment, 'id'>,
  ): Promise<DecisionAnalysis> {
    const decision = await this.#getOrThrow(decisionId)

    const commitment: MitigationCommitment = mitigationCommitmentSchema.parse({
      ...input,
      id: randomUUID(),
    })

    return this.#store.update(decisionId, {
      mitigationCommitments: [...decision.mitigationCommitments, commitment],
      updatedAt: new Date().toISOString(),
    })
  }

  async getById(id: string): Promise<DecisionAnalysis | undefined> {
    return this.#store.getById(id)
  }

  async getByOrg(orgId: string): Promise<DecisionAnalysis[]> {
    return this.#store.getByOrg(orgId)
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  #computeWeightedScore(
    alt: Pick<Alternative, 'wantScores'>,
    decision: DecisionAnalysis,
  ): number {
    return decision.wantCriteria.reduce((total, crit) => {
      const score = alt.wantScores[crit.id] ?? 0
      return total + score * crit.weight
    }, 0)
  }

  #evaluateMustCriteria(
    alt: Pick<Alternative, 'mustScores'>,
    decision: DecisionAnalysis,
  ): boolean {
    return decision.mustCriteria.every((must) => {
      const score = alt.mustScores[must.id]
      return must.isGo ? score === true : score === false
    })
  }

  async #getOrThrow(id: string): Promise<DecisionAnalysis> {
    const decision = await this.#store.getById(id)
    if (!decision) throw new Error(`DecisionAnalysis ${id} not found`)
    return decision
  }

  #computeConfidenceSemantics(
    decision: DecisionAnalysis,
    rationaleEvidenceCount: number,
  ): DecisionAnalysis['confidenceSemantics'] {
    if (rationaleEvidenceCount === 0 || decision.evidenceCompleteness < 30) {
      return 'insufficient-evidence'
    }

    if (
      decision.evidenceCompleteness >= 75 &&
      decision.unresolvedUnknowns <= 1 &&
      decision.dependencyVolatility === 'low'
    ) {
      return 'high'
    }

    if (
      decision.evidenceCompleteness >= 50 &&
      decision.unresolvedUnknowns <= 3 &&
      decision.dependencyVolatility !== 'high'
    ) {
      return 'moderate'
    }

    return 'low'
  }
}
