/**
 * CLC Decision Intelligence — Recommendation Engine
 *
 * Transforms detected patterns and confidence assessments into
 * actionable DecisionRecommendations. Every recommendation must
 * tie to a concrete pattern — no generic advice.
 *
 * @module recommendations
 */

import type {
  CorrelatedPattern,
  DecisionRecommendation,
  RecommendedAction,
  ActionTimeframe,
  TargetAudience,
  ConfidenceResult,
  TrendAnalysis,
} from '../contracts/index.js';

// ── Rules ───────────────────────────────────────────────────────────────────

interface RecommendationRule {
  matches: (pattern: CorrelatedPattern) => boolean;
  action: RecommendedAction;
  timeframe: ActionTimeframe;
  audience: TargetAudience;
  rationale: (pattern: CorrelatedPattern) => string;
}

const RULES: RecommendationRule[] = [
  // High-watch bargaining pressure → escalate immediately
  {
    matches: (p) => p.patternType === 'bargaining_pressure_signal' && p.watchLevel === 'high',
    action: 'escalate',
    timeframe: 'now',
    audience: 'clc_executive',
    rationale: (p) =>
      `${p.title} — high-watch bargaining pressure requires immediate executive awareness to coordinate a federal response.`,
  },
  // Elevated bargaining pressure → prepare within 7 days
  {
    matches: (p) => p.patternType === 'bargaining_pressure_signal' && p.watchLevel === 'elevated',
    action: 'prepare',
    timeframe: '7_days',
    audience: 'clc_staff',
    rationale: (p) =>
      `${p.title} — elevated bargaining signals suggest upcoming activity. Brief staff and review sector strategies.`,
  },
  // Cross-affiliate issue cluster (high) → intervene
  {
    matches: (p) => p.patternType === 'cross_affiliate_issue_cluster' && p.watchLevel === 'high',
    action: 'intervene',
    timeframe: '7_days',
    audience: 'federation_leadership',
    rationale: (p) =>
      `${p.title} — a high-priority movement-wide issue cluster warrants a coordinated federation response.`,
  },
  // Cross-affiliate issue cluster (elevated/monitor) → prepare
  {
    matches: (p) => p.patternType === 'cross_affiliate_issue_cluster',
    action: 'prepare',
    timeframe: '30_days',
    audience: 'research_policy_team',
    rationale: (p) =>
      `${p.title} — cross-affiliate concentration indicates an emerging policy theme. Research team should prepare briefing materials.`,
  },
  // Cross-sector shift (high) → escalate
  {
    matches: (p) => p.patternType === 'cross_sector_shift' && p.watchLevel === 'high',
    action: 'escalate',
    timeframe: '7_days',
    audience: 'clc_executive',
    rationale: (p) =>
      `${p.title} — major deviation from movement baseline requires executive review to determine if intervention is needed.`,
  },
  // Cross-sector shift (elevated) → monitor
  {
    matches: (p) => p.patternType === 'cross_sector_shift' && p.watchLevel === 'elevated',
    action: 'monitor',
    timeframe: '30_days',
    audience: 'clc_staff',
    rationale: (p) =>
      `${p.title} — sector divergence warrants monitoring. Track for acceleration or convergence.`,
  },
  // Precedent concentration (high) → intervene
  {
    matches: (p) => p.patternType === 'precedent_concentration' && p.watchLevel === 'high',
    action: 'intervene',
    timeframe: '30_days',
    audience: 'research_policy_team',
    rationale: (p) =>
      `${p.title} — extreme precedent concentration signals systemic dispute issues. Research team should analyze clause ambiguities and recommend standardized language.`,
  },
  // Precedent concentration (elevated) → monitor
  {
    matches: (p) => p.patternType === 'precedent_concentration',
    action: 'monitor',
    timeframe: 'this_quarter',
    audience: 'clc_staff',
    rationale: (p) =>
      `${p.title} — elevated precedent activity is worth watching but doesn't yet demand action.`,
  },
  // Employer pattern → prepare
  {
    matches: (p) => p.patternType === 'employer_pattern',
    action: 'prepare',
    timeframe: '30_days',
    audience: 'federation_leadership',
    rationale: (p) =>
      `${p.title} — employer behavior pattern detected. Federation leadership should prepare coordinated strategy.`,
  },
];

/** Fallback when no specific rule matches */
function defaultRecommendation(pattern: CorrelatedPattern): Pick<RecommendationRule, 'action' | 'timeframe' | 'audience' | 'rationale'> {
  return {
    action: 'monitor',
    timeframe: 'this_quarter',
    audience: 'clc_staff',
    rationale: () => `${pattern.title} — pattern detected. Continue monitoring for escalation.`,
  };
}

// ── Engine ──────────────────────────────────────────────────────────────────

/**
 * Generate a recommendation for a single correlated pattern.
 */
export function recommendForPattern(pattern: CorrelatedPattern): DecisionRecommendation {
  const rule = RULES.find((r) => r.matches(pattern)) ?? defaultRecommendation(pattern);

  return {
    id: `REC-${pattern.id}`,
    signalId: pattern.id,
    recommendedAction: rule.action,
    rationale: rule.rationale(pattern),
    timeframe: rule.timeframe,
    targetAudience: rule.audience,
    confidence: pattern.confidence,
  };
}

/**
 * Generate recommendations for all detected patterns.
 *
 * Returns recommendations sorted by action urgency
 * (intervene > escalate > prepare > monitor).
 */
export function generateRecommendations(
  patterns: CorrelatedPattern[],
): DecisionRecommendation[] {
  const actionPriority: Record<RecommendedAction, number> = {
    intervene: 0,
    escalate: 1,
    prepare: 2,
    monitor: 3,
  };

  return patterns
    .map(recommendForPattern)
    .sort((a, b) => actionPriority[a.recommendedAction] - actionPriority[b.recommendedAction]);
}

/**
 * Generate a trend-based recommendation for a specific metric.
 *
 * Used when a TrendAnalysis (from the signals module) produces
 * a classification that warrants action — independent of the
 * correlation engine.
 */
export function recommendFromTrend(
  metricName: string,
  trend: TrendAnalysis,
  confidence: ConfidenceResult,
): DecisionRecommendation | null {
  const actionMap: Partial<Record<string, { action: RecommendedAction; timeframe: ActionTimeframe; audience: TargetAudience }>> = {
    sudden_spike: { action: 'escalate', timeframe: 'now', audience: 'clc_executive' },
    pre_bargaining_acceleration: { action: 'prepare', timeframe: '7_days', audience: 'clc_staff' },
    rising_steadily: { action: 'monitor', timeframe: '30_days', audience: 'clc_staff' },
    persistent_elevated: { action: 'prepare', timeframe: '30_days', audience: 'research_policy_team' },
  };

  const entry = actionMap[trend.classification];
  if (!entry) return null;

  return {
    id: `REC-TREND-${metricName.replace(/\s+/g, '-').toLowerCase()}`,
    signalId: `TREND-${metricName.replace(/\s+/g, '-').toLowerCase()}`,
    recommendedAction: entry.action,
    rationale: `${metricName}: ${trend.description} (confidence: ${confidence.confidenceBand}). ${entry.action === 'escalate' ? 'Sudden spike requires immediate attention.' : entry.action === 'prepare' ? 'Rising trend warrants proactive preparation.' : 'Sustained activity merits ongoing monitoring.'}`,
    timeframe: entry.timeframe,
    targetAudience: entry.audience,
    confidence: confidence.confidence,
  };
}
