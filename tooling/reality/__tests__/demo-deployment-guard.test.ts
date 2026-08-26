import { describe, it, expect } from 'vitest';
import { evaluateDemoGuard, assertDemoDeploymentGuard } from '../demo-deployment-guard';

describe('evaluateDemoGuard', () => {
  it('allows demo profile in development', () => {
    const r = evaluateDemoGuard({
      targetEnvironment: 'development',
      ueFeatureProfile: 'cupe4373',
      publicDemoProfile: undefined,
      nodeEnv: 'development',
    });
    expect(r.ok).toBe(true);
    expect(r.demoProfileDetected).toBe('cupe4373');
  });

  it('allows demo profile in local', () => {
    const r = evaluateDemoGuard({
      targetEnvironment: 'local',
      ueFeatureProfile: undefined,
      publicDemoProfile: 'cupe4373',
      nodeEnv: 'development',
    });
    expect(r.ok).toBe(true);
  });

  it('rejects demo profile in staging', () => {
    const r = evaluateDemoGuard({
      targetEnvironment: 'staging',
      ueFeatureProfile: 'cupe4373',
      publicDemoProfile: undefined,
      nodeEnv: 'production',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('cupe4373');
    expect(r.reason).toContain('staging');
  });

  it('rejects demo profile in pilot', () => {
    const r = evaluateDemoGuard({
      targetEnvironment: 'pilot',
      ueFeatureProfile: 'cupe4373',
      publicDemoProfile: undefined,
      nodeEnv: 'production',
    });
    expect(r.ok).toBe(false);
  });

  it('rejects demo profile in production', () => {
    const r = evaluateDemoGuard({
      targetEnvironment: 'production',
      ueFeatureProfile: undefined,
      publicDemoProfile: 'demo',
      nodeEnv: 'production',
    });
    expect(r.ok).toBe(false);
    expect(r.demoProfileDetected).toBe('demo');
  });

  it('defaults to production when target is missing', () => {
    const r = evaluateDemoGuard({
      targetEnvironment: undefined,
      ueFeatureProfile: 'cupe4373',
      publicDemoProfile: undefined,
      nodeEnv: undefined,
    });
    expect(r.ok).toBe(false);
    expect(r.resolvedEnvironment).toBe('production');
  });

  it('passes cleanly when no demo profile is set anywhere', () => {
    const r = evaluateDemoGuard({
      targetEnvironment: 'production',
      ueFeatureProfile: undefined,
      publicDemoProfile: undefined,
      nodeEnv: 'production',
    });
    expect(r.ok).toBe(true);
    expect(r.demoProfileDetected).toBeNull();
  });

  it('ignores non-demo profile values', () => {
    const r = evaluateDemoGuard({
      targetEnvironment: 'production',
      ueFeatureProfile: 'default',
      publicDemoProfile: undefined,
      nodeEnv: 'production',
    });
    expect(r.ok).toBe(true);
    expect(r.demoProfileDetected).toBeNull();
  });
});

describe('assertDemoDeploymentGuard', () => {
  it('throws on unsafe env', () => {
    expect(() =>
      assertDemoDeploymentGuard({
        UE_TARGET_ENVIRONMENT: 'production',
        UE_FEATURE_PROFILE: 'cupe4373',
      } as NodeJS.ProcessEnv),
    ).toThrow(/demo-deployment-guard/);
  });

  it('is a no-op on safe env', () => {
    expect(() =>
      assertDemoDeploymentGuard({
        UE_TARGET_ENVIRONMENT: 'development',
        UE_FEATURE_PROFILE: 'cupe4373',
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });
});
