import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  probePostgresPing,
  probeSecretPresence,
  probeDemoProfileEnforcement,
  unmeasuredProbes,
} from '../pilot-admin-operational';

describe('pilot-admin-operational: probePostgresPing', () => {
  it('reports pass when the runner resolves', async () => {
    const check = await probePostgresPing(async () => 1);
    expect(check.state).toBe('pass');
    expect(check.severity).toBe('info');
    expect(check.capabilityId).toBe('UE-DB-POSTGRES-PING');
  });

  it('reports fail with critical severity when the runner throws', async () => {
    const check = await probePostgresPing(async () => {
      throw new Error('boom');
    });
    expect(check.state).toBe('fail');
    expect(check.severity).toBe('critical');
    expect(String(check.observedValue)).toMatch(/boom/);
  });
});

describe('pilot-admin-operational: probeSecretPresence', () => {
  const KEY = 'UE_TEST_SECRET_PROBE';
  const originalValue = process.env[KEY];

  beforeEach(() => {
    delete process.env[KEY];
  });
  afterEach(() => {
    if (originalValue === undefined) delete process.env[KEY];
    else process.env[KEY] = originalValue;
  });

  it('fails when the env var is unset', () => {
    const check = probeSecretPresence(KEY, 'UE-TEST', 'Test secret', 'set it');
    expect(check.state).toBe('fail');
    expect(check.severity).toBe('error');
  });

  it('fails when the env var is empty string', () => {
    process.env[KEY] = '';
    const check = probeSecretPresence(KEY, 'UE-TEST', 'Test secret', 'set it');
    expect(check.state).toBe('fail');
  });

  it('passes when the env var is set', () => {
    process.env[KEY] = 'some-value';
    const check = probeSecretPresence(KEY, 'UE-TEST', 'Test secret', 'set it');
    expect(check.state).toBe('pass');
    expect(check.severity).toBe('info');
    // Must NOT echo the secret value.
    expect(String(check.observedValue)).not.toContain('some-value');
  });
});

describe('pilot-admin-operational: probeDemoProfileEnforcement', () => {
  it('passes when demo profile is inactive in production', () => {
    const check = probeDemoProfileEnforcement({ targetEnvironment: 'production' });
    expect(check.state).toBe('pass');
  });

  it('fails when a demo profile is active in staging', () => {
    const check = probeDemoProfileEnforcement({
      targetEnvironment: 'staging',
      ueFeatureProfile: 'demo',
    });
    expect(check.state).toBe('fail');
    expect(check.severity).toBe('critical');
  });

  it('passes when a demo profile is active in development', () => {
    const check = probeDemoProfileEnforcement({
      targetEnvironment: 'development',
      ueFeatureProfile: 'demo',
    });
    expect(check.state).toBe('pass');
  });

  it('fail-closed default (missing target env is treated as production)', () => {
    const check = probeDemoProfileEnforcement({
      ueFeatureProfile: 'demo',
    });
    expect(check.state).toBe('fail');
  });

  it.each(['demo', 'sample', 'placeholder', 'fixture', 'synthetic'])(
    'fails in staging when generic sentinel %s is active (Task H)',
    (sentinel) => {
      const check = probeDemoProfileEnforcement({
        targetEnvironment: 'staging',
        ueFeatureProfile: sentinel,
      });
      expect(check.state).toBe('fail');
    },
  );

  it.each(['cupe4373', 'cupe-4373', 'CUPE4373', 'acme', 'nzila'])(
    'does NOT treat customer-name token %s as a demo sentinel (Task H generic-only)',
    (customerName) => {
      const check = probeDemoProfileEnforcement({
        targetEnvironment: 'staging',
        ueFeatureProfile: customerName,
      });
      // Customer-name tokens must NOT trigger the demo guard — the guard is
      // for generic concept-level markers only. Boot-time env validation
      // (env-validation.ts z.never()) is the barrier for tenant-specific
      // fixtures, not this probe.
      expect(check.state).toBe('pass');
    },
  );
});

describe('pilot-admin-operational: unmeasuredProbes', () => {
  it('returns >=19 unknown probes with the full mandated shape', () => {
    const probes = unmeasuredProbes();
    expect(probes.length).toBeGreaterThanOrEqual(19);
    for (const p of probes) {
      expect(p.state).toBe('unknown');
      expect(p.severity).toBe('error');
      expect(p.capabilityId).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.expectedValue).toBeTruthy();
      expect(p.remediationGuidance).toBeTruthy();
      expect(p.observedValue).toBeNull();
    }
  });

  it('every probe has a unique capabilityId', () => {
    const probes = unmeasuredProbes();
    const ids = probes.map((p) => p.capabilityId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
