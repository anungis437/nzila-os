/**
 * Organizational Behavior Pattern Engine
 *
 * Identifies recurring organizational continuity behaviors from organizational memory.
 * Detects governance loops, mitigation patterns, resilience cycles, and learning behaviors.
 *
 * SCOPE: Organizational patterns — NOT individual employee behavior analysis.
 */

import { randomUUID } from 'crypto';
import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory/memory-store';
import { listReasoningSessions } from '@/lib/knowledge-transfer/reasoning-sessions/session-manager';
import type {
  BehaviorPatternReport,
  InstitutionalBehaviorPattern,
  BehaviorPatternType,
} from './behavior-models';

type MemoryStore = Awaited<ReturnType<typeof loadCognitionMemory>>;

function detectResilienceImprovementCycle(store: MemoryStore): InstitutionalBehaviorPattern | null {
  const timeline = store.resilienceTimeline;
  if (timeline.length < 4) return null;

  let improveCycles = 0;
  let lastWasDecline = false;
  for (const pt of timeline) {
    if (pt.changeFromPrevious === null) continue;
    if (pt.changeFromPrevious < -3) lastWasDecline = true;
    else if (pt.changeFromPrevious >= 5 && lastWasDecline) {
      improveCycles++;
      lastWasDecline = false;
    }
  }

  if (improveCycles < 1) return null;
  return {
    id: randomUUID(),
    patternType: 'resilience_improvement_cycle',
    label: 'Resilience Improvement Cycle',
    description: `The organization has shown ${improveCycles} cycle(s) of resilience recovery — declining then rebounding — indicating adaptive organizational response.`,
    evidencePoints: [`${improveCycles} resilience recovery cycle(s) detected in the continuity timeline.`],
    occurrenceCount: improveCycles,
    evidenceStrength: improveCycles >= 2 ? 'strong' : 'moderate',
    isCurrentlyActive: false,
    governanceImplication: 'Organization demonstrates resilience recovery capability. Proactive planning could reduce the frequency of decline phases.',
    firstObservedAt: timeline[0]?.capturedAt ?? null,
    mostRecentAt: timeline[timeline.length - 1]?.capturedAt ?? null,
  };
}

function detectMitigationAvoidance(store: MemoryStore): InstitutionalBehaviorPattern | null {
  const assessments = store.entries.filter((e) => e.memoryType === 'continuity_assessment');
  const mitigations = store.entries.filter((e) => e.memoryType === 'mitigation_comparison');

  if (assessments.length < 2) return null;
  // Avoidance: many assessments but few mitigations
  if (mitigations.length >= assessments.length * 0.5) return null;

  const ratio = mitigations.length / assessments.length;
  return {
    id: randomUUID(),
    patternType: 'mitigation_avoidance',
    label: 'Mitigation Follow-Through Gap',
    description: `${assessments.length} continuity assessments were recorded but only ${mitigations.length} mitigation comparisons — suggesting mitigations are not consistently evaluated or documented.`,
    evidencePoints: [
      `${assessments.length} continuity assessments recorded.`,
      `${mitigations.length} mitigation comparisons recorded (${Math.round(ratio * 100)}% follow-through rate).`,
    ],
    occurrenceCount: assessments.length - mitigations.length,
    evidenceStrength: ratio < 0.2 ? 'strong' : 'moderate',
    isCurrentlyActive: true,
    governanceImplication: 'Increasing mitigation documentation could improve governance continuity and resilience follow-through.',
    firstObservedAt: assessments[0]?.createdAt ?? null,
    mostRecentAt: assessments[assessments.length - 1]?.createdAt ?? null,
  };
}

