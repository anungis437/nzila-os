import { describe, expect, it, vi } from 'vitest';

// DEF-0B7-COGA-ENVELOPE-CONFIDENCE-IS-A-CONSTANT-AND-EXPLAINABILITY-IS-EMPTY and
// DEF-0B7-COGB-ENVELOPE-CONFIDENCE-FIXED-AT-60-AND-EXPLAINABILITY-EMPTY: the foundational adapter stated a constant (later an
// entry count) as the envelope's confidence and attached no evidence. The envelope now carries, as evidence, only the stored records
// the result itself cites, and no confidence is claimed: no engine computes one.

const h = vi.hoisted(() => ({ adaptation: vi.fn(), habits: vi.fn() }));

vi.mock('../../knowledge-transfer/institutional-learning/learning-engine', () => ({ analyzeInstitutionalLearning: vi.fn() }));
vi.mock('../../knowledge-transfer/resilience-strategies/strategy-modeler', () => ({ buildResilienceRoadmap: vi.fn() }));
vi.mock('../../knowledge-transfer/propagation/dependency-propagator', () => ({ buildDependencyPropagationMap: vi.fn() }));
vi.mock('../../knowledge-transfer/behavior-patterns/behavior-engine', () => ({ detectBehaviorPatterns: vi.fn() }));
vi.mock('../../knowledge-transfer/cascade-analysis/cascade-analyzer', () => ({ analyzeCascadeRisks: vi.fn() }));
vi.mock('../../knowledge-transfer/decision-intelligence/decision-engine', () => ({ generateDecisionBrief: vi.fn() }));
vi.mock('../../knowledge-transfer/forecasting/continuity-forecaster', () => ({ forecastContinuityTrends: vi.fn() }));
vi.mock('../../knowledge-transfer/adaptive-resilience/adaptive-engine', () => ({ computeAdaptiveResilience: vi.fn() }));
vi.mock('../../knowledge-transfer/governance-adaptation/adaptation-engine', () => ({ analyzeGovernanceAdaptation: h.adaptation }));
vi.mock('../../knowledge-transfer/mitigation-effectiveness/effectiveness-tracker', () => ({ trackMitigationEffectiveness: vi.fn() }));
vi.mock('../../knowledge-transfer/federated-intelligence/federated-engine', () => ({ generateFederatedBenchmark: vi.fn() }));
vi.mock('../../knowledge-transfer/topic-graph/topic-graph-builder', () => ({ buildTopicGraph: vi.fn() }));
vi.mock('../../knowledge-transfer/resilience-habits/habit-tracker', () => ({ trackResilienceHabits: h.habits }));
vi.mock('../../knowledge-transfer/governance-culture/culture-engine', () => ({ analyzeGovernanceCulture: vi.fn() }));
vi.mock('../../knowledge-transfer/learning-archetypes/archetype-classifier', () => ({ classifyLearningArchetype: vi.fn() }));
vi.mock('../../knowledge-transfer/learning-trajectories/trajectory-analyzer', () => ({ analyzeLearningTrajectory: vi.fn() }));
vi.mock('../../knowledge-transfer/maturity-personalities/personality-profiler', () => ({ profileGovernancePersonality: vi.fn() }));

import {
  collectCitedMemoryEntryIds,
  governanceAdaptationEngine,
  resilienceHabitsEngine,
} from '../kernel-bridge-foundational';

const ORG = '00000000-0000-4000-8000-000000000001';

describe('foundational cognition envelopes', () => {
  it('attaches as evidence exactly the memory entries the result cites, and claims no confidence', async () => {
    h.adaptation.mockResolvedValue({
      entriesAnalyzed: 95,
      reasoningEvolution: [{ memoryEntryId: 'mem-1' }, { memoryEntryId: 'mem-2' }, { memoryEntryId: null }],
      timeline: [{ point: { memoryEntryId: 'mem-2' } }],
    });
    const envelope = await governanceAdaptationEngine(ORG);
    expect(envelope.evidence.map((e) => e.reference)).toEqual([
      { kind: 'cognition_memory', id: 'mem-1' },
      { kind: 'cognition_memory', id: 'mem-2' },
    ]);
    // 95 entries read is not a confidence: the band is the kernel's "not assessed" floor whatever the volume.
    expect(envelope.confidence).toBe('insufficient_data');
    expect(envelope.reasoning).toEqual([]);
    expect(envelope.governanceImplications).toEqual([]);
  });

  it('attaches no evidence when the result cites no record, and still claims no confidence', async () => {
    h.habits.mockResolvedValue({ entriesAnalyzed: 100, habits: [{ name: 'documentation', consistency: 0.4 }] });
    const envelope = await resilienceHabitsEngine(ORG);
    expect(envelope.evidence).toEqual([]);
    expect(envelope.confidence).toBe('insufficient_data');
  });

  it('collects cited ids through nested arrays and objects without counting non-string ids', () => {
    expect(collectCitedMemoryEntryIds({ a: [{ memoryEntryId: 'x' }, { b: { memoryEntryId: 'y' } }], memoryEntryId: 7 })).toEqual(['x', 'y']);
    expect(collectCitedMemoryEntryIds(null)).toEqual([]);
  });
});
