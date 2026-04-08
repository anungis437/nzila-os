import { randomUUID } from 'node:crypto'
import type {
  WorkItem,
  OfficialWorkItem,
  IntakeSubmission,
  PrioritizedWorkItem,
  ScoringWeights,
  SignalScores,
  QueueBucket,
} from '../models/types.js'
import { DEFAULT_WEIGHTS } from '../models/types.js'
import { computePriorityScore, scoreToPriorityLevel } from '../scoring/priorityScore.js'
import { generateExplanation } from '../explanations/generateExplanation.js'
import { createPromptRegistry, CasePromptFamilies, IntakePromptFamilies } from '../prompts/promptRegistry.js'
import type { IntelligenceRequest, IntelligenceResponse } from '@nzila/intelligence'

// ─── NIL Integration Port ────────────────────────────────────────

export interface NilPort {
  reason(request: IntelligenceRequest): Promise<IntelligenceResponse>
}

// ─── Engine Configuration ────────────────────────────────────────

export interface PrioritizationEngineConfig {
  readonly weights: ScoringWeights
  readonly minConfidenceThreshold: number
  readonly conflictDegradeFactor: number
}

const DEFAULT_CONFIG: PrioritizationEngineConfig = {
  weights: DEFAULT_WEIGHTS,
  minConfidenceThreshold: 0.3,
  conflictDegradeFactor: 0.7,
}

// ─── Bucketed Result ─────────────────────────────────────────────

export interface BucketedResult {
  readonly bucket: QueueBucket
  readonly items: readonly PrioritizedWorkItem[]
}

// ─── Intake Priority Item ────────────────────────────────────────

export interface PrioritizedIntake {
  readonly id: string
  readonly priorityScore: number
  readonly reviewUrgency: 'critical' | 'high' | 'medium' | 'low'
  readonly explanation: string
  readonly confidence: number
  readonly auditId: string
}

// ─── Prioritization Engine ───────────────────────────────────────

/**
 * Core prioritization engine.
 * Normalizes work items, aggregates signals, optionally calls NIL for reasoning, and
 * produces a ranked list of prioritized work items with explanations.
 */
