/**
 * Governance Maturity Personality Profiler
 *
 * Models organizational governance posture styles using organizational history.
 * Produces human-readable governance identity profiles.
 *
 * SCOPE: Organizational governance identities — NOT people analytics.
 */

import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory/memory-store';
import { listReasoningSessions } from '@/lib/knowledge-transfer/reasoning-sessions/session-manager';
import type {
  GovernancePersonalityProfile,
  GovernancePersonalityType,
  PersonalityDimension,
  GovernanceStabilityProfile,
  GovernanceStabilityRating,
} from './personality-models';

const PERSONALITY_META: Record<
  GovernancePersonalityType,
  { name: string; description: string; characteristics: string[]; strategicFocus: string }
> = {
  centralized_governance: {
    name: 'Centralized Governance',
    description: 'Governance authority and continuity decision-making are centralized and structured. Process discipline is high.',
    characteristics: ['Formal governance structure', 'Concentrated decision-making', 'Documented procedures', 'Structured review cycles'],
    strategicFocus: 'Distribute resilience knowledge to reduce governance concentration risk and build redundancy.',
  },
  distributed_resilience: {
    name: 'Distributed Resilience Builder',
    description: 'Resilience knowledge and continuity responsibilities are distributed across the institution.',
    characteristics: ['Multi-function governance engagement', 'Distributed knowledge ownership', 'Resilience shared across roles', 'Collaborative continuity culture'],
    strategicFocus: 'Formalize coordination mechanisms to ensure distributed resilience remains coherent.',
  },
  continuity_reactive: {
    name: 'Continuity-Reactive',
    description: 'Governance engagement is predominantly reactive — responding to continuity challenges as they emerge.',
    characteristics: ['Crisis-triggered governance', 'Good recovery capability', 'Limited anticipatory planning', 'Responsive but not proactive'],
    strategicFocus: 'Invest in proactive continuity planning to reduce reactive governance burden and catch risks earlier.',
  },
  governance_maturing: {
    name: 'Governance-Maturing',
    description: 'The organization is on a deliberate governance maturity trajectory — incrementally building resilience capacity.',
    characteristics: ['Growing governance engagement', 'Improving resilience metrics', 'Developing organizational memory', 'Increasing planning sophistication'],
    strategicFocus: 'Sustain maturity momentum and begin benchmarking against governance excellence models.',
  },
  resilience_fragile: {
    name: 'Resilience-Fragile',
    description: 'Governance gaps create organizational resilience fragility — continuity risks are present without adequate governance response.',
    characteristics: ['Irregular governance engagement', 'Declining or volatile resilience', 'Documentation gaps', 'Mitigation follow-through issues'],
    strategicFocus: 'Establish foundational governance cadences and begin systematic continuity documentation.',
  },
  continuity_progressive: {
    name: 'Continuity-Progressive',
    description: 'Leading-edge governance culture with adaptive practices, strong organizational memory, and continuous learning.',
    characteristics: ['Proactive governance investment', 'Strong documentation discipline', 'Adaptive resilience practices', 'Organizational learning culture'],
    strategicFocus: 'Pioneer federated governance intelligence and become a model for organizational continuity maturity.',
  },
};

function computeVolatility(scores: number[]): number {
  if (scores.length < 2) return 0;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
  return Math.min(Math.round(Math.sqrt(variance)), 100);
}

function stabilityRating(consistency: number, volatility: number): GovernanceStabilityRating {
  if (consistency === 0 && volatility === 0) return 'insufficient_data';
  if (consistency >= 80 && volatility <= 10) return 'highly_stable';
  if (consistency >= 60 && volatility <= 20) return 'stable';
  if (consistency >= 40 || volatility <= 30) return 'variable';
  return 'unstable';
}

function trendNarrative(scores: number[]): string {
  if (scores.length < 2) return 'Insufficient data for trend analysis.';
  const delta = scores[scores.length - 1] - scores[0];
  if (delta >= 10) return `Resilience has improved by ${delta} points — clear upward momentum.`;
  if (delta >= 3) return `Modest resilience improvement of ${delta} points over the analysis period.`;
  if (delta <= -10) return `Resilience has declined by ${Math.abs(delta)} points — governance attention warranted.`;
  if (delta <= -3) return `Slight resilience decline of ${Math.abs(delta)} points observed.`;
  return 'Resilience is broadly stable across the analysis period.';
}