function detectAdaptiveLearningLoop(store: MemoryStore, sessionCount: number): InstitutionalBehaviorPattern | null {
  const totalInteractions = store.entries.length + sessionCount;
  if (totalInteractions < 6) return null;

  const scores = store.resilienceTimeline.map((t) => t.resilienceScore);
  if (scores.length < 3) return null;

  // Check for consistent improvements over multiple cycles
  let consecutiveImprovements = 0;
  for (let i = 1; i < scores.length; i++) {
    if (scores[i] > scores[i - 1]) consecutiveImprovements++;
  }
  const improvementRatio = consecutiveImprovements / (scores.length - 1);
  if (improvementRatio < 0.55) return null;

  return {
    id: randomUUID(),
    patternType: 'adaptive_learning_loop',
    label: 'Adaptive Learning Loop',
    description: `${Math.round(improvementRatio * 100)}% of governance cycles show resilience improvement — the organization is in an active adaptive learning pattern.`,
    evidencePoints: [
      `${consecutiveImprovements} of ${scores.length - 1} transitions show positive resilience movement.`,
      `${totalInteractions} total governance interactions across the analysis window.`,
    ],
    occurrenceCount: consecutiveImprovements,
    evidenceStrength: improvementRatio >= 0.7 ? 'strong' : 'moderate',
    isCurrentlyActive: true,
    governanceImplication: 'Sustain current governance cadence — adaptive learning momentum is a significant organizational asset.',
    firstObservedAt: store.resilienceTimeline[0]?.capturedAt ?? null,
    mostRecentAt: store.resilienceTimeline[store.resilienceTimeline.length - 1]?.capturedAt ?? null,
  };
}

function detectGovernanceStagnation(store: MemoryStore, sessionCount: number): InstitutionalBehaviorPattern | null {
  const totalInteractions = store.entries.length + sessionCount;
  if (totalInteractions >= 5) return null; // Not stagnant if active

  const latest = store.entries[0];
  if (!latest) {
    return {
      id: randomUUID(),
      patternType: 'governance_stagnation',
      label: 'Governance Stagnation',
      description: 'No continuity governance activity has been recorded. The organization lacks organizational cognition history.',
      evidencePoints: ['No cognition memory entries found.'],
      occurrenceCount: 1,
      evidenceStrength: 'strong',
      isCurrentlyActive: true,
      governanceImplication: 'Initiating regular governance reasoning sessions and documenting continuity assessments is recommended to begin building organizational intelligence.',
      firstObservedAt: null,
      mostRecentAt: null,
    };
  }

  // Check recency
  const daysSince = (Date.now() - new Date(latest.createdAt).getTime()) / 86_400_000;
  if (daysSince < 30) return null;

  return {
    id: randomUUID(),
    patternType: 'governance_stagnation',
    label: 'Extended Governance Gap',
    description: `The organization's last governance activity was ${Math.round(daysSince)} days ago. Limited recent engagement suggests a governance gap.`,
    evidencePoints: [
      `Last memory entry: ${Math.round(daysSince)} days ago.`,
      `Total governance interactions: ${totalInteractions}.`,
    ],
    occurrenceCount: 1,
    evidenceStrength: daysSince > 90 ? 'strong' : 'moderate',
    isCurrentlyActive: true,
    governanceImplication: 'Regular governance engagement is recommended to maintain continuity intelligence currency.',
    firstObservedAt: latest.createdAt,
    mostRecentAt: latest.createdAt,
  };
}

function detectDocumentationMomentum(store: MemoryStore): InstitutionalBehaviorPattern | null {
  const govEntries = store.entries.filter(
    (e) => e.memoryType === 'governance_reasoning' || e.memoryType === 'decision_brief',
  );
  if (govEntries.length < 3) return null;

  // Check if later entries are more frequent than earlier ones
  const sorted = [...govEntries].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const half = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, half);
  const secondHalf = sorted.slice(half);

  const firstRange = firstHalf.length > 1
    ? new Date(firstHalf[firstHalf.length - 1].createdAt).getTime() - new Date(firstHalf[0].createdAt).getTime()
    : Infinity;
  const secondRange = secondHalf.length > 1
    ? new Date(secondHalf[secondHalf.length - 1].createdAt).getTime() - new Date(secondHalf[0].createdAt).getTime()
    : Infinity;

  // If second half is denser (shorter timespan for same count), documentation is accelerating
  if (firstRange <= secondRange) return null;

  return {
    id: randomUUID(),
    patternType: 'documentation_momentum',
    label: 'Documentation Momentum',
    description: `Governance documentation frequency has increased over time — ${govEntries.length} decision records show accelerating documentation discipline.`,
    evidencePoints: [
      `${govEntries.length} governance decision entries recorded.`,
      'Documentation cadence has accelerated in the more recent period.',
    ],
    occurrenceCount: govEntries.length,
    evidenceStrength: govEntries.length >= 5 ? 'strong' : 'moderate',
    isCurrentlyActive: true,
    governanceImplication: 'Documentation momentum is a leading indicator of organizational governance maturity. Continue building this habit.',
    firstObservedAt: sorted[0]?.createdAt ?? null,
    mostRecentAt: sorted[sorted.length - 1]?.createdAt ?? null,
  };
}

