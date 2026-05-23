/**
 * Governance Culture Engine
 *
 * Analyzes organizational governance culture longitudinally by examining
 * continuity memory, reasoning sessions, and resilience evolution.
 *
 * SCOPE: Organizational governance culture — NOT individual behavior.
 * Models how an institution collectively engages with continuity governance.
 */

import { randomUUID } from 'crypto';
import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory/memory-store';
import { listReasoningSessions } from '@/lib/knowledge-transfer/reasoning-sessions/session-manager';
import type {
  GovernanceCultureProfile,
  ContinuityCulturePosture,
  CultureHealthSignal,
  CultureIndicator,
  GovernanceDisciplineProfile,
  CultureEvolutionPhase,
} from './culture-models';

function computeAverageDaysBetween(dates: string[]): number | null {
  if (dates.length < 2) return null;
  const sorted = [...dates].sort();
  let totalMs = 0;
  for (let i = 1; i < sorted.length; i++) {
    totalMs += new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime();
  }
  return Math.round(totalMs / (sorted.length - 1) / 86_400_000);
}

function dominantPosture(
  sessionCount: number,
  mitCount: number,
  govCount: number,
  totalEntries: number,
  trend: string,
): ContinuityCulturePosture {
  if (totalEntries < 3) return 'nascent_governance';
  const govRatio = (govCount + sessionCount) / Math.max(totalEntries + sessionCount, 1);
  const mitRatio = mitCount / Math.max(totalEntries, 1);

  if (govRatio >= 0.5 && trend === 'improving') return 'proactive_governance';
  if (govRatio >= 0.4 && trend === 'stable') return 'procedural_governance';
  if (mitRatio >= 0.3 && (trend === 'improving' || trend === 'stable')) return 'responsive_governance';
  if (trend === 'improving' && totalEntries >= 6) return 'adaptive_governance';
  if (trend === 'declining' || trend === 'volatile') return 'fragmented_governance';
  return 'responsive_governance';
}

function resilienceTrend(scores: number[]): string {
  if (scores.length < 2) return 'insufficient_data';
  const first = scores[0];
  const last = scores[scores.length - 1];
  const delta = last - first;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const std = Math.sqrt(scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length);
  if (std > 15) return 'volatile';
  if (delta >= 8) return 'improving';
  if (delta <= -8) return 'declining';
  return 'stable';
}

function cultureHealthSignal(trend: string, entries: number): CultureHealthSignal {
  if (entries < 3) return 'insufficient_history';
  if (trend === 'improving') return 'strengthening';
  if (trend === 'stable') return 'stable';
  if (trend === 'declining') return 'weakening';
  if (trend === 'volatile') return 'recovering';
  return 'insufficient_history';
}

function computeCultureScore(
  trend: string,
  disciplineConsistency: string,
  mitFollowThrough: string,
  totalEntries: number,
  sessionCount: number,
): number {
  let score = 0;
  // Engagement density (max 25)
  score += Math.min((totalEntries + sessionCount) * 3, 25);
  // Trend (max 35)
  const trendMap: Record<string, number> = { improving: 35, stable: 22, volatile: 12, declining: 5, insufficient_data: 0 };
  score += trendMap[trend] ?? 0;
  // Discipline consistency (max 20)
  const discMap: Record<string, number> = { high: 20, moderate: 13, low: 6, irregular: 4 };
  score += discMap[disciplineConsistency] ?? 0;
  // Mitigation follow-through (max 20)
  const mitMap: Record<string, number> = { strong: 20, partial: 12, weak: 5, unverified: 3 };
  score += mitMap[mitFollowThrough] ?? 3;
  return Math.min(Math.max(Math.round(score), 0), 100);
}

