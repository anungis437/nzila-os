/**
 * Institutional Operating Intelligence — Foundational Engines (T1–T7)
 *
 * Wraps all `(orgId) => Promise<Result>` cognition engines from
 * `lib/knowledge-transfer/*` in canonical kernel envelopes and registers
 * them with the cognition registry.
 *
 * Engines whose signatures take additional arguments (simulators, comparators,
 * the copilot, indexers, summarizers, reasoning-session CRUD, memory CRUD)
 * are intentionally NOT included here — those are on-demand, user-supplied
 * operations rather than orchestratable institution-wide cognition.
 */

import {
  COGNITION_CONTRACT_VERSION,
  cognitionRegistry,
  defineCognitionEngine,
  type CognitionDomain,
} from '@nzila/institutional-cognition-core';

import { analyzeInstitutionalLearning } from '../knowledge-transfer/institutional-learning/learning-engine';
import { buildResilienceRoadmap } from '../knowledge-transfer/resilience-strategies/strategy-modeler';
import { buildDependencyPropagationMap } from '../knowledge-transfer/propagation/dependency-propagator';
import { detectBehaviorPatterns } from '../knowledge-transfer/behavior-patterns/behavior-engine';
import { analyzeCascadeRisks } from '../knowledge-transfer/cascade-analysis/cascade-analyzer';
import { generateDecisionBrief } from '../knowledge-transfer/decision-intelligence/decision-engine';
import { forecastContinuityTrends } from '../knowledge-transfer/forecasting/continuity-forecaster';
import { computeAdaptiveResilience } from '../knowledge-transfer/adaptive-resilience/adaptive-engine';
import { analyzeGovernanceAdaptation } from '../knowledge-transfer/governance-adaptation/adaptation-engine';
import { trackMitigationEffectiveness } from '../knowledge-transfer/mitigation-effectiveness/effectiveness-tracker';
import { generateFederatedBenchmark } from '../knowledge-transfer/federated-intelligence/federated-engine';
import { buildTopicGraph } from '../knowledge-transfer/topic-graph/topic-graph-builder';
import { trackResilienceHabits } from '../knowledge-transfer/resilience-habits/habit-tracker';
import { analyzeGovernanceCulture } from '../knowledge-transfer/governance-culture/culture-engine';
import { classifyLearningArchetype } from '../knowledge-transfer/learning-archetypes/archetype-classifier';
import { analyzeLearningTrajectory } from '../knowledge-transfer/learning-trajectories/trajectory-analyzer';
import { profileGovernancePersonality } from '../knowledge-transfer/maturity-personalities/personality-profiler';

const ENGINE_VERSION = '1.0.0';

interface FoundationalEngineSpec<TPayload> {
  engineId: string;
  domain: CognitionDomain;
  description: string;
  invoke: (orgId: string) => Promise<TPayload>;
  interpretationGuidance: string;
}

function defineFoundationalEngine<TPayload>(spec: FoundationalEngineSpec<TPayload>) {
  return defineCognitionEngine<TPayload>({
    engineId: spec.engineId,
    engineVersion: ENGINE_VERSION,
    domain: spec.domain,
    compute: async (organizationId: string) => {
      const payload = await spec.invoke(organizationId);
      return {
        payload,
        confidenceScore: 60,
        interpretationGuidance: spec.interpretationGuidance,
      };
    },
  });
}

export const institutionalLearningEngine = defineFoundationalEngine({
  engineId: 'institutional-learning',
  domain: 'institutional_memory',
  description: 'Longitudinal institutional learning extraction.',
  invoke: analyzeInstitutionalLearning,
  interpretationGuidance:
    'Long-horizon institutional learning posture. Identifies what the institution has learned vs. what it keeps re-learning.',
});

export const resilienceRoadmapEngine = defineFoundationalEngine({
  engineId: 'resilience-roadmap',
  domain: 'resilience',
  description: 'Resilience strengthening roadmap.',
  invoke: buildResilienceRoadmap,
  interpretationGuidance:
    'Prioritized continuity-strengthening pathway with maturity milestones. Use as planning input, not as a directive.',
});

export const dependencyPropagationEngine = defineFoundationalEngine({
  engineId: 'dependency-propagation',
  domain: 'systems_coherence',
  description: 'Continuity dependency propagation map.',
  invoke: buildDependencyPropagationMap,
  interpretationGuidance:
    'Cascade map across organizational dependencies. Highlights bottlenecks; reason at process level only.',
});

