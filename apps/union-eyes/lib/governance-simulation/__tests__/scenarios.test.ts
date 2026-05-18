import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAllScenarios,
  getScenario,
  getScenariosByScope,
  _resetScenarioCatalog,
} from '../scenarios';

describe('governance-simulation/scenarios', () => {
  beforeEach(() => {
    _resetScenarioCatalog();
  });

  it('bootstraps at least 10 built-in scenarios', () => {
    expect(getAllScenarios().length).toBeGreaterThanOrEqual(10);
  });

  it('all scenarios have required fields', () => {
    for (const s of getAllScenarios()) {
      expect(s.id).toBeTruthy();
      expect(s.description).toBeTruthy();
      expect(s.scope).toBeTruthy();
      expect(Array.isArray(s.assumptions)).toBe(true);
      expect(Array.isArray(s.simulatedPolicies)).toBe(true);
      expect(Array.isArray(s.expectedOutcomes)).toBe(true);
      expect(typeof s.evidenceRequired).toBe('boolean');
      expect(typeof s.escalationExpected).toBe('boolean');
    }
  });

  it('scenario IDs are unique', () => {
    const ids = getAllScenarios().map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('getScenario returns undefined for unknown id', () => {
    expect(getScenario('nonexistent.scenario')).toBeUndefined();
  });

  it('getScenario returns the scenario for a known id', () => {
    const s = getScenario('federation.policy-tightening-cascade');
    expect(s).toBeDefined();
    expect(s!.scope).toBe('federation');
  });

  it('getScenariosByScope filters correctly', () => {
    const fedScenarios = getScenariosByScope('federation');
    expect(fedScenarios.length).toBeGreaterThan(0);
    for (const s of fedScenarios) {
      expect(s.scope).toBe('federation');
    }
  });

  it('all federation scenarios have federationTier set', () => {
    const fedScenarios = getScenariosByScope('federation');
    for (const s of fedScenarios) {
      expect(s.federationTier).toBeDefined();
    }
  });

  it('all continuity scenarios have stressType set', () => {
    const continuityScenarios = getScenariosByScope('continuity');
    for (const s of continuityScenarios) {
      expect(s.stressType).toBeDefined();
    }
  });

  it('critical scenarios require evidence', () => {
    const criticalScenarios = getAllScenarios().filter(
      (s) => s.governanceSensitivity === 'critical',
    );
    for (const s of criticalScenarios) {
      expect(s.evidenceRequired).toBe(true);
    }
  });

  it('incident scenarios have incidentClass set', () => {
    const incidentScenarios = getScenariosByScope('incident');
    for (const s of incidentScenarios) {
      expect(s.incidentClass).toBeDefined();
    }
  });
});
