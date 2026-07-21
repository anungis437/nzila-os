import { describe, expect, it } from 'vitest';
import { evaluateDemoGuard, assertDemoDeploymentGuard } from '../demo-deployment-guard';

describe('lib/reality/demo-deployment-guard (runtime)', () => {
  it('allows non-demo profile in production', () => {
    const v = evaluateDemoGuard({ targetEnvironment: 'production' });
    expect(v.ok).toBe(true);
    expect(v.demoProfileDetected).toBe(false);
  });

  it('allows demo profile in development', () => {
    const v = evaluateDemoGuard({
      targetEnvironment: 'development',
      ueFeatureProfile: 'cupe4373',
    });
    expect(v.ok).toBe(true);
    expect(v.demoProfileDetected).toBe(true);
  });

  it('rejects demo profile in staging', () => {
    const v = evaluateDemoGuard({
      targetEnvironment: 'staging',
      ueFeatureProfile: 'cupe4373',
    });
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/cupe4373/);
  });

  it('rejects demo via NEXT_PUBLIC var in pilot', () => {
    const v = evaluateDemoGuard({
      targetEnvironment: 'pilot',
      publicDemoProfile: 'cupe4373',
    });
    expect(v.ok).toBe(false);
  });

  it('fail-closed when target env missing (treats as production)', () => {
    const v = evaluateDemoGuard({ ueFeatureProfile: 'cupe4373' });
    expect(v.ok).toBe(false);
    expect(v.resolvedEnvironment).toBe('production');
  });

  it('assertDemoDeploymentGuard throws on unsafe env', () => {
    expect(() =>
      assertDemoDeploymentGuard({
        targetEnvironment: 'production',
        ueFeatureProfile: 'cupe4373',
      }),
    ).toThrow(/\[demo-deployment-guard\]/);
  });

  it('assertDemoDeploymentGuard does not throw when safe', () => {
    expect(() =>
      assertDemoDeploymentGuard({ targetEnvironment: 'production' }),
    ).not.toThrow();
  });
});
