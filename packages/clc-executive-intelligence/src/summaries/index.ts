/**
 * CLC Executive Intelligence — Movement Summary Engine
 *
 * Produces a single executive-facing posture narrative from the
 * combined intelligence outputs. Unlike the base risk posture object,
 * this is a synthesized narrative that considers the full priority
 * landscape, recommendation mix, confidence distribution, and
 * sector divergence intensity.
 *
 * @module summaries
 */

import type {
  MovementSummary,
  MovementPosture,
  ExecutivePriority,
  DecisionIntelligenceOutput,
} from '../contracts/index';
import type { CorrelatedPattern, SectorDivergence } from '@nzila/clc-decision-intelligence';

// ── Posture Classification ──────────────────────────────────────────────────

/**
 * Classify the overall movement posture from combined signals.
 *
 * This goes beyond the base risk posture — it also considers:
 * - dominant recommendation urgency
 * - divergence intensity
 * - confidence distribution
 */
export function classifyMovementPosture(
  output: DecisionIntelligenceOutput,
): MovementPosture {
  const criticalOrHigh = output.patterns.filter(
    (p) => p.watchLevel === 'critical' || p.watchLevel === 'high',
  );
  const interventions = output.recommendations.filter(
    (r) => r.recommendedAction === 'intervene' || r.recommendedAction === 'escalate',
  );
  const highDivergences = output.sectorDivergence.filter((d) => d.divergenceScore > 0.8);

  // Heightened: multiple high+ patterns OR intervention-grade actions + divergences
  if (criticalOrHigh.length >= 3) return 'heightened';
  if (criticalOrHigh.length >= 1 && interventions.length >= 2) return 'heightened';
  if (criticalOrHigh.length >= 1 && highDivergences.length >= 2) return 'heightened';

  // Vigilant: unknown high+ pattern or multiple elevated signals
  if (criticalOrHigh.length >= 1) return 'vigilant';
  if (interventions.length >= 1) return 'vigilant';
  const elevatedPatterns = output.patterns.filter((p) => p.watchLevel === 'elevated');
  if (elevatedPatterns.length >= 3) return 'vigilant';
  if (output.bargainingWatch) return 'vigilant';

  return 'steady';
}

/**
 * Extract dominant signals driving the current posture.
 */
function extractDominantSignals(
  priorities: ExecutivePriority[],
  patterns: CorrelatedPattern[],
): string[] {
  const signals: string[] = [];

  // Top priority titles (up to 3)
  for (const p of priorities.slice(0, 3)) {
    signals.push(p.title);
  }

  // If still sparse, add pattern types
  if (signals.length < 2 && patterns.length > 0) {
    const types = [...new Set(patterns.map((p) => p.patternType))];
    for (const t of types.slice(0, 2)) {
      const label = t.replace(/_/g, ' ');
      if (!signals.some((s) => s.toLowerCase().includes(label))) {
        signals.push(label);
      }
    }
  }

  return signals;
}

/**
 * Generate the "why now" explanation for the current posture.
 */
export function explainMovementPosture(
  posture: MovementPosture,
  output: DecisionIntelligenceOutput,
  priorities: ExecutivePriority[],
): string {
  if (posture === 'steady') {
    if (output.patterns.length === 0) {
      return 'No cross-affiliate patterns detected from governed aggregate data. All monitored dimensions are within baseline ranges.';
    }
    return `${output.patterns.length} pattern(s) detected but all at monitor or low-elevated levels. The movement is operating within expected parameters.`;
  }

  const urgentCount = priorities.filter(
    (p) => p.recommendedAction === 'intervene' || p.recommendedAction === 'escalate',
  ).length;

  const highPatterns = output.patterns.filter(
    (p) => p.watchLevel === 'high' || p.watchLevel === 'critical',
  );

  const sectorNames = [...new Set(
    highPatterns.flatMap((p) => p.affectedSectors),
  )];

  const divergingCount = output.sectorDivergence.filter(
    (d) => d.divergenceScore > 0.5,
  ).length;

  const parts: string[] = [];

  if (highPatterns.length > 0) {
    parts.push(`${highPatterns.length} high-priority pattern(s) detected`);
  }
  if (sectorNames.length > 0) {
    parts.push(`concentrated in ${sectorNames.slice(0, 3).join(', ')}`);
  }
  if (urgentCount > 0) {
    parts.push(`${urgentCount} action(s) require immediate attention`);
  }
  if (divergingCount > 0) {
    parts.push(`${divergingCount} sector(s) diverging from baseline`);
  }
  if (output.bargainingWatch) {
    parts.push(`pre-bargaining pressure active in ${output.bargainingWatch.sectors.length} sector(s)`);
  }

  return parts.length > 0
    ? parts.join('; ') + '.'
    : 'Multiple elevated signals across the movement warrant monitoring.';
}

