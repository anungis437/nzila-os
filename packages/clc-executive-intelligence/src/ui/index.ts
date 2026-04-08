/**
 * CLC Executive Intelligence — UI Contracts & Helpers
 *
 * Lightweight UI display helpers for dashboards and executive briefings.
 * These produce display-ready data structures for:
 * - "One Thing That Matters" banner
 * - Action sequence timeline
 * - Signal interaction indicators
 * - Trend classification badges
 *
 * @module ui
 */

import type {
  TopOnePriority,
  ActionSequence,
  MultiSignalAnalysis,
  SignalInteractionIndicator,
  StrategicNarrative,
  StrategicOutlook,
  ActionWindow,
} from '../contracts/index';

// ── One Thing That Matters Banner ───────────────────────────────────────────

export interface TopOneBanner {
  /** Main display title */
  title: string;
  /** Explanation line */
  why: string;
  /** Call to action */
  action: string;
  /** Urgency label */
  urgencyLabel: string;
  /** Confidence percentage */
  confidencePercent: number;
}

/**
 * Build display data for the "One Thing That Matters" banner.
 */
export function buildTopOneBanner(top: TopOnePriority | null | undefined): TopOneBanner | null {
  if (!top) return null;

  const urgencyMap: Record<string, string> = {
    now: 'IMMEDIATE',
    '7_days': 'THIS WEEK',
    '30_days': 'THIS MONTH',
    pre_bargaining: 'PRE-BARGAINING',
    this_quarter: 'THIS QUARTER',
  };

  return {
    title: top.title,
    why: top.whyThisIsTheOne,
    action: top.immediateAction,
    urgencyLabel: urgencyMap[top.timeframe] ?? 'ACTIVE',
    confidencePercent: Math.round(top.confidence * 100),
  };
}

// ── Action Sequence Timeline ────────────────────────────────────────────────

export interface SequenceTimelineItem {
  /** Step number */
  step: number;
  /** Display label */
  label: string;
  /** Rationale */
  rationale: string;
  /** Visual status */
  status: 'primary' | 'secondary' | 'pending';
}

/**
 * Transform an action sequence into a timeline-ready list.
 */
export function buildSequenceTimeline(
  sequence: ActionSequence | null | undefined,
): SequenceTimelineItem[] {
  if (!sequence || sequence.orderedActions.length === 0) return [];

  return sequence.orderedActions.map((action) => ({
    step: action.step,
    label: action.action,
    rationale: action.rationale,
    status: action.step === 1 ? 'primary' : action.step <= 3 ? 'secondary' : 'pending',
  }));
}

// ── Signal Interaction Indicators ───────────────────────────────────────────

/**
 * Transform multi-signal analysis into display-ready interaction indicators.
 */
export function buildSignalInteractionIndicators(
  analysis: MultiSignalAnalysis | null | undefined,
): SignalInteractionIndicator[] {
  if (!analysis) return [];

  return analysis.signalPairs.map((pair) => {
    const labelMap: Record<string, string> = {
      reinforcing: 'Signals reinforce each other',
      conflicting: 'Signals are in conflict',
      independent: 'Signals are independent',
    };

    return {
      signalA: pair.signalA,
      signalB: pair.signalB,
      interaction: pair.interaction,
      label: labelMap[pair.interaction] ?? pair.interaction,
    };
  });
}

// ── Strategic Outlook Display ───────────────────────────────────────────────

export interface StrategicOutlookDisplay {
  /** Outlook label */
  label: string;
  /** Icon hint */
  icon: 'arrow-up' | 'arrow-down' | 'minus';
  /** Severity for coloring */
  severity: 'success' | 'warning' | 'danger';
  /** Strategic implication text */
  implication: string;
  /** Action window label */
  windowLabel: string;
}

/**
 * Build display data for strategic outlook.
 */
export function buildStrategicOutlookDisplay(
  narrative: StrategicNarrative | null | undefined,
): StrategicOutlookDisplay | null {
  if (!narrative) return null;

  const outlookConfig: Record<StrategicOutlook, { label: string; icon: 'arrow-up' | 'arrow-down' | 'minus'; severity: 'success' | 'warning' | 'danger' }> = {
    improving: { label: 'Improving', icon: 'arrow-up', severity: 'success' },
    stable: { label: 'Stable', icon: 'minus', severity: 'warning' },
    worsening: { label: 'Worsening', icon: 'arrow-down', severity: 'danger' },
  };

  const windowLabels: Record<ActionWindow, string> = {
    immediate: 'Act Now',
    short_term: 'This Week',
    bargaining_cycle: 'Before Bargaining',
  };

  const config = outlookConfig[narrative.outlook];

  return {
    label: config.label,
    icon: config.icon,
    severity: config.severity,
    implication: narrative.strategicImplication,
    windowLabel: windowLabels[narrative.nextWindow],
  };
}
