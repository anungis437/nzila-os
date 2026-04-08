/**
 * CLC Executive Intelligence — Strategic Narrative Engine
 *
 * Produces strategic framing for executive movement summaries:
 * - Directional outlook (stable / worsening / improving)
 * - Strategic implication text
 * - Best action window (immediate / short_term / bargaining_cycle)
 *
 * @module narrative/strategic
 */

import type {
  StrategicNarrative,
  StrategicOutlook,
  ActionWindow,
  MovementSummary,
  ExecutivePriority,
  ExecutiveDelta,
} from '../contracts/index';

// ── Outlook Classification ──────────────────────────────────────────────────

/**
 * Classify the directional outlook from posture, deltas, and priority mix.
 *
 * - 'worsening': New or escalating signals dominate
 * - 'improving': Resolutions or de-escalations dominate
 * - 'stable': Signals are balanced or unchanged
 */
export function classifyOutlook(
  summary: MovementSummary,
  deltas: ExecutiveDelta[],
  priorities: ExecutivePriority[],
): StrategicOutlook {
  const escalations = deltas.filter(
    (d) => d.direction === 'up' || d.direction === 'new',
  ).length;
  const deescalations = deltas.filter(
    (d) => d.direction === 'down' || d.direction === 'resolved',
  ).length;

  // Strong posture signal overrides delta count
  if (summary.posture === 'heightened' && escalations >= 2) return 'worsening';
  if (summary.posture === 'steady' && deescalations > escalations) return 'improving';

  // Delta-driven
  if (escalations > deescalations + 1) return 'worsening';
  if (deescalations > escalations + 1) return 'improving';

  // Priority-driven fallback
  const criticalCount = priorities.filter(
    (p) => p.watchLevel === 'critical' || p.recommendedAction === 'intervene',
  ).length;
  if (criticalCount >= 2) return 'worsening';

  return 'stable';
}

// ── Action Window ───────────────────────────────────────────────────────────

/**
 * Determine the best window for executive action.
 */
export function classifyActionWindow(
  priorities: ExecutivePriority[],
  hasBargainingWatch: boolean,
): ActionWindow {
  const hasImmediateAction = priorities.some(
    (p) => p.timeframe === 'now' || p.recommendedAction === 'intervene',
  );
  if (hasImmediateAction) return 'immediate';

  if (hasBargainingWatch) return 'bargaining_cycle';

  const hasShortTermAction = priorities.some(
    (p) => p.timeframe === '7_days' || p.recommendedAction === 'escalate',
  );
  if (hasShortTermAction) return 'short_term';

  return 'short_term';
}

// ── Strategic Implication ───────────────────────────────────────────────────

/**
 * Generate strategic implication text based on outlook and context.
 */
function buildStrategicImplication(
  outlook: StrategicOutlook,
  window: ActionWindow,
  priorities: ExecutivePriority[],
): string {
  const topTitle = priorities[0]?.title ?? 'current conditions';

  if (outlook === 'worsening') {
    if (window === 'immediate') {
      return `Conditions are deteriorating with ${topTitle} requiring immediate intervention. Delay increases exposure across affected sectors.`;
    }
    return `Worsening trajectory across the movement. ${topTitle} is the primary driver. Strategic coordination should begin within the current action window.`;
  }

  if (outlook === 'improving') {
    return `Movement conditions are improving. Maintain current strategies and monitor for reversal. ${topTitle} remains the key area of focus.`;
  }

  // Stable
  if (window === 'bargaining_cycle') {
    return `Conditions are stable but bargaining timelines create a natural action window. Use this period to prepare for ${topTitle}.`;
  }
  return `Movement conditions are stable. Continue routine oversight and be prepared to escalate if signals intensify around ${topTitle}.`;
}

// ── Builder ─────────────────────────────────────────────────────────────────

/**
 * Build a complete strategic narrative from executive context.
 */
export function buildStrategicNarrative(
  summary: MovementSummary,
  priorities: ExecutivePriority[],
  deltas: ExecutiveDelta[],
  hasBargainingWatch: boolean,
): StrategicNarrative {
  const outlook = classifyOutlook(summary, deltas, priorities);
  const nextWindow = classifyActionWindow(priorities, hasBargainingWatch);
  const strategicImplication = buildStrategicImplication(outlook, nextWindow, priorities);

  return {
    outlook,
    strategicImplication,
    nextWindow,
  };
}
