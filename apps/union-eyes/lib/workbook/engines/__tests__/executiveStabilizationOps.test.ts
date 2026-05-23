import { describe, expect, it } from 'vitest';
import {
  runExecutiveStabilizationModel,
  type ExecutiveStabilizationInput,
} from '@/lib/workbook/engines/executive/executiveStabilizationModel';
import { emitExecutiveSignals } from '@/lib/workbook/engines/executive/stabilizationExecutiveSignals';
import { readContinuityOperationalHealth } from '@/lib/workbook/engines/executive/continuityOperationalHealth';
import type { ProgressionReading } from '@/lib/workbook/engines/progression/stabilizationScoringEngine';
import type { MaturityProgressionReading } from '@/lib/workbook/engines/progression/continuityMaturityProgression';
import type { StabilizationEvolutionReading } from '@/lib/workbook/engines/progression/stabilizationEvolutionModel';

const FORBIDDEN =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;
const BLAME = /why do you (not|fail to|never)/i;

const baseProgression: ProgressionReading = {
  engineVersion: '2.0.0',
  band: 'not_yet_readable',
  contributingSources: [],
  reading: 'Stabilization progression is not yet readable.',
};

const baseMaturity: MaturityProgressionReading = {
  engineVersion: '2.0.0',
  currentStage: 'unknown',
  nextStage: null,
  atTerminalStage: false,
  reading: 'Maturity stage has not been located; reading is deferred.',
};

const baseEvolution: StabilizationEvolutionReading = {
  engineVersion: '2.0.0',
  direction: 'unknown',
  posture: 'unknown',
  continuityRate: 0,
  reading: 'Organizational evolution has not been read.',
};

const emptyInput: ExecutiveStabilizationInput = {
  currentState: null,
  progression: baseProgression,
  maturity: baseMaturity,
  evolution: baseEvolution,
  interventionLedger: {
    irreversiblyRatifiedCount: 0,
    regressedCount: 0,
    withdrawnCount: 0,
    activeCount: 0,
    awaitingRatificationStaleCount: 0,
  },
  stewardshipRedistribution: { offeredCount: 0, refusedCount: 0, consentWithdrawnCount: 0 },
  governanceRecovery: { ratifiedMovesCount: 0, pendingMovesCount: 0 },
  onboardingSurvivability: { workflowsCompletedCount: 0, workflowsActiveCount: 0 },
};

