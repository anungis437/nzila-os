/**
 * CLC Executive Intelligence — Pipeline Orchestrator
 *
 * Orchestrates the entire executive intelligence pipeline:
 * prioritization → summary → delta → NIL/fallback → brief → snapshot → audit.
 *
 * @module pipeline
 */

import type {
  ExecutivePipelineInput,
  ExecutivePipelineOutput,
  ExecutiveActionBrief,
  ExecutiveAuditContext,
  MovementSummary,
  ExecutivePriority,
  ExecutiveDelta,
  MultiSignalAnalysis,
  ActionSequence,
  TopOnePriority,
  StrategicNarrative,
  RecommendationAccuracy,
} from '../contracts/index';

import { selectTopExecutivePriorities } from '../prioritization/index';
import { buildMovementSummary } from '../summaries/index';
import { compareExecutiveSnapshots, buildSnapshot } from '../comparisons/index';
import {
  attemptNilRefinement,
  getExecutivePromptContract,
} from '../narrative/index';
import {
  fallbackActionBriefHeadline,
  fallbackActionBriefSummary,
  fallbackRecommendedNextSteps,
} from '../fallbacks/index';
import { analyzeMultipleSignals } from '../reasoning/multi-signal-engine';
import { buildActionSequence, deriveTopOnePriority } from '../recommendations/sequence-engine';
import { buildStrategicNarrative } from '../narrative/strategic';
import { computeRecommendationAccuracy } from '../learning/feedback-engine';
import { evolveConfidence } from '../confidence/evolution';
import { resolveWithHybridControl } from '../nil-authority/index';

// ── Pipeline Orchestrator ───────────────────────────────────────────────────

/**
 * Run the executive intelligence pipeline.
 *
 * Takes governed decision-intelligence output and transforms it into
 * executive-ready artifacts: priorities, summary, deltas, action brief.
 *
 * Never touches raw data, consent, or governance — all inputs are
 * pre-governed aggregates from the decision-intelligence layer.
 */
