import { describe, it, expect } from 'vitest';
import {
  TARGET_ENVIRONMENTS,
  DEV_TARGETS,
  DEPLOYED_TARGETS,
  DEMO_PROFILE_VALUES,
  normalizeTargetEnvironment,
  isDevTarget,
  isDeployedTarget,
  isDemoTarget,
  detectDemoProfile,
  resolveEnvIdentity,
  assertTargetEnvironmentIs,
  forbiddenDemoReason,
} from '../index';

describe('normalizeTargetEnvironment', () => {
  it('accepts every canonical target', () => {
    for (const t of TARGET_ENVIRONMENTS) {
      expect(normalizeTargetEnvironment(t)).toBe(t);
    }
  });

  it('folds aliases', () => {
    expect(normalizeTargetEnvironment('dev')).toBe('development');
    expect(normalizeTargetEnvironment('DEV')).toBe('development');
    expect(normalizeTargetEnvironment(' prod ')).toBe('production');
  });

  it('fails closed on unknown values', () => {
    expect(normalizeTargetEnvironment(undefined)).toBe('production');
    expect(normalizeTargetEnvironment('')).toBe('production');
    expect(normalizeTargetEnvironment('somethingElse')).toBe('production');
    expect(normalizeTargetEnvironment(null)).toBe('production');
  });
});

describe('classification helpers', () => {
  it('isDevTarget covers dev/local/test only', () => {
    for (const t of DEV_TARGETS) expect(isDevTarget(t)).toBe(true);
    for (const t of DEPLOYED_TARGETS) expect(isDevTarget(t)).toBe(false);
    expect(isDevTarget('demo')).toBe(false);
  });

  it('isDeployedTarget covers staging/pilot/production only', () => {
    for (const t of DEPLOYED_TARGETS) expect(isDeployedTarget(t)).toBe(true);
    for (const t of DEV_TARGETS) expect(isDeployedTarget(t)).toBe(false);
    expect(isDeployedTarget('demo')).toBe(false);
  });

  it('isDemoTarget is exact', () => {
    expect(isDemoTarget('demo')).toBe(true);
    expect(isDemoTarget('development')).toBe(false);
    expect(isDemoTarget('production')).toBe(false);
  });
});

describe('detectDemoProfile', () => {
  it('matches every DEMO_PROFILE_VALUES entry', () => {
    for (const v of DEMO_PROFILE_VALUES) {
      expect(detectDemoProfile(v, undefined)).toBe(v);
      expect(detectDemoProfile(undefined, v)).toBe(v);
    }
  });

  it('is case-insensitive and trims', () => {
    expect(detectDemoProfile('  CUPE4373 ', undefined)).toBe('cupe4373');
  });

  it('returns null when neither slot matches', () => {
    expect(detectDemoProfile(undefined, undefined)).toBeNull();
    expect(detectDemoProfile('default', 'production')).toBeNull();
  });

  it('prefers UE_FEATURE_PROFILE over NEXT_PUBLIC_ when both set', () => {
    expect(detectDemoProfile('cupe4373', 'demo')).toBe('cupe4373');
  });
});

describe('resolveEnvIdentity', () => {
  it('reports demo profile as forbidden in deployed targets', () => {
    for (const t of DEPLOYED_TARGETS) {
      const id = resolveEnvIdentity({
        targetEnvironment: t,
        ueFeatureProfile: 'cupe4373',
      });
      expect(id.target).toBe(t);
      expect(id.demoProfile).toBe('cupe4373');
      expect(id.forbiddenDemoInDeployed).toBe(true);
    }
  });

  it('allows demo profile in dev targets', () => {
    for (const t of DEV_TARGETS) {
      const id = resolveEnvIdentity({
        targetEnvironment: t,
        ueFeatureProfile: 'cupe4373',
      });
      expect(id.forbiddenDemoInDeployed).toBe(false);
    }
  });

  it('fails closed when target missing', () => {
    const id = resolveEnvIdentity({ ueFeatureProfile: 'cupe4373' });
    expect(id.target).toBe('production');
    expect(id.forbiddenDemoInDeployed).toBe(true);
  });

  it('falls back to nodeEnv when targetEnvironment is absent', () => {
    const id = resolveEnvIdentity({ nodeEnv: 'development' });
    expect(id.target).toBe('development');
  });

  it('no demo profile → never forbidden', () => {
    const id = resolveEnvIdentity({ targetEnvironment: 'production' });
    expect(id.forbiddenDemoInDeployed).toBe(false);
  });
});

describe('assertTargetEnvironmentIs', () => {
  it('accepts unset env when expected=demo', () => {
    expect(assertTargetEnvironmentIs('demo', {} as NodeJS.ProcessEnv)).toBe(
      'demo',
    );
  });

  it('rejects unset env for non-demo expectations', () => {
    expect(() =>
      assertTargetEnvironmentIs('staging', {} as NodeJS.ProcessEnv),
    ).toThrow(/reality-env/);
  });

  it('rejects mismatch', () => {
    expect(() =>
      assertTargetEnvironmentIs('demo', {
        TARGET_ENVIRONMENT: 'production',
      } as NodeJS.ProcessEnv),
    ).toThrow(/reality-env/);
  });

  it('accepts exact match', () => {
    expect(
      assertTargetEnvironmentIs('production', {
        TARGET_ENVIRONMENT: 'production',
      } as NodeJS.ProcessEnv),
    ).toBe('production');
  });

  it('accepts alias', () => {
    expect(
      assertTargetEnvironmentIs('development', {
        TARGET_ENVIRONMENT: 'dev',
      } as NodeJS.ProcessEnv),
    ).toBe('development');
  });
});

describe('forbiddenDemoReason', () => {
  it('contains both profile and target', () => {
    const r = forbiddenDemoReason('cupe4373', 'staging');
    expect(r).toContain('cupe4373');
    expect(r).toContain('staging');
    expect(r).toMatch(/UE_FEATURE_PROFILE/);
  });
});