function buildIndicators(
  trend: string,
  sessionCount: number,
  mitCount: number,
  govCount: number,
  totalEntries: number,
  avgDays: number | null,
): CultureIndicator[] {
  const indicators: CultureIndicator[] = [];

  if (totalEntries >= 5) {
    indicators.push({
      dimension: 'Governance Engagement',
      observation: `${totalEntries} continuity memory entries recorded across the analysis window.`,
      evidence: `${totalEntries} cognition memory events captured.`,
      valence: totalEntries >= 10 ? 'positive' : 'neutral',
      confidence: 85,
    });
  }

  if (sessionCount >= 2) {
    indicators.push({
      dimension: 'Governance Reasoning',
      observation: `${sessionCount} reasoning sessions initiated — organizational inquiry is active.`,
      evidence: `${sessionCount} reasoning sessions in the analysis window.`,
      valence: 'positive',
      confidence: 80,
    });
  }

  if (mitCount >= 2) {
    indicators.push({
      dimension: 'Mitigation Responsiveness',
      observation: `${mitCount} mitigation comparisons recorded — governance responds to continuity risks.`,
      evidence: `${mitCount} mitigation_comparison memory entries.`,
      valence: 'positive',
      confidence: 75,
    });
  }

  if (govCount >= 2) {
    indicators.push({
      dimension: 'Decision Documentation',
      observation: `${govCount} governance decisions captured in organizational memory.`,
      evidence: `${govCount} governance_reasoning or decision_brief entries.`,
      valence: 'positive',
      confidence: 78,
    });
  }

  if (avgDays !== null) {
    const valence = avgDays <= 14 ? 'positive' : avgDays <= 45 ? 'neutral' : 'negative';
    indicators.push({
      dimension: 'Review Cadence',
      observation: `Average ${avgDays} days between governance activities.`,
      evidence: `Derived from chronological memory timestamps.`,
      valence,
      confidence: 70,
    });
  }

  if (trend === 'improving') {
    indicators.push({
      dimension: 'Resilience Trajectory',
      observation: 'Organizational resilience is trending upward — governance culture is producing measurable improvement.',
      evidence: 'Resilience timeline shows consistent upward movement.',
      valence: 'positive',
      confidence: 88,
    });
  } else if (trend === 'declining') {
    indicators.push({
      dimension: 'Resilience Trajectory',
      observation: 'Resilience is trending downward — governance culture may need reinforcement.',
      evidence: 'Resilience timeline shows consistent downward movement.',
      valence: 'negative',
      confidence: 82,
    });
  } else if (trend === 'volatile') {
    indicators.push({
      dimension: 'Governance Stability',
      observation: 'Resilience scores show volatility — governance practices may be inconsistently applied.',
      evidence: 'High variance in resilience timeline scores.',
      valence: 'negative',
      confidence: 75,
    });
  }

  return indicators;
}

function buildEvolutionPhases(
  timeline: { capturedAt: string; resilienceScore: number }[],
  posture: ContinuityCulturePosture,
): CultureEvolutionPhase[] {
  if (timeline.length < 2) return [];

  const phases: CultureEvolutionPhase[] = [];
  const sorted = [...timeline].sort((a, b) => new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime());

  // Split into at most 3 phases based on temporal segmentation
  const segmentSize = Math.ceil(sorted.length / 3);
  const segments = [
    sorted.slice(0, segmentSize),
    sorted.slice(segmentSize, segmentSize * 2),
    sorted.slice(segmentSize * 2),
  ].filter((s) => s.length > 0);

  const postureLabels: Record<ContinuityCulturePosture, string> = {
    proactive_governance: 'Proactive Governance',
    responsive_governance: 'Responsive Governance',
    procedural_governance: 'Procedural Governance',
    adaptive_governance: 'Adaptive Governance',
    fragmented_governance: 'Fragmented Governance',
    nascent_governance: 'Nascent Governance',
  };

  segments.forEach((seg, idx) => {
    const scores = seg.map((s) => s.resilienceScore);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const segTrend = resilienceTrend(scores);
    const label = idx === 0 ? 'Initial Phase' : idx === 1 ? 'Developmental Phase' : 'Current Phase';
    phases.push({
      id: randomUUID(),
      label,
      startedAt: seg[0].capturedAt,
      endedAt: idx < segments.length - 1 ? seg[seg.length - 1].capturedAt : null,
      dominantPosture: posture,
      resilienceRange: { min, max },
      characterization: `${postureLabels[posture]} — resilience ${segTrend === 'improving' ? 'growing' : segTrend === 'declining' ? 'declining' : 'stable'} from ${min} to ${max}.`,
    });
  });

  return phases;
}

