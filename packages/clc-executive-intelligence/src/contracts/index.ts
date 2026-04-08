/**
 * CLC Executive Intelligence — Core Contracts
 *
 * Shared type definitions for the executive intelligence layer.
 * These types sit above the decision-intelligence contracts and
 * define executive-grade outputs: priorities, summaries, deltas,
 * action briefs, and NIL prompt contracts.
 *
 * @module contracts
 */

import type {
  CorrelatedPattern,
  DecisionRecommendation,
  MovementRiskPosture,
  SectorDivergence,
  BargainingWatch,
  ExecutiveBriefingCard,
  DecisionIntelligenceOutput,
  ConfidenceBand,
  RecommendedAction,
  ActionTimeframe,
  DecisionPromptContract,
} from '@nzila/clc-decision-intelligence';

// Re-export upstream types needed by consumers
export type {
  CorrelatedPattern,
  DecisionRecommendation,
  MovementRiskPosture,
  SectorDivergence,
  BargainingWatch,
  ExecutiveBriefingCard,
  DecisionIntelligenceOutput,
  ConfidenceBand,
  RecommendedAction,
  ActionTimeframe,
  DecisionPromptContract,
};

// ── Executive Priority ──────────────────────────────────────────────────────

export type WatchLevel = 'monitor' | 'elevated' | 'high' | 'critical';

/**
 * A ranked executive priority — the unit output of the prioritization engine.
 */
export interface ExecutivePriority {
  /** Stable identifier */
  id: string;
  /** Short action-oriented title */
  title: string;
  /** Watch level for leadership attention */
  watchLevel: WatchLevel;
  /** Recommended action */
  recommendedAction: RecommendedAction;
  /** When action should be taken */
  timeframe: ActionTimeframe;
  /** Composite confidence (0-1) */
  confidence: number;
  /** Why this matters for leadership right now */
  whyItMatters: string;
  /** Data references backing this priority */
  evidenceRefs: string[];
  /** Source types that contributed (pattern types, trend, recommendation, etc.) */
  sourceTypes: string[];
  /** Computed priority score (higher = more important) */
  priorityScore: number;
}

// ── Movement Summary ────────────────────────────────────────────────────────

export type MovementPosture = 'steady' | 'vigilant' | 'heightened';

/**
 * Executive-facing movement summary — synthesized narrative.
 */
export interface MovementSummary {
  /** One-sentence headline */
  headline: string;
  /** 2-4 sentence executive summary */
  summary: string;
  /** Overall posture */
  posture: MovementPosture;
  /** Composite confidence (0-1) */
  confidence: number;
  /** Top signals driving this posture */
  dominantSignals: string[];
  /** Why this posture right now (contextual explanation) */
  whyNow: string;
}

// ── Executive Delta (What Changed) ──────────────────────────────────────────

export type DeltaDirection = 'up' | 'down' | 'new' | 'resolved';

/**
 * A single change between two executive intelligence snapshots.
 */
export interface ExecutiveDelta {
  /** Stable identifier */
  id: string;
  /** Short description of the change */
  title: string;
  /** Direction of change */
  direction: DeltaDirection;
  /** Human-readable explanation */
  explanation: string;
  /** Confidence in this change detection */
  confidence: number;
  /** Previous state (if applicable) */
  previousState?: string;
  /** Current state */
  currentState?: string;
}

// ── Executive Intelligence Snapshot (for persistence) ────────────────────────

/**
 * A point-in-time snapshot of executive intelligence state.
 * Used for delta comparison between review cycles.
 */
export interface ExecutiveSnapshot {
  /** Unique snapshot ID */
  id: string;
  /** When this snapshot was taken */
  generatedAt: string;
  /** Posture at snapshot time */
  posture: MovementPosture;
  /** Overall confidence */
  confidence: number;
  /** Pattern IDs active at snapshot time */
  activePatternIds: string[];
  /** Watch levels for each active pattern */
  patternWatchLevels: Record<string, WatchLevel>;
  /** Recommendation action counts */
  actionCounts: Record<RecommendedAction, number>;
  /** Top priority IDs */
  topPriorityIds: string[];
  /** Sectors with elevated+ divergence */
  divergentSectors: string[];
  /** Whether bargaining watch was active */
  bargainingWatchActive: boolean;
  /** Number of briefing cards */
  briefingCardCount: number;
}