function detectResilienceFragility(store: MemoryStore): InstitutionalBehaviorPattern | null {
  const timeline = store.resilienceTimeline;
  if (timeline.length < 5) return null;

  let reversals = 0;
  for (let i = 2; i < timeline.length; i++) {
    const prev2 = timeline[i - 2].resilienceScore;
    const prev1 = timeline[i - 1].resilienceScore;
    const curr = timeline[i].resilienceScore;
    if (prev1 > prev2 + 5 && curr < prev1 - 5) reversals++;
  }

  if (reversals < 2) return null;

  return {
    id: randomUUID(),
    patternType: 'resilience_fragility_pattern',
    label: 'Resilience Fragility Pattern',
    description: `${reversals} resilience improvement-reversal cycles detected — gains are not being sustained, suggesting governance consolidation gaps.`,
    evidencePoints: [
      `${reversals} improvement-reversal cycles in the resilience timeline.`,
    ],
    occurrenceCount: reversals,
    evidenceStrength: reversals >= 3 ? 'strong' : 'moderate',
    isCurrentlyActive: true,
    governanceImplication: 'Focusing on governance consolidation after improvement cycles may help sustain resilience gains.',
    firstObservedAt: timeline[0]?.capturedAt ?? null,
    mostRecentAt: timeline[timeline.length - 1]?.capturedAt ?? null,
  };
}

function buildNarrative(patterns: InstitutionalBehaviorPattern[], total: number): string {
  if (patterns.length === 0) return `Insufficient organizational history to identify behavioral patterns. ${total} entries analyzed.`;
  const dominant = patterns[0];
  const others = patterns.slice(1, 3).map((p) => p.label.toLowerCase()).join(', ');
  return `The organization's primary organizational behavior pattern is "${dominant.label}" — ${dominant.description.split('.')[0]}.${others ? ` Secondary patterns include: ${others}.` : ''}`;
}

/** Identify recurring organizational operational behavior patterns. */
export async function detectBehaviorPatterns(orgId: string): Promise<BehaviorPatternReport> {
  const [store, sessions] = await Promise.all([
    loadCognitionMemory(orgId, { limit: 100 }),
    listReasoningSessions(orgId, { limit: 50 }),
  ]);

  const sessionCount = sessions.length;
  const totalEntries = store.entries.length;

  const candidates: (InstitutionalBehaviorPattern | null)[] = [
    detectAdaptiveLearningLoop(store, sessionCount),
    detectResilienceImprovementCycle(store),
    detectDocumentationMomentum(store),
    detectMitigationAvoidance(store),
    detectResilienceFragility(store),
    detectGovernanceStagnation(store, sessionCount),
  ];

  const patterns = candidates
    .filter((p): p is InstitutionalBehaviorPattern => p !== null)
    .sort((a, b) => {
      const strength = { strong: 3, moderate: 2, weak: 1, tentative: 0 };
      return strength[b.evidenceStrength] - strength[a.evidenceStrength];
    });

  const dominantPattern: BehaviorPatternType | null = patterns[0]?.patternType ?? null;

  const learningSignal =
    totalEntries + sessionCount >= 10 ? 'active_learning' :
    totalEntries + sessionCount >= 4 ? 'periodic_learning' :
    totalEntries + sessionCount >= 1 ? 'passive_learning' : 'insufficient_history';

  return {
    organizationId: orgId,
    analyzedAt: new Date().toISOString(),
    patterns,
    dominantPattern,
    learningSignal,
    behaviorNarrative: buildNarrative(patterns, totalEntries),
    entriesAnalyzed: totalEntries,
    interpretationGuidance:
      'These patterns characterize organizational governance behaviors — not individual performance or workforce productivity. All observations are derived from organizational continuity records.',
  };
}