export const behaviorPatternsEngine = defineFoundationalEngine({
  engineId: 'behavior-patterns',
  domain: 'institutional_memory',
  description: 'Recurring institutional behavior patterns.',
  invoke: detectBehaviorPatterns,
  interpretationGuidance:
    'Recurring continuity behaviors at the institution level. Patterns are organizational, not personal.',
});

export const cascadeRisksEngine = defineFoundationalEngine({
  engineId: 'cascade-risks',
  domain: 'governance',
  description: 'Governance cascade risk analysis.',
  invoke: analyzeCascadeRisks,
  interpretationGuidance:
    'How governance failures cascade through operations and regulatory continuity.',
});

export const decisionBriefEngine = defineFoundationalEngine({
  engineId: 'decision-brief',
  domain: 'procedural_intelligence',
  description: 'Continuity decision brief.',
  invoke: generateDecisionBrief,
  interpretationGuidance:
    'Prioritized, evidence-linked continuity recommendations. Always reviewed by humans before action.',
});

export const continuityForecastEngine = defineFoundationalEngine({
  engineId: 'continuity-forecast',
  domain: 'adaptation',
  description: 'Continuity trend forecasting.',
  invoke: forecastContinuityTrends,
  interpretationGuidance:
    'Forward-looking continuity trends and governance-drift signals. Forecasts only — never deterministic.',
});

export const adaptiveResilienceEngine = defineFoundationalEngine({
  engineId: 'adaptive-resilience',
  domain: 'adaptation',
  description: 'History-informed adaptive resilience.',
  invoke: computeAdaptiveResilience,
  interpretationGuidance:
    'Resilience recommendations weighted by what has historically worked for THIS institution.',
});

export const governanceAdaptationEngine = defineFoundationalEngine({
  engineId: 'governance-adaptation',
  domain: 'governance',
  description: 'Longitudinal governance adaptation.',
  invoke: analyzeGovernanceAdaptation,
  interpretationGuidance:
    'How institutional governance reasoning evolves over time. Surfaces stagnation and drift patterns.',
});

export const mitigationEffectivenessEngine = defineFoundationalEngine({
  engineId: 'mitigation-effectiveness',
  domain: 'resilience',
  description: 'Mitigation effectiveness tracking.',
  invoke: trackMitigationEffectiveness,
  interpretationGuidance:
    'Did continuity interventions actually improve resilience? Tracks before/after delta.',
});

export const federatedBenchmarkEngine = defineFoundationalEngine({
  engineId: 'federated-benchmark',
  domain: 'coordination',
  description: 'Federated, privacy-safe governance benchmarking.',
  invoke: generateFederatedBenchmark,
  interpretationGuidance:
    'Privacy-safe benchmarking across federated orgs. Never leaks cross-org data.',
});

export const topicGraphEngine = defineFoundationalEngine({
  engineId: 'topic-graph',
  domain: 'systems_coherence',
  description: 'Operational knowledge topic graph.',
  invoke: buildTopicGraph,
  interpretationGuidance:
    'Knowledge relationship map with isolation/concentration risk callouts.',
});

export const resilienceHabitsEngine = defineFoundationalEngine({
  engineId: 'resilience-habits',
  domain: 'continuity',
  description: 'Resilience habit consistency.',
  invoke: trackResilienceHabits,
  interpretationGuidance:
    'Consistency of continuity-strengthening behaviors. Organizational-engagement view, not individual tracking.',
});

export const governanceCultureEngine = defineFoundationalEngine({
  engineId: 'governance-culture',
  domain: 'governance',
  description: 'Governance culture posture.',
  invoke: analyzeGovernanceCulture,
  interpretationGuidance:
    'Long-horizon governance culture posture inferred from institutional history.',
});

export const learningArchetypeEngine = defineFoundationalEngine({
  engineId: 'learning-archetype',
  domain: 'adaptation',
  description: 'Institutional learning archetype.',
  invoke: classifyLearningArchetype,
  interpretationGuidance:
    'Classifies the institution\'s continuity evolution style (proactive, reactive, maturing, etc.).',
});

export const learningTrajectoryEngine = defineFoundationalEngine({
  engineId: 'learning-trajectory',
  domain: 'institutional_memory',
  description: 'Long-term learning trajectory.',
  invoke: analyzeLearningTrajectory,
  interpretationGuidance:
    'Long-term continuity evolution with maturity milestones and learning momentum.',
});

export const governancePersonalityEngine = defineFoundationalEngine({
  engineId: 'governance-personality',
  domain: 'governance',
  description: 'Governance personality / posture style.',
  invoke: profileGovernancePersonality,
  interpretationGuidance:
    'Models institutional governance posture style (centralized, distributed, reactive, progressive).',
});

/**
 * Idempotent registration of all foundational engines with the kernel.
 */