// ── Executive Action Brief ──────────────────────────────────────────────────

/**
 * The top-level executive artifact — a complete action brief
 * suitable for dashboard display and leadership briefing prep.
 */
export interface ExecutiveActionBrief {
  /** When this brief was generated */
  generatedAt: string;
  /** Overall movement posture */
  posture: MovementPosture;
  /** One-sentence headline */
  headline: string;
  /** Executive summary */
  summary: string;
  /** Ranked top priorities */
  topPriorities: ExecutivePriority[];
  /** What changed since last review */
  whatChanged: ExecutiveDelta[];
  /** Concrete next steps */
  recommendedNextSteps: string[];
  /** Overall confidence */
  confidence: number;
  /** Evidence references */
  evidenceRefs: string[];
  /** Whether NIL was used for narrative generation */
  nilInvoked: boolean;
  /** Whether time-series data was available */
  usedTimeSeries: boolean;
}

// ── NIL Runtime Interface ───────────────────────────────────────────────────

/**
 * NIL reasoning service interface.
 * Implementations can be AI-backed or deterministic fallback.
 */
export interface NilReasoningService {
  /**
   * Whether this service is available and ready.
   */
  isAvailable(): boolean;

  /**
   * Generate a narrative refinement for executive output.
   * Returns null if unable to generate (triggers fallback).
   */
  refine(contract: DecisionPromptContract, input: Record<string, unknown>): Promise<NilRefinement | null>;
}

/**
 * Output from an NIL refinement call.
 */
export interface NilRefinement {
  /** Refined headline */
  headline?: string;
  /** Refined summary */
  summary?: string;
  /** Key takeaway */
  keyTakeaway?: string;
  /** Recommended next step (narrative) */
  recommendedNextStep?: string;
  /** Additional fields from the prompt contract */
  additionalFields?: Record<string, unknown>;
}

// ── Executive Audit Context (extension of DecisionAuditContext) ──────────────

/**
 * Audit context for executive intelligence operations.
 */
export interface ExecutiveAuditContext {
  /** Whether executive summary was generated */
  executiveSummaryGenerated: boolean;
  /** Whether NIL was invoked */
  nilInvoked: boolean;
  /** Number of top priorities returned */
  topPriorityCount: number;
  /** Number of deltas detected */
  changedSignalsCount: number;
  /** Whether time-series data was used */
  usedTimeSeries: boolean;
  /** Previous snapshot ID used for comparison (if any) */
  previousSnapshotId?: string;
}

// ── Pipeline Input ──────────────────────────────────────────────────────────

/**
 * Full input to the executive intelligence pipeline.
 * Consumes the output of the decision intelligence pipeline
 * plus optional previous snapshot for delta computation.
 */
export interface ExecutivePipelineInput {
  /** Output from the decision intelligence pipeline */
  decisionOutput: DecisionIntelligenceOutput;
  /** Previous snapshot for delta comparison (null = first run) */
  previousSnapshot: ExecutiveSnapshot | null;
  /** Optional NIL service for narrative refinement */
  nilService?: NilReasoningService;
  /** Maximum number of top priorities to return */
  maxPriorities?: number;
  /** Whether time-series data was available in the pipeline */
  timeSeriesAvailable?: boolean;
}

/**
 * Full output from the executive intelligence pipeline.
 */
export interface ExecutivePipelineOutput {
  /** Movement summary */
  movementSummary: MovementSummary;
  /** Ranked executive priorities */
  topExecutivePriorities: ExecutivePriority[];
  /** What changed since last review */
  whatChanged: ExecutiveDelta[];
  /** Complete action brief */
  actionBrief: ExecutiveActionBrief;
  /** Current snapshot (for persisting) */
  currentSnapshot: ExecutiveSnapshot;
  /** Audit context */
  auditContext: ExecutiveAuditContext;
}