function resolvePersonality(
  trend: string,
  volatility: number,
  govCount: number,
  mitCount: number,
  totalInteractions: number,
  sessionCount: number,
  latestScore: number | null,
): GovernancePersonalityType {
  if (totalInteractions < 2) return 'resilience_fragile';

  if (trend === 'improving' && totalInteractions >= 8 && govCount >= 3) return 'continuity_progressive';
  if (trend === 'improving' && totalInteractions >= 4) return 'governance_maturing';
  if (govCount >= 5 && volatility < 10) return 'centralized_governance';
  if (sessionCount >= 4 && mitCount >= 2 && trend !== 'declining') return 'distributed_resilience';
  if (trend === 'declining' || volatility >= 20 || totalInteractions < 3) return 'resilience_fragile';
  if (mitCount >= 2 && trend === 'stable') return 'continuity_reactive';
  if (trend === 'stable' && totalInteractions >= 4) return 'governance_maturing';
  return 'continuity_reactive';
}

function computeMaturityScore(
  trend: string,
  totalInteractions: number,
  govCount: number,
  sessionCount: number,
  volatility: number,
): number {
  let score = 0;
  score += Math.min(totalInteractions * 4, 30);
  const trendMap: Record<string, number> = { improving: 35, stable: 22, volatile: 10, declining: 5, insufficient_data: 0 };
  score += trendMap[trend] ?? 0;
  score += Math.min(govCount * 5, 20);
  score += Math.min(sessionCount * 4, 15);
  score -= Math.min(volatility / 2, 10);
  return Math.min(Math.max(Math.round(score), 0), 100);
}

function buildDimensions(
  trend: string,
  govCount: number,
  mitCount: number,
  sessionCount: number,
  totalEntries: number,
  volatility: number,
): PersonalityDimension[] {
  return [
    {
      dimension: 'Governance Structure',
      score: Math.min(govCount * 15 + (trend === 'stable' || trend === 'improving' ? 25 : 5), 100),
      observation: govCount >= 3 ? `${govCount} governance decisions structured and documented.` : 'Limited governance structure visible in record.',
    },
    {
      dimension: 'Continuity Engagement',
      score: Math.min((totalEntries + sessionCount) * 5, 100),
      observation: `${totalEntries + sessionCount} total continuity governance engagements recorded.`,
    },
    {
      dimension: 'Resilience Momentum',
      score: trend === 'improving' ? 85 : trend === 'stable' ? 60 : trend === 'volatile' ? 35 : trend === 'declining' ? 20 : 0,
      observation: `Resilience trend: ${trend}.`,
    },
    {
      dimension: 'Stability Consistency',
      score: Math.max(0, 100 - volatility * 3),
      observation: `Governance volatility index: ${volatility}. ${volatility < 10 ? 'Very consistent.' : volatility < 20 ? 'Moderately consistent.' : 'Notable volatility.'}`,
    },
    {
      dimension: 'Mitigation Depth',
      score: Math.min(mitCount * 18, 100),
      observation: `${mitCount} mitigations documented across analysis window.`,
    },
  ];
}

/** Generate governance maturity personality profile for an organization. */
export async function profileGovernancePersonality(orgId: string): Promise<GovernancePersonalityProfile> {
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

  const scores = timeline.map((t) => t.resilienceScore);
  const mean = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const volatility = computeVolatility(scores);
  const consistency = scores.length > 0 ? Math.max(0, 100 - volatility * 2) : 0;
  const delta = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0;
  const totalInteractions = totalEntries + sessionCount;

  const trend =
    scores.length < 2 ? 'insufficient_data' :
    volatility > 15 ? 'volatile' :
    delta >= 8 ? 'improving' :
    delta <= -8 ? 'declining' : 'stable';

  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;

  const personalityType = resolvePersonality(trend, volatility, govCount, mitCount, totalInteractions, sessionCount, latestScore);
  const meta = PERSONALITY_META[personalityType];
  const maturityScore = computeMaturityScore(trend, totalInteractions, govCount, sessionCount, volatility);

  const stabilityProfile: GovernanceStabilityProfile = {
    consistencyScore: consistency,
    volatilityScore: volatility,
    stabilityRating: stabilityRating(consistency, volatility),
    trendNarrative: trendNarrative(scores),
  };

  const dimensions = buildDimensions(trend, govCount, mitCount, sessionCount, totalEntries, volatility);

  const identityStatement = `This organization operates as a "${meta.name}" institution — ${meta.description.split('.')[0].toLowerCase()}.`;

  return {
    organizationId: orgId,
    profiledAt: new Date().toISOString(),
    personalityType,
    personalityName: meta.name,
    personalityDescription: meta.description,
    governanceCharacteristics: meta.characteristics,
    dimensions,
    stabilityProfile,
    maturityScore,
    strategicFocus: meta.strategicFocus,
    identityStatement,
    entriesAnalyzed: totalEntries,
    interpretationGuidance:
      'Governance personalities are organizational characterizations — not assessments of individuals. They are intended to inform governance strategy and organizational development planning.',
  };
}
