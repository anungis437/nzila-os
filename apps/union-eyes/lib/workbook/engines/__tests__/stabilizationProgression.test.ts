import { describe, expect, it } from 'vitest';
import {
  readStabilizationProgression,
  type ProgressionInput,
} from '@/lib/workbook/engines/progression/stabilizationScoringEngine';
import { readStabilizationEvolution } from '@/lib/workbook/engines/progression/stabilizationEvolutionModel';
import { readMaturityProgression } from '@/lib/workbook/engines/progression/continuityMaturityProgression';
import type { OrganizationalEvolutionResult } from '@/lib/workbook/engines/organizationalEvolutionTracker';
import type { OciMaturityPathwayResult } from '@/lib/workbook/engines/ociMaturityPathway';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

const emptyInput: ProgressionInput = {
  interventions: {
    irreversiblyRatifiedCount: 0,
    regressedCount: 0,
    withdrawnCount: 0,
    activeCount: 0,
  },
  stateEngine: { direction: 'unknown' },
  evolution: { posture: 'unknown' },
};

describe('readStabilizationProgression', () => {
  it('returns not_yet_readable when fewer than two sources contribute', () => {
    const result = readStabilizationProgression(emptyInput);
    expect(result.band).toBe('not_yet_readable');
    expect(result.contributingSources.length).toBeLessThan(2);
  });

  it('returns advancing when two sources agree on forward movement', () => {
    const result = readStabilizationProgression({
      ...emptyInput,
      interventions: { irreversiblyRatifiedCount: 3, regressedCount: 0, withdrawnCount: 0, activeCount: 1 },
      stateEngine: { direction: 'advancing' },
      evolution: { posture: 'continuous' },
    });
    expect(result.band).toBe('advancing');
    expect(result.contributingSources.length).toBeGreaterThanOrEqual(2);
  });

  it('returns regressing when at least one readable source regresses', () => {
    const result = readStabilizationProgression({
      ...emptyInput,
      interventions: { irreversiblyRatifiedCount: 1, regressedCount: 3, withdrawnCount: 0, activeCount: 0 },
      stateEngine: { direction: 'advancing' },
      evolution: { posture: 'fractured' },
    });
    expect(result.band).toBe('regressing');
  });

  it('returns holding when sources agree on holding', () => {
    const result = readStabilizationProgression({
      ...emptyInput,
      interventions: { irreversiblyRatifiedCount: 1, regressedCount: 1, withdrawnCount: 0, activeCount: 2 },
      stateEngine: { direction: 'holding' },
      evolution: { posture: 'reinterpreted' },
    });
    expect(result.band).toBe('holding');
  });

  it('is deterministic across repeated runs', () => {
    const input: ProgressionInput = {
      ...emptyInput,
      interventions: { irreversiblyRatifiedCount: 2, regressedCount: 0, withdrawnCount: 0, activeCount: 0 },
      stateEngine: { direction: 'advancing' },
      evolution: { posture: 'evolved' },
    };
    const a = readStabilizationProgression(input);
    const b = readStabilizationProgression(input);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const inputs: ProgressionInput[] = [
      emptyInput,
      { ...emptyInput, interventions: { irreversiblyRatifiedCount: 5, regressedCount: 0, withdrawnCount: 0, activeCount: 0 }, stateEngine: { direction: 'advancing' }, evolution: { posture: 'continuous' } },
      { ...emptyInput, interventions: { irreversiblyRatifiedCount: 0, regressedCount: 3, withdrawnCount: 0, activeCount: 0 }, stateEngine: { direction: 'regressing' }, evolution: { posture: 'fractured' } },
    ];
    for (const i of inputs) {
      const text = readStabilizationProgression(i).reading;
      expect(text).not.toMatch(FORBIDDEN);
      expect(text).not.toMatch(BLAME);
    }
  });
});

describe('readStabilizationEvolution', () => {
  it('returns unknown when no evolution result is provided', () => {
    const r = readStabilizationEvolution(null);
    expect(r.direction).toBe('unknown');
    expect(r.posture).toBe('unknown');
  });

  it('maps continuous and evolved postures to advancing', () => {
    for (const posture of ['continuous', 'evolved'] as const) {
      const evo: OrganizationalEvolutionResult = {
        posture,
        continuityRate: 0.9,
        interpretationDrift: 0,
        eras: [],
        reading: '',
      };
      expect(readStabilizationEvolution(evo).direction).toBe('advancing');
    }
  });

  it('maps fractured posture to regressing and is tone-clean', () => {
    const evo: OrganizationalEvolutionResult = {
      posture: 'fractured',
      continuityRate: 0.1,
      interpretationDrift: 0.4,
      eras: [],
      reading: '',
    };
    const r = readStabilizationEvolution(evo);
    expect(r.direction).toBe('regressing');
    expect(r.reading).not.toMatch(FORBIDDEN);
    expect(r.reading).not.toMatch(BLAME);
  });
});

describe('readMaturityProgression', () => {
  it('returns unknown when no pathway is provided', () => {
    const r = readMaturityProgression(null);
    expect(r.currentStage).toBe('unknown');
    expect(r.nextStage).toBeNull();
    expect(r.atTerminalStage).toBe(false);
  });

  it('names current stage and legal next stage', () => {
    const pathway: OciMaturityPathwayResult = {
      currentStage: 'stabilization_underway',
      currentPhase: 'stabilization',
      nextPhase: 'infrastructure',
      pathway: [],
      reading: '',
    };
    const r = readMaturityProgression(pathway);
    expect(r.currentStage).toBe('stabilization_underway');
    expect(r.nextStage).toBe('infrastructure_underway');
    expect(r.atTerminalStage).toBe(false);
  });

  it('flags terminal stage and tone-clean reading', () => {
    const pathway: OciMaturityPathwayResult = {
      currentStage: 'intelligence_underway',
      currentPhase: 'intelligence',
      nextPhase: null,
      pathway: [],
      reading: '',
    };
    const r = readMaturityProgression(pathway);
    expect(r.atTerminalStage).toBe(true);
    expect(r.nextStage).toBeNull();
    expect(r.reading).not.toMatch(FORBIDDEN);
    expect(r.reading).not.toMatch(BLAME);
  });
});