// ── Summary Builder ─────────────────────────────────────────────────────────

/**
 * Build a one-sentence headline for the executive summary.
 */
function buildHeadline(posture: MovementPosture, output: DecisionIntelligenceOutput): string {
  const patternCount = output.patterns.length;
  const highCount = output.patterns.filter(
    (p) => p.watchLevel === 'high' || p.watchLevel === 'critical',
  ).length;

  if (posture === 'heightened') {
    const topSectors = [...new Set(
      output.patterns
        .filter((p) => p.watchLevel === 'high' || p.watchLevel === 'critical')
        .flatMap((p) => p.affectedSectors),
    )].slice(0, 2);
    const sectorPhrase = topSectors.length > 0
      ? ` concentrated in ${topSectors.join(' and ')}`
      : '';
    return `Movement posture heightened — ${highCount} high-priority signal(s)${sectorPhrase} require executive attention.`;
  }

  if (posture === 'vigilant') {
    if (output.bargainingWatch) {
      return `Movement posture vigilant with ${patternCount} active pattern(s) and pre-bargaining pressure building.`;
    }
    return `Movement posture vigilant — ${patternCount} pattern(s) detected, ${highCount > 0 ? `${highCount} at high priority` : 'elevated activity across sectors'}.`;
  }

  if (patternCount === 0) {
    return 'Movement posture steady — no actionable patterns detected from governed aggregate data.';
  }
  return `Movement posture steady with ${patternCount} monitored pattern(s). No immediate executive action required.`;
}

/**
 * Build a 2-4 sentence executive summary body.
 */
function buildSummaryBody(
  posture: MovementPosture,
  output: DecisionIntelligenceOutput,
  priorities: ExecutivePriority[],
): string {
  const parts: string[] = [];

  if (priorities.length > 0) {
    const top = priorities[0]!;
    parts.push(
      `The top priority is "${top.title}" (${top.watchLevel} watch, ${(top.confidence * 100).toFixed(0)}% confidence).`,
    );
  }

  const interventions = output.recommendations.filter(
    (r) => r.recommendedAction === 'intervene' || r.recommendedAction === 'escalate',
  );
  if (interventions.length > 0) {
    parts.push(
      `${interventions.length} recommendation(s) require intervention or escalation within 7 days.`,
    );
  } else if (output.recommendations.length > 0) {
    parts.push(
      `${output.recommendations.length} recommendation(s) are active, all at prepare or monitor level.`,
    );
  }

  const diverging = output.sectorDivergence.filter((d) => d.divergenceScore > 0.5);
  if (diverging.length > 0) {
    parts.push(
      `${diverging.length} sector(s) show significant divergence from the movement baseline.`,
    );
  }

  if (output.bargainingWatch) {
    parts.push(
      `Bargaining watch is active across ${output.bargainingWatch.sectors.length} sector(s) — signal strength: ${output.bargainingWatch.signalStrength}.`,
    );
  }

  if (parts.length === 0) {
    parts.push('All monitored dimensions are within expected ranges. Continue standard oversight.');
  }

  return parts.join(' ');
}

/**
 * Compute the overall confidence for the movement summary.
 * Weighted average of pattern confidences + base posture confidence.
 */
function computeSummaryConfidence(output: DecisionIntelligenceOutput): number {
  const values: number[] = [output.riskPosture.confidence];

  for (const p of output.patterns) {
    values.push(p.confidence);
  }
  for (const r of output.recommendations) {
    values.push(r.confidence);
  }

  if (values.length === 0) return 0.5;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/**
 * Build a complete movement summary from decision intelligence output.
 *
 * This is NOT just a pass-through of the risk posture — it synthesizes
 * across priorities, recommendations, divergences, and bargaining watch.
 */
export function buildMovementSummary(
  output: DecisionIntelligenceOutput,
  priorities: ExecutivePriority[],
): MovementSummary {
  const posture = classifyMovementPosture(output);
  const headline = buildHeadline(posture, output);
  const summary = buildSummaryBody(posture, output, priorities);
  const whyNow = explainMovementPosture(posture, output, priorities);
  const dominantSignals = extractDominantSignals(priorities, output.patterns);
  const confidence = computeSummaryConfidence(output);

  return {
    headline,
    summary,
    posture,
    confidence,
    dominantSignals,
    whyNow,
  };
}
