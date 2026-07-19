import { randomUUID } from 'node:crypto'
import {
  situationAssessmentSchema,
  situationAssessmentInputSchema,
  type SituationAssessment,
  type SituationAssessmentInput,
  type SituationPriorityEntry,
} from '../schema/situation'
import type { SituationAppraisalStore } from '../store'

// ─── Situation Appraisal Engine ───────────────────────────────────────────────

export class SituationAppraisalEngine {
  readonly #store: SituationAppraisalStore

  constructor(store: SituationAppraisalStore) {
    this.#store = store
  }

  /**
   * Record a new situation assessment.
   * Computes priority score (urgency × impact) and evaluates escalation.
   */
  async record(input: SituationAssessmentInput): Promise<SituationAssessment> {
    const validated = situationAssessmentInputSchema.parse(input)

    const priorityScore = validated.urgency * validated.impact

    const now = new Date().toISOString()

    const assessment: SituationAssessment = situationAssessmentSchema.parse({
      ...validated,
      id: randomUUID(),
      priorityScore,
      escalated: false,
      escalatedAt: null,
      createdAt: now,
      updatedAt: now,
    })

    await this.#store.append(assessment)
    return assessment
  }

  /**
   * Evaluate whether a situation assessment meets its escalation threshold.
   * Escalation is triggered when urgency >= 4 AND impact >= 4, or if the
   * caller-supplied escalationThreshold is satisfied.
   */
  evaluateEscalation(assessment: SituationAssessment): boolean {
    return assessment.urgency >= 4 && assessment.impact >= 4
  }

  /**
   * Mark an assessment as escalated.
   */
  async escalate(id: string): Promise<SituationAssessment> {
    return this.#store.update(id, {
      escalated: true,
      escalatedAt: new Date().toISOString(),
      status: 'escalated',
      updatedAt: new Date().toISOString(),
    })
  }

  /**
   * Return an org's open assessments sorted by descending priority score.
   * Assessments that require escalation are flagged.
   */
  async prioritize(orgId: string): Promise<SituationPriorityEntry[]> {
    const assessments = await this.#store.getByOrg(orgId, { status: 'open' })

    const sorted = assessments
      .slice()
      .sort((a, b) => b.priorityScore - a.priorityScore)

    return sorted.map((assessment, index) => ({
      assessment,
      priorityRank: index + 1,
      requiresEscalation: this.evaluateEscalation(assessment),
    }))
  }

  /**
   * Compute a composite concern signal score for a collection of assessments.
   * Returns the mean priority score across open, unresolved items.
   */
  computeOrgSignalScore(assessments: SituationAssessment[]): number {
    const open = assessments.filter((a) => a.status !== 'resolved')
    if (open.length === 0) return 0
    const total = open.reduce((sum, a) => sum + a.priorityScore, 0)
    return Math.round(total / open.length)
  }

  /**
   * Return assessments by category across an org.
   */
  async getByOrg(orgId: string): Promise<SituationAssessment[]> {
    return this.#store.getByOrg(orgId)
  }

  async getById(id: string): Promise<SituationAssessment | undefined> {
    return this.#store.getById(id)
  }

  async resolve(id: string): Promise<SituationAssessment> {
    return this.#store.update(id, {
      status: 'resolved',
      updatedAt: new Date().toISOString(),
    })
  }
}
