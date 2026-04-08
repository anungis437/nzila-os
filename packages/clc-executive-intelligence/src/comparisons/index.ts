/**
 * CLC Executive Intelligence — Comparison / Delta Engine
 *
 * Detects what changed between executive intelligence snapshots.
 * Compares the current state to a previous snapshot to produce
 * human-readable deltas: new signals, escalations, de-escalations,
 * and resolutions.
 *
 * @module comparisons
 */

import type {
  ExecutiveDelta,
  ExecutiveSnapshot,
  WatchLevel,
  DecisionIntelligenceOutput,
} from '../contracts/index.js';

// ── Watch level ordering ────────────────────────────────────────────────────

const WATCH_LEVEL_ORDER: Record<WatchLevel, number> = {
  monitor: 0,
  elevated: 1,
  high: 2,
  critical: 3,
};

// ── Snapshot Builder ────────────────────────────────────────────────────────

/**
 * Build a snapshot from current decision intelligence output.
 */
export function buildSnapshot(
  output: DecisionIntelligenceOutput,
  topPriorityIds: string[],
): ExecutiveSnapshot {
  const actionCounts = {
    monitor: 0 as number,
    prepare: 0 as number,
    escalate: 0 as number,
    intervene: 0 as number,
  };
  for (const r of output.recommendations) {
    actionCounts[r.recommendedAction]++;
  }

  const patternWatchLevels: Record<string, WatchLevel> = {};
  for (const p of output.patterns) {
    patternWatchLevels[p.id] = p.watchLevel as WatchLevel;
  }

  return {
    id: `SNAP-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    generatedAt: new Date().toISOString(),
    posture: output.riskPosture.posture,
    confidence: output.riskPosture.confidence,
    activePatternIds: output.patterns.map((p) => p.id),
    patternWatchLevels,
    actionCounts,
    topPriorityIds,
    divergentSectors: output.sectorDivergence
      .filter((d) => d.divergenceScore > 0.5)
      .map((d) => d.sector),
    bargainingWatchActive: output.bargainingWatch !== null,
    briefingCardCount: output.briefingCards.length,
  };
}

// ── Delta Detectors ─────────────────────────────────────────────────────────

/**
 * Detect patterns that are new (present in current but not in previous).
 */
export function detectNewSignals(
  current: DecisionIntelligenceOutput,
  previous: ExecutiveSnapshot,
): ExecutiveDelta[] {
  const previousIds = new Set(previous.activePatternIds);

  return current.patterns
    .filter((p) => !previousIds.has(p.id))
    .map((p) => ({
      id: `DELTA-NEW-${p.id}`,
      title: p.title,
      direction: 'new' as const,
      explanation: `New ${p.patternType.replace(/_/g, ' ')} detected across ${p.affectedSectors.join(', ')}. Watch level: ${p.watchLevel}.`,
      confidence: p.confidence,
      currentState: `${p.watchLevel} (${(p.confidence * 100).toFixed(0)}% confidence)`,
    }));
}

/**
 * Detect patterns whose watch level escalated.
 */
export function detectEscalations(
  current: DecisionIntelligenceOutput,
  previous: ExecutiveSnapshot,
): ExecutiveDelta[] {
  const deltas: ExecutiveDelta[] = [];

  for (const p of current.patterns) {
    const prevLevel = previous.patternWatchLevels[p.id];
    if (!prevLevel) continue; // new pattern, handled by detectNewSignals

    const currentLevel = p.watchLevel as WatchLevel;
    if (WATCH_LEVEL_ORDER[currentLevel] > WATCH_LEVEL_ORDER[prevLevel]) {
      deltas.push({
        id: `DELTA-ESC-${p.id}`,
        title: p.title,
        direction: 'up',
        explanation: `Escalated from ${prevLevel} to ${currentLevel}. ${p.summary}`,
        confidence: p.confidence,
        previousState: prevLevel,
        currentState: currentLevel,
      });
    }
  }

  return deltas;
}

/**
 * Detect patterns whose watch level de-escalated.
 */
function detectDeescalations(
  current: DecisionIntelligenceOutput,
  previous: ExecutiveSnapshot,
): ExecutiveDelta[] {
  const deltas: ExecutiveDelta[] = [];

  for (const p of current.patterns) {
    const prevLevel = previous.patternWatchLevels[p.id];
    if (!prevLevel) continue;

    const currentLevel = p.watchLevel as WatchLevel;
    if (WATCH_LEVEL_ORDER[currentLevel] < WATCH_LEVEL_ORDER[prevLevel]) {
      deltas.push({
        id: `DELTA-DEESC-${p.id}`,
        title: p.title,
        direction: 'down',
        explanation: `De-escalated from ${prevLevel} to ${currentLevel}. Signal intensity has decreased.`,
        confidence: p.confidence,
        previousState: prevLevel,
        currentState: currentLevel,
      });
    }
  }

  return deltas;
}

/**
 * Detect previously active patterns that are no longer present.
 */
export function detectResolutions(
  current: DecisionIntelligenceOutput,
  previous: ExecutiveSnapshot,
): ExecutiveDelta[] {
  const currentIds = new Set(current.patterns.map((p) => p.id));

  return previous.activePatternIds
    .filter((id) => !currentIds.has(id))
    .map((id) => {
      const prevLevel = previous.patternWatchLevels[id] ?? 'monitor';
      return {
        id: `DELTA-RESOLVED-${id}`,
        title: `Pattern ${id} resolved`,
        direction: 'resolved' as const,
        explanation: `Previously at ${prevLevel} watch level, this pattern is no longer detected in current governed aggregates.`,
        confidence: 0.7, // Resolution confidence is moderate — absence ≠ certainty
        previousState: prevLevel,
      };
    });
}

/**
 * Detect posture-level changes.
 */
function detectPostureChange(
  current: DecisionIntelligenceOutput,
  previous: ExecutiveSnapshot,
): ExecutiveDelta | null {
  if (current.riskPosture.posture === previous.posture) return null;

  const currentOrder = { steady: 0, vigilant: 1, heightened: 2 }[current.riskPosture.posture];
  const prevOrder = { steady: 0, vigilant: 1, heightened: 2 }[previous.posture];

  return {
    id: 'DELTA-POSTURE',
    title: 'Movement posture changed',
    direction: currentOrder > prevOrder ? 'up' : 'down',
    explanation: `Overall movement posture moved from ${previous.posture} to ${current.riskPosture.posture}.`,
    confidence: current.riskPosture.confidence,
    previousState: previous.posture,
    currentState: current.riskPosture.posture,
  };
}

/**
 * Detect bargaining watch state changes.
 */
function detectBargainingWatchChange(
  current: DecisionIntelligenceOutput,
  previous: ExecutiveSnapshot,
): ExecutiveDelta | null {
  const currentActive = current.bargainingWatch !== null;
  if (currentActive === previous.bargainingWatchActive) return null;

  if (currentActive && !previous.bargainingWatchActive) {
    return {
      id: 'DELTA-BARG-WATCH-NEW',
      title: 'Bargaining watch activated',
      direction: 'new',
      explanation: `Bargaining watch now active across ${current.bargainingWatch!.sectors.length} sector(s). ${current.bargainingWatch!.headline}`,
      confidence: current.bargainingWatch!.confidence,
      currentState: `active (${current.bargainingWatch!.signalStrength} signal)`,
    };
  }

  return {
    id: 'DELTA-BARG-WATCH-RESOLVED',
    title: 'Bargaining watch deactivated',
    direction: 'resolved',
    explanation: 'Previously active bargaining watch signals are no longer detected.',
    confidence: 0.7,
    previousState: 'active',
    currentState: 'inactive',
  };
}

// ── Main Compare Function ───────────────────────────────────────────────────

/**
 * Compare current decision intelligence output against a previous snapshot.
 * Returns all detected deltas, sorted by significance.
 *
 * Handles no-previous-snapshot gracefully (returns empty array).
 */
export function compareExecutiveSnapshots(
  current: DecisionIntelligenceOutput,
  previous: ExecutiveSnapshot | null,
): ExecutiveDelta[] {
  if (!previous) return [];

  const deltas: ExecutiveDelta[] = [
    ...detectNewSignals(current, previous),
    ...detectEscalations(current, previous),
    ...detectDeescalations(current, previous),
    ...detectResolutions(current, previous),
  ];

  const postureChange = detectPostureChange(current, previous);
  if (postureChange) deltas.unshift(postureChange);

  const bargainingChange = detectBargainingWatchChange(current, previous);
  if (bargainingChange) deltas.push(bargainingChange);

  // Sort: posture changes first, then new > up > down > resolved
  const directionOrder = { up: 0, new: 1, down: 2, resolved: 3 };
  return deltas.sort((a, b) => {
    if (a.id === 'DELTA-POSTURE') return -1;
    if (b.id === 'DELTA-POSTURE') return 1;
    return (directionOrder[a.direction] - directionOrder[b.direction]) ||
      (b.confidence - a.confidence);
  });
}
