/**
 * CLC Executive Intelligence — Deterministic Fallback Layer
 *
 * When NIL is unavailable, these functions produce the same
 * structured outputs using string-template logic.
 * The system never fails because AI is offline.
 *
 * @module fallbacks
 */

import type {
  MovementSummary,
  ExecutivePriority,
  ExecutiveDelta,
} from '../contracts/index.js';

// ── Movement Posture Fallback ───────────────────────────────────────────────

/**
 * Generate a deterministic headline for the movement posture.
 */
export function fallbackPostureHeadline(summary: MovementSummary): string {
  return summary.headline;
}

/**
 * Generate a deterministic summary for the movement posture.
 */
export function fallbackPostureSummary(summary: MovementSummary): string {
  return summary.summary;
}

/**
 * Generate a deterministic key takeaway.
 */
export function fallbackPostureKeyTakeaway(summary: MovementSummary): string {
  const { posture, dominantSignals } = summary;
  const signalList = dominantSignals.slice(0, 3).join(', ');

  if (posture === 'heightened') {
    return `Movement posture is heightened due to ${signalList}. Immediate leadership attention recommended.`;
  }
  if (posture === 'vigilant') {
    return `Movement posture is vigilant with active signals: ${signalList}. Continued monitoring and preparation advised.`;
  }
  return `Movement posture is steady. Key signals (${signalList}) are within normal ranges.`;
}

// ── Priority Ranking Fallback ───────────────────────────────────────────────

/**
 * Generate a deterministic summary for ranked priorities.
 */
export function fallbackPrioritySummary(priorities: ExecutivePriority[]): string {
  if (priorities.length === 0) {
    return 'No priorities require executive attention at this time.';
  }

  const top = priorities[0];
  if (!top) return 'No priorities require executive attention at this time.';

  const parts: string[] = [
    `The top priority is "${top.title}" at ${top.watchLevel} watch level, requiring ${top.recommendedAction} action within ${top.timeframe.replace(/_/g, ' ')}.`,
  ];

  if (priorities.length > 1) {
    const highCount = priorities.filter((p) => p.watchLevel === 'critical' || p.watchLevel === 'high').length;
    if (highCount > 1) {
      parts.push(`${highCount} of ${priorities.length} priorities are at high or critical watch level.`);
    }
  }

  const timeframeCounts = new Map<string, number>();
  for (const p of priorities) {
    timeframeCounts.set(p.timeframe, (timeframeCounts.get(p.timeframe) ?? 0) + 1);
  }
  const nowCount = timeframeCounts.get('now') ?? 0;
  if (nowCount > 0) {
    parts.push(`${nowCount} priority${nowCount > 1 ? ' items require' : ' item requires'} immediate action.`);
  }

  return parts.join(' ');
}

/**
 * Generate a deterministic recommended next step from priorities.
 */
export function fallbackPriorityNextStep(priorities: ExecutivePriority[]): string {
  const top = priorities[0];
  if (!top) return 'Continue routine monitoring.';

  if (top.recommendedAction === 'intervene') {
    return `Convene leadership to address "${top.title}" — intervention required.`;
  }
  if (top.recommendedAction === 'escalate') {
    return `Escalate "${top.title}" to senior leadership for review and decision.`;
  }
  if (top.recommendedAction === 'prepare') {
    return `Begin preparation for "${top.title}" — action expected within ${top.timeframe.replace(/_/g, ' ')}.`;
  }
  return `Monitor "${top.title}" and review at next scheduled briefing.`;
}

// ── What-Changed Fallback ───────────────────────────────────────────────────

/**
 * Generate a deterministic summary of changes.
 */
export function fallbackChangeSummary(deltas: ExecutiveDelta[]): string {
  if (deltas.length === 0) {
    return 'No significant changes detected since last review.';
  }

  const newSignals = deltas.filter((d) => d.direction === 'new');
  const escalations = deltas.filter((d) => d.direction === 'up');
  const deescalations = deltas.filter((d) => d.direction === 'down');
  const resolved = deltas.filter((d) => d.direction === 'resolved');

  const parts: string[] = [];

  if (escalations.length > 0) {
    parts.push(`${escalations.length} signal${escalations.length > 1 ? 's' : ''} escalated in severity`);
  }
  if (newSignals.length > 0) {
    parts.push(`${newSignals.length} new signal${newSignals.length > 1 ? 's' : ''} detected`);
  }
  if (deescalations.length > 0) {
    parts.push(`${deescalations.length} signal${deescalations.length > 1 ? 's' : ''} de-escalated`);
  }
  if (resolved.length > 0) {
    parts.push(`${resolved.length} signal${resolved.length > 1 ? 's' : ''} resolved`);
  }

  return `Since last review: ${parts.join(', ')}.`;
}

// ── Action Brief Fallback ───────────────────────────────────────────────────

/**
 * Generate deterministic recommended next steps for the action brief.
 */
export function fallbackRecommendedNextSteps(
  priorities: ExecutivePriority[],
  deltas: ExecutiveDelta[],
): string[] {
  const steps: string[] = [];

  // Top priority action
  const top = priorities[0];
  if (top) {
    steps.push(fallbackPriorityNextStep(priorities));
  }

  // Escalation callout
  const escalations = deltas.filter((d) => d.direction === 'up');
  if (escalations.length > 0) {
    steps.push(`Review ${escalations.length} escalated signal${escalations.length > 1 ? 's' : ''} that may require status updates.`);
  }

  // New signal callout
  const newSignals = deltas.filter((d) => d.direction === 'new');
  if (newSignals.length > 0) {
    steps.push(`Assess ${newSignals.length} newly detected signal${newSignals.length > 1 ? 's' : ''} for potential impact.`);
  }

  if (steps.length === 0) {
    steps.push('Continue routine monitoring and review at next scheduled briefing.');
  }

  return steps;
}

/**
 * Generate a deterministic action brief headline.
 */
export function fallbackActionBriefHeadline(
  summary: MovementSummary,
  priorities: ExecutivePriority[],
): string {
  const top = priorities[0];
  if (!top) return summary.headline;

  if (summary.posture === 'heightened') {
    return `Heightened posture: "${top.title}" requires ${top.recommendedAction} action`;
  }
  if (summary.posture === 'vigilant') {
    return `Vigilant posture: ${priorities.length} priorities under active watch`;
  }
  return `Steady posture: ${priorities.length} item${priorities.length !== 1 ? 's' : ''} under routine monitoring`;
}

/**
 * Generate a deterministic action brief summary.
 */
export function fallbackActionBriefSummary(
  summary: MovementSummary,
  priorities: ExecutivePriority[],
  deltas: ExecutiveDelta[],
): string {
  const parts: string[] = [summary.summary];

  if (deltas.length > 0) {
    parts.push(fallbackChangeSummary(deltas));
  }

  if (priorities.length > 0) {
    parts.push(fallbackPrioritySummary(priorities));
  }

  return parts.join(' ');
}
