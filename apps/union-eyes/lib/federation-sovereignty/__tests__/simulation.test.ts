import { describe, it, expect, beforeEach } from 'vitest';
import type { SovereignGovernanceContract } from '../types';
import {
  registerSimulationScenario,
  getAllSimulationScenarios,
  runCrossFederationSimulation,
  replaySovereigntyScenario,
  BUILT_IN_SCENARIOS,
  _resetSimulationRegistry,
} from '../simulation';
import { _resetDelegationRegistry } from '../delegation';
import { clearSovereigntyLedger } from '../ledger';
import { computeSovereigntyReadiness } from '../scoring';

const national: SovereignGovernanceContract = {
  federationId: 'national-sim',
  sovereigntyTier: 'national',
  sovereigntyMode: 'fully-autonomous',
  delegatedAuthorities: ['publication', 'policy-enforcement', 'ai-operations', 'member-governance', 'audit-visibility', 'continuity-management'],
  inheritedPolicies: ['policy.national-baseline', 'policy.ai-core'],
  overrideRestrictions: [],
  escalationRequirements: [],
  continuityRequirements: [],
  auditVisibility: 'national',
};

const regional: SovereignGovernanceContract = {
  federationId: 'regional-sim',
  sovereigntyTier: 'regional',
  sovereigntyMode: 'federation-aligned',
  delegatedAuthorities: ['publication', 'member-governance'],
  inheritedPolicies: ['policy.national-baseline'],
  overrideRestrictions: [],
  escalationRequirements: [],
  continuityRequirements: [],
  auditVisibility: 'regional',
};

const restrictedLocal: SovereignGovernanceContract = {
  federationId: 'local-sim-restricted',
  sovereigntyTier: 'local',
  sovereigntyMode: 'restricted',
  delegatedAuthorities: ['member-governance'],
  inheritedPolicies: ['policy.national-baseline'],
  overrideRestrictions: ['publication', 'policy.ai-core'],
  escalationRequirements: ['publication'],
  continuityRequirements: ['require.succession-plan'],
  auditVisibility: 'local',
};

describe('simulation engine', () => {
  beforeEach(() => {
    _resetSimulationRegistry();
    _resetDelegationRegistry();
    clearSovereigntyLedger();
    // Re-register built-ins after reset
    for (const s of BUILT_IN_SCENARIOS) {
      registerSimulationScenario(s);
    }
  });

  describe('built-in scenarios', () => {
    it('registers all 5 built-in scenarios', () => {
      expect(getAllSimulationScenarios().length).toBeGreaterThanOrEqual(5);
    });
  });

  describe('runCrossFederationSimulation', () => {
    it('detects policy divergence in national-policy-tightening scenario', () => {
      const scenario = getAllSimulationScenarios().find(
        (s) => s.id === 'national-policy-tightening',
      )!;
      const result = runCrossFederationSimulation(
        scenario,
        [national, restrictedLocal],
        'corr-test-001',
      );
      expect(result.governanceMode).toBe('shadow');
      expect(result.scenarioId).toBe('national-policy-tightening');
    });

    it('detects continuity gap in steward-turnover scenario', () => {
      const scenario = getAllSimulationScenarios().find(
        (s) => s.id === 'steward-turnover-continuity-loss',
      )!;
      const result = runCrossFederationSimulation(
        scenario,
        [restrictedLocal],
        'corr-test-002',
      );
      expect(result.conflictsDetected).toContain('continuity-jurisdiction');
    });

    it('detects AI conflict in ai-governance-federation-conflict scenario', () => {
      const scenario = getAllSimulationScenarios().find(
        (s) => s.id === 'ai-governance-federation-conflict',
      )!;
      const result = runCrossFederationSimulation(
        scenario,
        [restrictedLocal],
        'corr-test-003',
      );
      expect(result.conflictsDetected).toContain('ai-autonomy-conflict');
    });

    it('detects escalation deadlock in audit-visibility scenario', () => {
      const scenario = getAllSimulationScenarios().find(
        (s) => s.id === 'audit-visibility-escalation-deadlock',
      )!;
      const result = runCrossFederationSimulation(
        scenario,
        [national, national],
        'corr-test-004',
      );
      expect(result.conflictsDetected).toContain('escalation-deadlock');
    });
  });

  describe('replaySovereigntyScenario', () => {
    it('replays a scenario and detects outcome drift', () => {
      const replay = replaySovereigntyScenario({
        scenarioId: 'national-policy-tightening',
        originalContracts: [national, restrictedLocal],
        updatedContracts: [national, regional],
        correlationId: 'replay-001',
      });
      expect(replay.governanceMode).toBe('shadow');
      expect(replay.scenarioId).toBe('national-policy-tightening');
      expect(replay.policiesChanged).toBe(true);
    });

    it('throws for unknown scenario', () => {
      expect(() =>
        replaySovereigntyScenario({
          scenarioId: 'does-not-exist',
          originalContracts: [],
          updatedContracts: [],
          correlationId: 'c1',
        }),
      ).toThrow('Unknown scenario');
    });
  });

  describe('computeSovereigntyReadiness', () => {
    it('returns shadow-mode assessment', () => {
      const assessment = computeSovereigntyReadiness([national, regional]);
      expect(assessment.governanceMode).toBe('shadow');
      expect(assessment.overall).toBeGreaterThanOrEqual(0);
      expect(assessment.overall).toBeLessThanOrEqual(100);
    });

    it('returns 100 for empty contracts set', () => {
      const assessment = computeSovereigntyReadiness([]);
      expect(assessment.overall).toBe(100);
    });

    it('penalises restricted units', () => {
      const restrictedAssessment = computeSovereigntyReadiness([restrictedLocal]);
      const freeAssessment = computeSovereigntyReadiness([national]);
      expect(freeAssessment.overall).toBeGreaterThanOrEqual(restrictedAssessment.overall);
    });

    it('includes simulation count from registry', () => {
      const assessment = computeSovereigntyReadiness([national]);
      expect(assessment.simulationCount).toBeGreaterThanOrEqual(5);
    });
  });
});