function cultureSummary(posture: ContinuityCulturePosture, health: CultureHealthSignal, score: number): string {
  const postureDesc: Record<ContinuityCulturePosture, string> = {
    proactive_governance: 'proactively governs organizational continuity',
    responsive_governance: 'responds to continuity challenges with governance action',
    procedural_governance: 'follows structured, process-oriented governance disciplines',
    adaptive_governance: 'adapts governance practices iteratively as organizational knowledge grows',
    fragmented_governance: 'shows fragmented continuity governance with irregular engagement',
    nascent_governance: 'is building foundational continuity governance practices',
  };
  const healthDesc: Record<CultureHealthSignal, string> = {
    strengthening: 'Culture is strengthening with measurable improvement trends.',
    stable: 'Culture is stable with consistent governance engagement.',
    weakening: 'Culture shows signs of weakening — governance reinforcement recommended.',
    recovering: 'Culture is recovering with volatile but engagement-positive signals.',
    insufficient_history: 'Insufficient history to characterize culture evolution — continue building organizational memory.',
  };
  return `This organization ${postureDesc[posture]}. ${healthDesc[health]} Governance culture score: ${score}/100.`;
}

/** Analyze organizational governance culture from organizational cognition history. */
export async function analyzeGovernanceCulture(orgId: string): Promise<GovernanceCultureProfile> {
  const [store, sessions] = await Promise.all([
    loadCognitionMemory(orgId, { limit: 100 }),
    listReasoningSessions(orgId, { limit: 50 }),
  ]);

  const entries = store.entries;
  const timeline = store.resilienceTimeline;
  const totalEntries = entries.length;
  const sessionCount = sessions.length;

  const mitCount = entries.filter((e) => e.memoryType === 'mitigation_comparison').length;
  const govCount = entries.filter(
    (e) => e.memoryType === 'governance_reasoning' || e.memoryType === 'decision_brief',
  ).length;

  const allDates = [
    ...entries.map((e) => e.createdAt),
    ...sessions.map((s) => s.createdAt),
  ];

  const avgDays = computeAverageDaysBetween(allDates);
  const scores = timeline.map((t) => t.resilienceScore);
  const trend = resilienceTrend(scores);

  // Discipline profile
  let engagementConsistency: GovernanceDisciplineProfile['engagementConsistency'] =
    avgDays === null ? 'irregular' :
    avgDays <= 7 ? 'high' :
    avgDays <= 21 ? 'moderate' :
    avgDays <= 60 ? 'low' : 'irregular';

  const docDiscipline: GovernanceDisciplineProfile['documentationDiscipline'] =
    govCount >= 4 ? 'consistent' : govCount >= 1 ? 'sporadic' : 'absent';

  const mitFollowThrough: GovernanceDisciplineProfile['mitigationFollowThrough'] =
    mitCount >= 4 ? 'strong' : mitCount >= 2 ? 'partial' : mitCount >= 1 ? 'weak' : 'unverified';

  const disciplineProfile: GovernanceDisciplineProfile = {
    engagementConsistency,
    totalInteractions: totalEntries + sessionCount,
    averageDaysBetweenActivities: avgDays,
    documentationDiscipline: docDiscipline,
    mitigationFollowThrough: mitFollowThrough,
  };

  const posture = dominantPosture(sessionCount, mitCount, govCount, totalEntries, trend);
  const health = cultureHealthSignal(trend, totalEntries + sessionCount);
  const cultureScore = computeCultureScore(trend, engagementConsistency, mitFollowThrough, totalEntries, sessionCount);
  const indicators = buildIndicators(trend, sessionCount, mitCount, govCount, totalEntries, avgDays);
  const evolutionPhases = buildEvolutionPhases(timeline, posture);

  return {
    organizationId: orgId,
    analyzedAt: new Date().toISOString(),
    dominantPosture: posture,
    cultureHealth: health,
    cultureSummary: cultureSummary(posture, health, cultureScore),
    indicators,
    disciplineProfile,
    evolutionPhases,
    cultureScore,
    entriesAnalyzed: totalEntries,
    interpretationGuidance:
      'This profile characterizes organizational governance culture — not individual employee behavior. All insights derive from organizational continuity records and are organizationally scoped.',
  };
}
