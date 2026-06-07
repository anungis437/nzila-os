/**
 * Organizational Learning Archetype Classifier
 *
 * Classifies organizational continuity evolution style using cognition history.
 * Clusters institutions into governance learning archetypes.
 *
 * SCOPE: Organizational archetypes — NOT individual employee classifications.
 * These are organizational identity patterns derived from continuity governance history.
 */

import { loadCognitionMemory } from '@/lib/knowledge-transfer/cognition-memory/memory-store';
import { listReasoningSessions } from '@/lib/knowledge-transfer/reasoning-sessions/session-manager';
import type {
  ArchetypeClassificationResult,
  LearningArchetype,
  LearningArchetypeId,
  Archetypefit,
} from './archetype-models';

const ARCHETYPES: Record<LearningArchetypeId, LearningArchetype> = {
  proactive_stabilizer: {
    id: 'proactive_stabilizer',
    name: 'Proactive Stabilizer',
    description: 'Anticipates continuity risks and governs ahead of incidents. Invests in resilience before it is required.',
    characteristics: ['Early intervention', 'Regular resilience assessment', 'Consistent mitigation follow-through', 'Growing organizational memory'],
    developmentFocus: 'Sustain proactive cadence and begin federated knowledge sharing.',
    resilienceTrajectory: 'ascending',
  },
  reactive_mitigator: {
    id: 'reactive_mitigator',
    name: 'Reactive Mitigator',
    description: 'Responds effectively to continuity challenges after they emerge. Strong recovery capability but limited anticipation.',
    characteristics: ['Crisis-responsive', 'Good mitigation follow-through', 'Irregular governance cadence', 'Reactive memory capture'],
    developmentFocus: 'Move governance engagement earlier in the risk cycle to reduce reactive exposure.',
    resilienceTrajectory: 'fluctuating',
  },
  governance_centralized: {
    id: 'governance_centralized',
    name: 'Governance-Centralized',
    description: 'Continuity governance is structured and concentrated. Consistent process discipline with formal decision documentation.',
    characteristics: ['High documentation discipline', 'Formal governance structure', 'Concentrated decision-making', 'Process adherence'],
    developmentFocus: 'Distribute resilience knowledge to reduce governance concentration risk.',
    resilienceTrajectory: 'flat',
  },
  resilience_fragmented: {
    id: 'resilience_fragmented',
    name: 'Resilience-Fragmented',
    description: 'Continuity governance is inconsistent — resilience efforts are siloed or irregular, leading to gaps.',
    characteristics: ['Inconsistent engagement', 'Knowledge silos', 'Mitigation gaps', 'Volatile resilience scores'],
    developmentFocus: 'Establish regular governance cadences and centralize continuity documentation.',
    resilienceTrajectory: 'descending',
  },
  continuity_maturing: {
    id: 'continuity_maturing',
    name: 'Continuity-Maturing',
    description: 'The organization is on a deliberate maturity trajectory — improving governance practices incrementally over time.',
    characteristics: ['Growing memory density', 'Improving resilience trend', 'Increasing governance activity', 'Learning from history'],
    developmentFocus: 'Accelerate maturity by deepening reasoning sessions and federated learning.',
    resilienceTrajectory: 'ascending',
  },
  operationally_adaptive: {
    id: 'operationally_adaptive',
    name: 'Operationally Adaptive',
    description: 'Flexibly adjusts governance practices in response to organizational learning. Iterates on continuity approaches.',
    characteristics: ['Adaptive governance cycles', 'Evidence-based iteration', 'Session-driven learning', 'Responsive mitigation'],
    developmentFocus: 'Codify adaptive practices into organizational governance standards.',
    resilienceTrajectory: 'ascending',
  },
  documentation_builder: {
    id: 'documentation_builder',
    name: 'Documentation Builder',
    description: 'Focused on building organizational memory and governance documentation. Knowledge capture is the primary strength.',
    characteristics: ['High memory density', 'Documentation momentum', 'Growing knowledge base', 'Formalized records'],
    developmentFocus: 'Convert documentation discipline into active resilience practice and simulation.',
    resilienceTrajectory: 'building',
  },
  governance_stagnant: {
    id: 'governance_stagnant',
    name: 'Governance-Stagnant',
    description: 'Limited governance activity has created organizational memory gaps. Continuity resilience requires investment.',
    characteristics: ['Minimal engagement history', 'No established governance cadence', 'Low organizational memory', 'Emerging risk exposure'],
    developmentFocus: 'Begin governance activation — establish a regular continuity review cadence.',
    resilienceTrajectory: 'flat',
  },
};