function registerFoundationalEngines(): void {
  const specs: Array<{ id: string; domain: CognitionDomain; description: string }> = [
    { id: 'institutional-learning', domain: 'institutional_memory', description: 'Longitudinal institutional learning extraction.' },
    { id: 'resilience-roadmap', domain: 'resilience', description: 'Resilience strengthening roadmap.' },
    { id: 'dependency-propagation', domain: 'systems_coherence', description: 'Continuity dependency propagation map.' },
    { id: 'behavior-patterns', domain: 'institutional_memory', description: 'Recurring institutional behavior patterns.' },
    { id: 'cascade-risks', domain: 'governance', description: 'Governance cascade risk analysis.' },
    { id: 'decision-brief', domain: 'procedural_intelligence', description: 'Continuity decision brief.' },
    { id: 'continuity-forecast', domain: 'adaptation', description: 'Continuity trend forecasting.' },
    { id: 'adaptive-resilience', domain: 'adaptation', description: 'History-informed adaptive resilience.' },
    { id: 'governance-adaptation', domain: 'governance', description: 'Longitudinal governance adaptation.' },
    { id: 'mitigation-effectiveness', domain: 'resilience', description: 'Mitigation effectiveness tracking.' },
    { id: 'federated-benchmark', domain: 'coordination', description: 'Federated benchmarking.' },
    { id: 'topic-graph', domain: 'systems_coherence', description: 'Topic graph.' },
    { id: 'resilience-habits', domain: 'continuity', description: 'Resilience habits.' },
    { id: 'governance-culture', domain: 'governance', description: 'Governance culture posture.' },
    { id: 'learning-archetype', domain: 'adaptation', description: 'Learning archetype.' },
    { id: 'learning-trajectory', domain: 'institutional_memory', description: 'Learning trajectory.' },
    { id: 'governance-personality', domain: 'governance', description: 'Governance personality.' },
  ];

  for (const spec of specs) {
    if (cognitionRegistry.get(spec.id)) continue;
    cognitionRegistry.register({
      id: spec.id,
      version: ENGINE_VERSION,
      domains: [spec.domain],
      description: spec.description,
      readonly: true,
      emitsExplainability: true,
      contractVersion: COGNITION_CONTRACT_VERSION,
    });
  }
}

registerFoundationalEngines();

/** Steps suitable for inclusion in the unified orchestrator. */
export const FOUNDATIONAL_ORCHESTRATION_STEPS = [
  { engineId: 'institutional-learning', domain: 'institutional_memory' as CognitionDomain, invoke: institutionalLearningEngine },
  { engineId: 'resilience-roadmap', domain: 'resilience' as CognitionDomain, invoke: resilienceRoadmapEngine },
  { engineId: 'dependency-propagation', domain: 'systems_coherence' as CognitionDomain, invoke: dependencyPropagationEngine },
  { engineId: 'behavior-patterns', domain: 'institutional_memory' as CognitionDomain, invoke: behaviorPatternsEngine },
  { engineId: 'cascade-risks', domain: 'governance' as CognitionDomain, invoke: cascadeRisksEngine },
  { engineId: 'decision-brief', domain: 'procedural_intelligence' as CognitionDomain, invoke: decisionBriefEngine },
  { engineId: 'continuity-forecast', domain: 'adaptation' as CognitionDomain, invoke: continuityForecastEngine },
  { engineId: 'adaptive-resilience', domain: 'adaptation' as CognitionDomain, invoke: adaptiveResilienceEngine },
  { engineId: 'governance-adaptation', domain: 'governance' as CognitionDomain, invoke: governanceAdaptationEngine },
  { engineId: 'mitigation-effectiveness', domain: 'resilience' as CognitionDomain, invoke: mitigationEffectivenessEngine },
  { engineId: 'federated-benchmark', domain: 'coordination' as CognitionDomain, invoke: federatedBenchmarkEngine },
  { engineId: 'topic-graph', domain: 'systems_coherence' as CognitionDomain, invoke: topicGraphEngine },
  { engineId: 'resilience-habits', domain: 'continuity' as CognitionDomain, invoke: resilienceHabitsEngine },
  { engineId: 'governance-culture', domain: 'governance' as CognitionDomain, invoke: governanceCultureEngine },
  { engineId: 'learning-archetype', domain: 'adaptation' as CognitionDomain, invoke: learningArchetypeEngine },
  { engineId: 'learning-trajectory', domain: 'institutional_memory' as CognitionDomain, invoke: learningTrajectoryEngine },
  { engineId: 'governance-personality', domain: 'governance' as CognitionDomain, invoke: governancePersonalityEngine },
] as const;
