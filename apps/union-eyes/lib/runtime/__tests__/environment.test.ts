import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  getDeploymentType,
  getEnvironmentSnapshot,
  getFeatureProfile,
  getNzilaMode,
  getUeEnvironment,
  isPilotRuntime,
  isProductionEnvironment,
} from '../environment';

const ENV_KEYS = [
  'UE_ENVIRONMENT',
  'NEXT_PUBLIC_APP_ENV',
  'NODE_ENV',
  'NZILA_MODE',
  'UE_DEPLOYMENT_TYPE',
  'UE_FEATURE_PROFILE',
] as const;

describe('lib/runtime/environment', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  describe('getUeEnvironment', () => {
    it('prefers UE_ENVIRONMENT', () => {
      process.env.UE_ENVIRONMENT = 'staging';
      expect(getUeEnvironment()).toBe('staging');
    });

    it('falls back to NEXT_PUBLIC_APP_ENV then NODE_ENV', () => {
      process.env.NEXT_PUBLIC_APP_ENV = 'demo';
      expect(getUeEnvironment()).toBe('demo');
      delete process.env.NEXT_PUBLIC_APP_ENV;
      process.env.NODE_ENV = 'production';
      expect(getUeEnvironment()).toBe('production');
      process.env.NODE_ENV = 'development';
      expect(getUeEnvironment()).toBe('local');
    });

    it('tolerates the malformed legacy multi-token form', () => {
      process.env.UE_ENVIRONMENT = 'production NEXT_PUBLIC_APP_ENV=staging';
      expect(getUeEnvironment()).toBe('production');
    });

    it('defaults to local', () => {
      expect(getUeEnvironment()).toBe('local');
    });
  });

  describe('getNzilaMode', () => {
    it('reads valid modes and rejects others', () => {
      process.env.NZILA_MODE = 'pilot';
      expect(getNzilaMode()).toBe('pilot');
      process.env.NZILA_MODE = 'bogus';
      expect(getNzilaMode()).toBeUndefined();
    });
  });

  describe('getDeploymentType', () => {
    it('reads explicit type', () => {
      process.env.UE_DEPLOYMENT_TYPE = 'clc-demo';
      expect(getDeploymentType()).toBe('clc-demo');
    });

    it('derives from environment', () => {
      process.env.UE_ENVIRONMENT = 'production';
      expect(getDeploymentType()).toBe('prod');
      process.env.UE_ENVIRONMENT = 'demo';
      expect(getDeploymentType()).toBe('cupe4373-demo');
      process.env.UE_ENVIRONMENT = 'pilot';
      expect(getDeploymentType()).toBe('pilot');
      process.env.UE_ENVIRONMENT = 'local';
      expect(getDeploymentType()).toBe('staging');
    });
  });

  describe('getFeatureProfile', () => {
    it('reads explicit profile', () => {
      process.env.UE_FEATURE_PROFILE = 'clc';
      expect(getFeatureProfile()).toBe('clc');
    });

    it('derives from environment', () => {
      process.env.UE_ENVIRONMENT = 'demo';
      expect(getFeatureProfile()).toBe('cupe4373');
      process.env.UE_ENVIRONMENT = 'production';
      expect(getFeatureProfile()).toBe('executive');
      process.env.UE_ENVIRONMENT = 'local';
      expect(getFeatureProfile()).toBe('internal');
    });
  });

  describe('runtime flags', () => {
    it('isPilotRuntime is fail-closed', () => {
      expect(isPilotRuntime()).toBe(false);
      process.env.NZILA_MODE = 'pilot';
      expect(isPilotRuntime()).toBe(true);
      process.env.NZILA_MODE = 'demo';
      expect(isPilotRuntime()).toBe(true);
    });

    it('isProductionEnvironment reflects environment', () => {
      process.env.UE_ENVIRONMENT = 'production';
      expect(isProductionEnvironment()).toBe(true);
      process.env.UE_ENVIRONMENT = 'staging';
      expect(isProductionEnvironment()).toBe(false);
    });
  });

  describe('getEnvironmentSnapshot', () => {
    it('aggregates all derived values', () => {
      process.env.UE_ENVIRONMENT = 'production';
      process.env.NZILA_MODE = 'production';
      const snap = getEnvironmentSnapshot();
      expect(snap).toEqual({
        environment: 'production',
        nzilaMode: 'production',
        deploymentType: 'prod',
        featureProfile: 'executive',
        isPilotRuntime: false,
        isProduction: true,
      });
    });
  });
});