function scoreFits(
  trend: string,
  totalInteractions: number,
  mitCount: number,
  govCount: number,
  sessionCount: number,
  docMomentum: boolean,
  volatility: number,
  _latestScore: number | null,
): Archetypefit[] {
  const fits: Archetypefit[] = [];

  const score = (archetypeId: LearningArchetypeId, raw: number): Archetypefit => ({
    archetypeId,
    score: Math.min(Math.max(Math.round(raw), 0), 100),
    confidence: totalInteractions >= 10 ? 80 : totalInteractions >= 5 ? 60 : 40,
  });

  fits.push(score('proactive_stabilizer',
    (trend === 'improving' ? 40 : 10) +
    (totalInteractions >= 8 ? 20 : totalInteractions * 2.5) +
    (mitCount >= 3 ? 20 : mitCount * 5) +
    (govCount >= 3 ? 20 : govCount * 5)
  ));

  fits.push(score('reactive_mitigator',
    (trend === 'volatile' || trend === 'fluctuating' ? 30 : 10) +
    (mitCount >= 2 ? 30 : mitCount * 10) +
    (sessionCount >= 2 ? 20 : sessionCount * 8) +
    (totalInteractions >= 4 ? 20 : totalInteractions * 4)
  ));

  fits.push(score('governance_centralized',
    (govCount >= 4 ? 40 : govCount * 8) +
    (trend === 'stable' ? 20 : 5) +
    (totalInteractions >= 8 ? 20 : totalInteractions * 2) +
    (volatility < 5 ? 20 : 5)
  ));

  fits.push(score('resilience_fragmented',
    (trend === 'declining' ? 35 : trend === 'volatile' ? 25 : 5) +
    (volatility >= 15 ? 25 : volatility) +
    (totalInteractions < 4 ? 25 : 0) +
    (mitCount === 0 ? 15 : 0)
  ));

  fits.push(score('continuity_maturing',
    (trend === 'improving' ? 35 : 10) +
    (totalInteractions >= 6 ? 25 : totalInteractions * 3) +
    (sessionCount >= 3 ? 20 : sessionCount * 5) +
    (govCount >= 2 ? 20 : govCount * 7)
  ));

  fits.push(score('operationally_adaptive',
    (trend === 'improving' ? 30 : trend === 'stable' ? 20 : 5) +
    (sessionCount >= 4 ? 30 : sessionCount * 6) +
    (mitCount >= 2 ? 20 : mitCount * 8) +
    (totalInteractions >= 6 ? 20 : totalInteractions * 2)
  ));

  fits.push(score('documentation_builder',
    (docMomentum ? 40 : 0) +
    (govCount >= 3 ? 30 : govCount * 8) +
    (trend === 'stable' || trend === 'improving' ? 15 : 5) +
    (totalInteractions >= 6 ? 15 : totalInteractions * 2)
  ));

  fits.push(score('governance_stagnant',
    (totalInteractions === 0 ? 90 : 0) +
    (totalInteractions < 3 ? 50 : 0) +
    (trend === 'insufficient_data' ? 40 : 0) +
    (trend === 'declining' && totalInteractions < 5 ? 20 : 0)
  ));

  return fits.sort((a, b) => b.score - a.score);
}