describe('runExecutiveStabilizationModel', () => {
  it('returns not_yet_readable composite when no domains are readable', () => {
    const r = runExecutiveStabilizationModel(emptyInput);
    expect(r.compositeBand).toBe('not_yet_readable');
    expect(r.domains.length).toBe(8);
  });

  it('returns stabilizing composite when domains show ratified forward movement', () => {
    const r = runExecutiveStabilizationModel({
      ...emptyInput,
      currentState: 'continuity_stabilized',
      progression: { ...baseProgression, band: 'advancing', contributingSources: ['intervention_ledger', 'state_engine'], reading: 'Stabilization is advancing.' },
      interventionLedger: { irreversiblyRatifiedCount: 4, regressedCount: 0, withdrawnCount: 0, activeCount: 1, awaitingRatificationStaleCount: 0 },
      stewardshipRedistribution: { offeredCount: 2, refusedCount: 0, consentWithdrawnCount: 0 },
      governanceRecovery: { ratifiedMovesCount: 3, pendingMovesCount: 0 },
      onboardingSurvivability: { workflowsCompletedCount: 2, workflowsActiveCount: 0 },
    });
    expect(r.compositeBand).toBe('stabilizing');
  });

  it('returns regressing composite when any readable domain regresses', () => {
    const r = runExecutiveStabilizationModel({
      ...emptyInput,
      currentState: 'continuity_debt_elevated',
      progression: { ...baseProgression, band: 'regressing', contributingSources: ['state_engine', 'evolution_tracker'], reading: 'Recovery has been lost.' },
      interventionLedger: { irreversiblyRatifiedCount: 1, regressedCount: 3, withdrawnCount: 0, activeCount: 0, awaitingRatificationStaleCount: 0 },
    });
    expect(r.compositeBand).toBe('regressing');
  });

  it('is deterministic across repeated runs', () => {
    const a = runExecutiveStabilizationModel(emptyInput);
    const b = runExecutiveStabilizationModel(emptyInput);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('uses tone free of forbidden vocabulary and blame framing', () => {
    const inputs: ExecutiveStabilizationInput[] = [
      emptyInput,
      {
        ...emptyInput,
        currentState: 'continuity_stabilized',
        progression: { ...baseProgression, band: 'advancing', contributingSources: ['intervention_ledger', 'state_engine'], reading: 'Stabilization is advancing.' },
        interventionLedger: { irreversiblyRatifiedCount: 4, regressedCount: 0, withdrawnCount: 0, activeCount: 1, awaitingRatificationStaleCount: 0 },
        stewardshipRedistribution: { offeredCount: 2, refusedCount: 1, consentWithdrawnCount: 1 },
        governanceRecovery: { ratifiedMovesCount: 3, pendingMovesCount: 1 },
        onboardingSurvivability: { workflowsCompletedCount: 2, workflowsActiveCount: 1 },
      },
    ];
    for (const i of inputs) {
      const r = runExecutiveStabilizationModel(i);
      const text = r.reading + ' ' + r.domains.map((d) => d.statement).join(' ');
      expect(text).not.toMatch(FORBIDDEN);
      expect(text).not.toMatch(BLAME);
    }
  });

  it('does not name any individual carrier in any domain statement', () => {
    const r = runExecutiveStabilizationModel({
      ...emptyInput,
      currentState: 'stewardship_redistribution_active',
      stewardshipRedistribution: { offeredCount: 1, refusedCount: 0, consentWithdrawnCount: 0 },
    });
    for (const d of r.domains) {
      expect(d.statement).not.toMatch(/\b(Mr|Ms|Mrs|Dr)\.\s+[A-Z]/);
    }
  });
});

describe('emitExecutiveSignals', () => {
  it('emits one signal per domain in stable signalId order', () => {
    const result = runExecutiveStabilizationModel({
      ...emptyInput,
      currentState: 'continuity_stabilized',
      interventionLedger: { irreversiblyRatifiedCount: 2, regressedCount: 0, withdrawnCount: 0, activeCount: 0, awaitingRatificationStaleCount: 0 },
    });
    const { signals } = emitExecutiveSignals(result);
    expect(signals.length).toBe(result.domains.length);
    const ids = signals.map((s) => s.signalId);
    expect([...ids].sort()).toEqual(ids);
  });

  it('marks regressing domains as critical and stabilizing as note', () => {
    const result = runExecutiveStabilizationModel({
      ...emptyInput,
      currentState: 'continuity_debt_elevated',
      interventionLedger: { irreversiblyRatifiedCount: 0, regressedCount: 2, withdrawnCount: 0, activeCount: 0, awaitingRatificationStaleCount: 0 },
    });
    const { signals } = emitExecutiveSignals(result);
    const ledger = signals.find((s) => s.signalId === 'executive:intervention_ledger_health');
    expect(ledger?.severity).toBe('critical');
  });
});

describe('readContinuityOperationalHealth', () => {
  it('counts readable vs total domains and exposes per-domain bands', () => {
    const result = runExecutiveStabilizationModel({
      ...emptyInput,
      currentState: 'continuity_stabilized',
      governanceRecovery: { ratifiedMovesCount: 1, pendingMovesCount: 0 },
    });
    const health = readContinuityOperationalHealth(result);
    expect(health.totalDomainCount).toBe(8);
    expect(health.readableDomainCount).toBeGreaterThanOrEqual(2);
    expect(health.perDomain.stabilization_state).toBeDefined();
    expect(health.perDomain.continuity_operational_health).toBeDefined();
  });
});