export async function runExecutiveIntelligencePipeline(
  input: ExecutivePipelineInput,
): Promise<ExecutivePipelineOutput> {
  const {
    decisionOutput,
    previousSnapshot,
    nilService,
    maxPriorities = 5,
    timeSeriesAvailable = false,
    decisionMode = 'hybrid',
    historicalOutcomes,
    historicalPerformanceScore,
  } = input;

  let nilInvoked = false;

  // ── Step 1: Prioritize ──────────────────────────────────────────────────
  const previousPatternIds = previousSnapshot
    ? new Set(previousSnapshot.activePatternIds)
    : undefined;

  const topPriorities = selectTopExecutivePriorities(
    decisionOutput,
    maxPriorities,
    previousPatternIds,
  );

  // ── Step 1b: Multi-signal analysis (Section 2) ──────────────────────────
  const multiSignalAnalysis: MultiSignalAnalysis | undefined =
    topPriorities.length >= 2
      ? analyzeMultipleSignals(topPriorities)
      : undefined;

  // ── Step 1c: Confidence evolution (Section 7) ───────────────────────────
  // Apply historical performance modifier to priority confidences
  if (historicalPerformanceScore !== undefined || (historicalOutcomes && historicalOutcomes.length > 0)) {
    for (const priority of topPriorities) {
      const evolved = evolveConfidence(
        priority.confidence,
        historicalPerformanceScore,
        historicalOutcomes,
        priority.recommendedAction,
      );
      priority.confidence = evolved.evolvedConfidence;
    }
  }

  // ── Step 1d: NIL conflict resolution (Section 1 + 10) ──────────────────
  const nilResolution = await resolveWithHybridControl(
    topPriorities,
    nilService,
    decisionMode,
  );
  if (nilService?.isAvailable() && decisionMode !== 'deterministic_only') {
    nilInvoked = true;
  }

  // ── Step 2: Build movement summary ──────────────────────────────────────
  let movementSummary = buildMovementSummary(decisionOutput, topPriorities);

  // Attempt NIL refinement for posture summary
  const postureContract = getExecutivePromptContract('summarize_movement_posture_for_executives');
  if (postureContract) {
    const postureInput = postureContract.buildInput({ movementSummary });
    const result = await attemptNilRefinement(nilService, postureContract, postureInput as Record<string, unknown>);
    if (result.nilInvoked) nilInvoked = true;
    if (result.refinement) {
      movementSummary = applyPostureRefinement(movementSummary, result.refinement);
    }
  }

  // ── Step 3: Compute deltas ──────────────────────────────────────────────
  const whatChanged = compareExecutiveSnapshots(decisionOutput, previousSnapshot);

  // ── Step 3b: Strategic narrative (Section 8) ────────────────────────────
  const hasBargainingWatch = decisionOutput.bargainingWatch !== null;
  const strategicNarrative: StrategicNarrative = buildStrategicNarrative(
    movementSummary,
    topPriorities,
    whatChanged,
    hasBargainingWatch,
  );

  // ── Step 3c: Decision sequencing (Section 4 + 5) ───────────────────────
  const actionSequence: ActionSequence = buildActionSequence(topPriorities);
  const topOnePriority: TopOnePriority | null = deriveTopOnePriority(topPriorities);

  // ── Step 3d: Feedback metrics (Section 6) ──────────────────────────────
  const feedbackMetrics: RecommendationAccuracy | undefined =
    historicalOutcomes && historicalOutcomes.length > 0
      ? computeRecommendationAccuracy(historicalOutcomes)
      : undefined;

  // Attempt NIL refinement for changes summary
  const changesContract = getExecutivePromptContract('summarize_changes_since_last_snapshot');
  if (changesContract && whatChanged.length > 0) {
    const changesInput = changesContract.buildInput({ deltas: whatChanged });
    const result = await attemptNilRefinement(nilService, changesContract, changesInput as Record<string, unknown>);
    if (result.nilInvoked) nilInvoked = true;
    // Changes refinement enriches delta explanations via keyTakeaway
  }

  // ── Step 4: Build action brief ──────────────────────────────────────────
  const nextSteps = fallbackRecommendedNextSteps(topPriorities, whatChanged);

  let briefHeadline = fallbackActionBriefHeadline(movementSummary, topPriorities);
  let briefSummary = fallbackActionBriefSummary(movementSummary, topPriorities, whatChanged);

  // Attempt NIL refinement for priority ranking context
  const rankContract = getExecutivePromptContract('rank_top_executive_priorities');
  if (rankContract && topPriorities.length > 0) {
    const rankInput = rankContract.buildInput({ priorities: topPriorities });
    const result = await attemptNilRefinement(nilService, rankContract, rankInput as Record<string, unknown>);
    if (result.nilInvoked) nilInvoked = true;
    if (result.refinement?.recommendedNextStep) {
      nextSteps.unshift(result.refinement.recommendedNextStep);
    }
  }

  // Attempt NIL refinement for "why now" explanation
  const whyNowContract = getExecutivePromptContract('explain_why_now');
  if (whyNowContract) {
    const whyNowInput = whyNowContract.buildInput({ summary: movementSummary, priorities: topPriorities });
    const result = await attemptNilRefinement(nilService, whyNowContract, whyNowInput as Record<string, unknown>);
    if (result.nilInvoked) nilInvoked = true;
    if (result.refinement?.keyTakeaway) {
      movementSummary = { ...movementSummary, whyNow: result.refinement.keyTakeaway };
    }
  }

  // Attempt NIL refinement for action brief
  const briefContract = getExecutivePromptContract('generate_executive_action_brief');
  if (briefContract) {
    const briefInput = briefContract.buildInput({
      summary: movementSummary,
      priorities: topPriorities,
      deltas: whatChanged,
      nextSteps,
    });
    const result = await attemptNilRefinement(nilService, briefContract, briefInput as Record<string, unknown>);
    if (result.nilInvoked) nilInvoked = true;
    if (result.refinement) {
      if (result.refinement.headline) briefHeadline = result.refinement.headline;
      if (result.refinement.summary) briefSummary = result.refinement.summary;
      if (result.refinement.recommendedNextStep) {
        nextSteps.unshift(result.refinement.recommendedNextStep);
      }
    }
  }

  // Collect evidence refs from all sources
  const evidenceRefs = collectEvidenceRefs(topPriorities, decisionOutput);

  const actionBrief: ExecutiveActionBrief = {
    generatedAt: new Date().toISOString(),
    posture: movementSummary.posture,
    headline: briefHeadline,
    summary: briefSummary,
    topPriorities,
    whatChanged,
    recommendedNextSteps: nextSteps,
    confidence: movementSummary.confidence,
    evidenceRefs,
    nilInvoked,
    usedTimeSeries: timeSeriesAvailable,
    actionSequence,
    topOnePriority: topOnePriority ?? undefined,
    strategicNarrative,
    multiSignalAnalysis,
    decisionMode,
  };

  // ── Step 5: Build snapshot for persistence ──────────────────────────────
  const currentSnapshot = buildSnapshot(
    decisionOutput,
    topPriorities.map((p) => p.id),
  );

  // ── Step 6: Build audit context ─────────────────────────────────────────
  const auditContext: ExecutiveAuditContext = {
    executiveSummaryGenerated: true,
    nilInvoked,
    topPriorityCount: topPriorities.length,
    changedSignalsCount: whatChanged.length,
    usedTimeSeries: timeSeriesAvailable,
    previousSnapshotId: previousSnapshot?.id,
  };

  return {
    movementSummary,
    topExecutivePriorities: topPriorities,
    whatChanged,
    actionBrief,
    currentSnapshot,
    auditContext,
    multiSignalAnalysis,
    actionSequence,
    topOnePriority: topOnePriority ?? undefined,
    strategicNarrative,
    feedbackMetrics,
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function applyPostureRefinement(
  summary: MovementSummary,
  refinement: { headline?: string; summary?: string; keyTakeaway?: string },
): MovementSummary {
  return {
    ...summary,
    ...(refinement.headline ? { headline: refinement.headline } : {}),
    ...(refinement.summary ? { summary: refinement.summary } : {}),
    ...(refinement.keyTakeaway ? { whyNow: refinement.keyTakeaway } : {}),
  };
}

function collectEvidenceRefs(
  priorities: ExecutivePriority[],
  output: { patterns: Array<{ id: string }>; recommendations: Array<{ id: string }> },
): string[] {
  const refs = new Set<string>();

  for (const p of priorities) {
    for (const ref of p.evidenceRefs) {
      refs.add(ref);
    }
  }
  for (const pattern of output.patterns) {
    refs.add(`pattern:${pattern.id}`);
  }
  for (const rec of output.recommendations) {
    refs.add(`recommendation:${rec.id}`);
  }

  return [...refs];
}
