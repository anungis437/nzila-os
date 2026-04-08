import type {
  WorkItem,
  PrioritizedWorkItem,
  PrioritizationResult,
  ScoringWeights,
  IntakeSubmission,
} from '../models/types.js'
import { workItemSchema, intakeSubmissionSchema, DEFAULT_WEIGHTS } from '../models/types.js'
import {
  createPrioritizationEngine,
  type NilPort,
  type PrioritizationEngineConfig,
  type BucketedResult,
} from '../engine/prioritizationEngine.js'

// ─── Work Item Source Port ───────────────────────────────────────

export interface WorkItemSource {
  fetchActiveWorkItems(orgId: string): Promise<readonly WorkItem[]>
}

// ─── Intake Source Port ──────────────────────────────────────────

export interface IntakeSource {
  fetchPendingIntakes(orgId: string): Promise<readonly IntakeSubmission[]>
}

// ─── Orchestrator Configuration ──────────────────────────────────

export interface OrchestratorConfig {
  readonly weights: ScoringWeights
  readonly maxItems: number
  readonly engineConfig: PrioritizationEngineConfig
}

const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  weights: DEFAULT_WEIGHTS,
  maxItems: 50,
  engineConfig: {
    weights: DEFAULT_WEIGHTS,
    minConfidenceThreshold: 0.3,
    conflictDegradeFactor: 0.7,
  },
}

// ─── Workload Orchestrator ───────────────────────────────────────

/**
 * Top-level orchestration layer.
 * Fetches active work items, validates, runs the prioritization engine,
 * and returns a sorted decision queue.
 */
export function createWorkloadOrchestrator(
  source: WorkItemSource,
  nil: NilPort | null = null,
  config: OrchestratorConfig = DEFAULT_ORCHESTRATOR_CONFIG,
) {
  const engine = createPrioritizationEngine(nil, config.engineConfig)

  return {
    /**
     * Generate a prioritized work queue for an org.
     *
     * Flow:
     * 1. Fetch all active work items for the org
     * 2. Validate + normalize inputs
     * 3. Run prioritization engine
     * 4. Return sorted queue with audit metadata
     */
    async generatePriorityQueue(orgId: string): Promise<PrioritizationResult> {
      if (!orgId) {
        throw new Error('orgId is required — no cross-org aggregation allowed')
      }

      const rawItems = await source.fetchActiveWorkItems(orgId)

      // Validate and filter — log warnings but don't fail the entire batch
      const validItems: WorkItem[] = []
      for (const item of rawItems) {
        const parsed = workItemSchema.safeParse(item)
        if (parsed.success) {
          validItems.push(parsed.data)
        }
        // Invalid items are silently excluded — could add observability here
      }

      // Cap at maxItems to prevent runaway processing
      const capped = validItems.slice(0, config.maxItems)

      const prioritized = await engine.prioritize(orgId, capped)

      const avgConfidence =
        prioritized.length > 0
          ? prioritized.reduce((sum, p) => sum + p.confidence, 0) / prioritized.length
          : 0

      return {
        orgId,
        items: prioritized,
        generatedAt: new Date().toISOString(),
        totalProcessed: capped.length,
        averageConfidence: Math.round(avgConfidence * 10000) / 10000,
      }
    },

    /**
     * Get a focused "what to do today" view — top N priorities for a steward.
     */
    async getTopPriorities(
      orgId: string,
      count: number = 3,
    ): Promise<readonly PrioritizedWorkItem[]> {
      const result = await this.generatePriorityQueue(orgId)
      return result.items.slice(0, count)
    },

    /**
     * Generate bucketed queues: intake_review + active_cases.
     * Requires an IntakeSource to fetch pending intakes separately.
     */
    async generateBucketedQueues(
      orgId: string,
      intakeSource: IntakeSource,
    ): Promise<readonly BucketedResult[]> {
      if (!orgId) {
        throw new Error('orgId is required — no cross-org aggregation allowed')
      }

      const [rawItems, rawIntakes] = await Promise.all([
        source.fetchActiveWorkItems(orgId),
        intakeSource.fetchPendingIntakes(orgId),
      ])

      // Validate work items
      const validItems: WorkItem[] = []
      for (const item of rawItems) {
        const parsed = workItemSchema.safeParse(item)
        if (parsed.success) validItems.push(parsed.data)
      }

      // Validate intakes
      const validIntakes: IntakeSubmission[] = []
      for (const intake of rawIntakes) {
        const parsed = intakeSubmissionSchema.safeParse(intake)
        if (parsed.success) validIntakes.push(parsed.data)
      }

      return engine.prioritizeBucketed(
        orgId,
        validIntakes.slice(0, config.maxItems),
        validItems.slice(0, config.maxItems),
      )
    },
  }
}