function resilienceTrend(scores: number[]): { trend: string; volatility: number } {
  if (scores.length < 2) return { trend: 'insufficient_data', volatility: 0 };
  const first = scores[0];
  const last = scores[scores.length - 1];
  const delta = last - first;
  const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
  const std = Math.sqrt(variance);
  const trend = std > 15 ? 'volatile' : delta >= 8 ? 'improving' : delta <= -8 ? 'declining' : 'stable';
  return { trend, volatility: Math.round(std) };
}

/** Classify organizational learning archetype from organizational history. */
export async function classifyLearningArchetype(orgId: string): Promise<ArchetypeClassificationResult> {
  const [store, sessions] = await Promise.all([
    loadCognitionMemory(orgId, { limit: 100 }),
    listReasoningSessions(orgId, { limit: 50 }),
  ]);

  const entries = store.entries;
  const totalEntries = entries.length;
  const sessionCount = sessions.length;
  const totalInteractions = totalEntries + sessionCount;

  const mitCount = entries.filter((e) => e.memoryType === 'mitigation_comparison').length;
  const govCount = entries.filter(
    (e) => e.memoryType === 'governance_reasoning' || e.memoryType === 'decision_brief',
  ).length;

  const scores = store.resilienceTimeline.map((t) => t.resilienceScore);
  const { trend, volatility } = resilienceTrend(scores);
  const latestScore = scores.length > 0 ? scores[scores.length - 1] : null;

  // Documentation momentum: later entries more frequent than earlier
  const govEntries = entries.filter(
    (e) => e.memoryType === 'governance_reasoning' || e.memoryType === 'decision_brief',
  ).sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  let docMomentum = false;
  if (govEntries.length >= 4) {
    const half = Math.floor(govEntries.length / 2);
    const firstSpan = new Date(govEntries[half - 1].createdAt).getTime() - new Date(govEntries[0].createdAt).getTime();
    const secondSpan = new Date(govEntries[govEntries.length - 1].createdAt).getTime() - new Date(govEntries[half].createdAt).getTime();
    docMomentum = secondSpan < firstSpan * 0.7;
  }

  const archetypeFits = scoreFits(trend, totalInteractions, mitCount, govCount, sessionCount, docMomentum, volatility, latestScore);
  const [primary, secondary] = archetypeFits;

  const primaryArchetype = ARCHETYPES[primary.archetypeId];
  const secondaryArchetype = secondary.score >= primary.score * 0.7 ? ARCHETYPES[secondary.archetypeId] : null;

  const evidence: string[] = [];
  if (totalInteractions > 0) evidence.push(`${totalInteractions} total governance interactions analyzed.`);
  if (mitCount > 0) evidence.push(`${mitCount} mitigation comparisons captured.`);
  if (govCount > 0) evidence.push(`${govCount} governance decisions documented.`);
  if (sessionCount > 0) evidence.push(`${sessionCount} reasoning sessions in history.`);
  if (scores.length > 0) evidence.push(`Resilience trend: ${trend} (${scores.length} data points).`);

  const evolutionContext = secondaryArchetype
    ? `Primary archetype "${primaryArchetype.name}" with secondary characteristics of "${secondaryArchetype.name}" — indicating a transitional governance posture.`
    : `Strongly characterized as "${primaryArchetype.name}" based on available governance history.`;

  return {
    organizationId: orgId,
    classifiedAt: new Date().toISOString(),
    primaryArchetype,
    secondaryArchetype,
    archetypeFits,
    classificationEvidence: evidence,
    evolutionContext,
    classificationConfidence: primary.confidence,
    entriesAnalyzed: totalEntries,
    interpretationGuidance:
      'These archetypes characterize organizational governance style — not individual employees. Classifications are derived from organizational continuity records and are intended for governance strategy planning.',
  };
}