export function createPrioritizationEngine(
  nil: NilPort | null,
  config: PrioritizationEngineConfig = DEFAULT_CONFIG,
) {
  return {
    /**
     * Prioritize a set of work items for a given org.
     * Every output includes an auditId for governance traceability.
     */
    async prioritize(
      orgId: string,
      items: readonly WorkItem[],
    ): Promise<readonly PrioritizedWorkItem[]> {
      if (items.length === 0) return []

      // Enforce org isolation
      const orgItems = items.filter((item) => item.orgId === orgId)
      if (orgItems.length === 0) return []

      const now = new Date()
      const results: PrioritizedWorkItem[] = []

      for (const item of orgItems) {
        const auditId = randomUUID()

        const { score, signals } = computePriorityScore(item, orgItems, config.weights, now)

        // Detect conflicting signals and degrade confidence
        const hasConflict = detectConflictingSignals(signals)
        let confidence = computeBaseConfidence(item, signals)

        if (hasConflict) {
          confidence = Math.min(confidence * config.conflictDegradeFactor, 0.5)
        }

        // Insufficient data → low confidence
        if (hasInsufficientData(item)) {
          confidence = Math.min(confidence, 0.42)
        }

        // NIL reasoning enrichment (non-blocking — falls back to heuristic)
        let nilExplanation: string | undefined
        if (nil) {
          try {
            const registry = createPromptRegistry()
            const response = await nil.reason(
              registry.buildRequest({
                family: CasePromptFamilies.PRIORITIZE_WORKLOAD_ITEM,
                orgId,
                input: { workItem: item, signals, score },
              }),
            )
            if (response.success) {
              nilExplanation = response.explanation.summary
              // Blend NIL confidence with heuristic confidence
              confidence = confidence * 0.4 + response.confidence * 0.6
            }
          } catch {
            // NIL unavailable — use heuristic explanation only, no silent failure
          }
        }

        const { explanation, contributingFactors } = generateExplanation(item, signals, score)

        results.push({
          id: item.id,
          priorityScore: round(score, 4),
          priorityLevel: scoreToPriorityLevel(score),
          explanation: nilExplanation ?? explanation,
          confidence: round(confidence, 4),
          contributingFactors,
          auditId,
        })
      }

      // Sort by priority score descending (highest priority first)
      results.sort((a, b) => b.priorityScore - a.priorityScore)

      return results
    },

    /**
     * Score intake submissions for the intake_review queue.
     * Uses urgency indicators only — intakes have no risk/strategic signals
     * since they haven't been assessed by a rep yet.
     */
    async prioritizeIntakes(
      orgId: string,
      intakes: readonly IntakeSubmission[],
    ): Promise<readonly PrioritizedIntake[]> {
      if (intakes.length === 0) return []

      const orgIntakes = intakes.filter((i) => i.orgId === orgId)
      if (orgIntakes.length === 0) return []

      const results: PrioritizedIntake[] = []

      for (const intake of orgIntakes) {
        const auditId = randomUUID()

        // Convert intake to a lightweight WorkItem for scoring
        const asWorkItem: WorkItem = {
          id: intake.id,
          orgId: intake.orgId,
          type: 'grievance',
          title: intake.title,
          description: intake.description,
          createdAt: intake.submittedAt,
          stakeholders: [intake.submittedByMemberId],
          urgencySignals: [...intake.urgencyIndicators],
          riskSignals: [],
          strategicSignals: [],
          metadata: intake.metadata,
        }

        const { score, signals } = computePriorityScore(asWorkItem, [asWorkItem], config.weights)
        let confidence = 0.5 // lower baseline for intakes (not yet assessed)

        if (intake.urgencyIndicators.length > 0) confidence += 0.1
        if (hasInsufficientData(asWorkItem)) confidence = Math.min(confidence, 0.35)

        // NIL reasoning for intake assessment
        if (nil) {
          try {
            const registry = createPromptRegistry()
            const response = await nil.reason(
              registry.buildRequest({
                family: IntakePromptFamilies.ASSESS_INTAKE_URGENCY,
                orgId,
                input: { intake, signals, score },
              }),
            )
            if (response.success) {
              confidence = confidence * 0.4 + response.confidence * 0.6
            }
          } catch {
            // NIL unavailable — use heuristic only
          }
        }

        const level = scoreToPriorityLevel(score)
        const explanation =
          level === 'critical' || level === 'high'
            ? `Intake requires urgent rep review: ${intake.title}`
            : `Intake pending review: ${intake.title}`

        results.push({
          id: intake.id,
          priorityScore: round(score, 4),
          reviewUrgency: level,
          explanation,
          confidence: round(Math.min(confidence, 1), 4),
          auditId,
        })
      }

      results.sort((a, b) => b.priorityScore - a.priorityScore)
      return results
    },

    /**
     * Produce bucketed results: intake_review + active_cases as separate queues.
     */
    async prioritizeBucketed(
      orgId: string,
      intakes: readonly IntakeSubmission[],
      workItems: readonly WorkItem[],
    ): Promise<readonly BucketedResult[]> {
      const [intakeResults, caseResults] = await Promise.all([
        this.prioritizeIntakes(orgId, intakes),
        this.prioritize(orgId, workItems),
      ])

      const buckets: BucketedResult[] = []

      if (intakeResults.length > 0) {
        buckets.push({
          bucket: 'intake_review',
          items: intakeResults.map((i) => ({
            id: i.id,
            priorityScore: i.priorityScore,
            priorityLevel: i.reviewUrgency,
            explanation: i.explanation,
            confidence: i.confidence,
            contributingFactors: ['Intake submission — awaiting rep review'],
            auditId: i.auditId,
          })),
        })
      }

      if (caseResults.length > 0) {
        buckets.push({
          bucket: 'active_cases',
          items: caseResults,
        })
      }

      return buckets
    },
  }
}

// ─── Conflict Detection ──────────────────────────────────────────

function detectConflictingSignals(signals: SignalScores): boolean {
  // High risk but low urgency, or vice versa — conflicting pressure
  const riskUrgencyConflict =
    (signals.risk >= 0.7 && signals.urgency <= 0.3) ||
    (signals.urgency >= 0.7 && signals.risk <= 0.3)

  return riskUrgencyConflict
}

// ─── Confidence Computation ──────────────────────────────────────

function computeBaseConfidence(item: WorkItem, signals: SignalScores): number {
  let confidence = 0.6 // baseline

  // More signals → higher confidence
  const totalSignals =
    item.urgencySignals.length + item.riskSignals.length + item.strategicSignals.length
  if (totalSignals >= 3) confidence += 0.15
  else if (totalSignals >= 1) confidence += 0.05

  // Strong signal agreement → higher confidence
  const signalValues = [signals.urgency, signals.risk, signals.strategic]
  const avg = signalValues.reduce((a, b) => a + b, 0) / signalValues.length
  const variance =
    signalValues.reduce((sum, v) => sum + (v - avg) ** 2, 0) / signalValues.length
  if (variance < 0.05) confidence += 0.1 // signals agree

  return Math.min(confidence, 1)
}

// ─── Data Sufficiency Check ──────────────────────────────────────

function hasInsufficientData(item: WorkItem): boolean {
  return (
    item.urgencySignals.length === 0 &&
    item.riskSignals.length === 0 &&
    item.strategicSignals.length === 0
  )
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
