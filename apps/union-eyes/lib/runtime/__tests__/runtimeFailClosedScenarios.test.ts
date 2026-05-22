/**
 * ARTIFACT TYPE: Vitest Suite — Fail-Closed Scenarios
 * MODULE: OCI Operational Truth Hardening — Part 6
 * DOCTRINE_VERSION: 1.0.0
 *
 * Scenario coverage for the runtime fail-closed gate beyond the unit-level
 * tests in fail-closed.test.ts. Focuses on report-shape integrity under
 * various env-presence permutations.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RuntimeContractError, assessRuntimeContracts, enforceRuntimeFailClosed } from '../fail-closed';

const REQUIRED_ENVS = ['AUTH_SECRET', 'DJANGO_SECRET_KEY', 'FALLBACK_ENCRYPTION_KEY', 'DATABASE_URL'];

function silentLogger() {
  return { info: () => undefined, warn: () => undefined, error: () => undefined };
}

describe('Runtime fail-closed scenarios', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const key of [...REQUIRED_ENVS, 'RUNTIME_FAIL_CLOSED']) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('refuses boot when fail-closed enforced and all required contracts are missing', () => {
    process.env.RUNTIME_FAIL_CLOSED = 'true';
    expect(() => enforceRuntimeFailClosed(silentLogger())).toThrow(RuntimeContractError);
  });

  it('returns a report (no throw) when fail-closed is advisory mode', () => {
    process.env.RUNTIME_FAIL_CLOSED = 'false';
    const report = enforceRuntimeFailClosed(silentLogger());
    expect(report.failClosedEnabled).toBe(false);
    expect(report.unmetRequired.length).toBeGreaterThan(0);
  });

  it('a satisfied required contract no longer appears in unmetRequired', () => {
    process.env.AUTH_SECRET = 'x';
    const report = assessRuntimeContracts();
    expect(report.unmetRequired.map((c) => c.envVar)).not.toContain('AUTH_SECRET');
  });

  it('whitespace-only env values are treated as missing', () => {
    process.env.AUTH_SECRET = '   ';
    const report = assessRuntimeContracts();
    expect(report.unmetRequired.map((c) => c.envVar)).toContain('AUTH_SECRET');
  });

  it('RuntimeContractError carries the report it refused on', () => {
    process.env.RUNTIME_FAIL_CLOSED = 'true';
    try {
      enforceRuntimeFailClosed(silentLogger());
      expect.fail('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RuntimeContractError);
      const e = err as RuntimeContractError;
      expect(e.report.unmetRequired.length).toBeGreaterThan(0);
    }
  });
});
