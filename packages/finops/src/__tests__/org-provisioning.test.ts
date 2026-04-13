/**
 * Org Provisioning — Test Suite
 */

import { describe, it, expect, vi } from 'vitest';
import {
  provisionOrg,
  deprovisionOrg,
  type ProvisioningExecutor,
  type OrgProvisionRequest,
} from '../org-provisioning.js';

const noopExecutor: ProvisioningExecutor = {
  execute: async () => {},
};

describe('Org Provisioning', () => {
  it('provisions a free-tier org', async () => {
    const result = await provisionOrg(
      {
        orgId: 'org_test_free',
        orgName: 'Test Free Org',
        tier: 'free',
        adminEmail: 'admin@test.com',
      },
      noopExecutor,
    );

    expect(result.status).toBe('success');
    expect(result.config.tier).toBe('free');
    expect(result.config.quotas.maxUsers).toBe(5);
    expect(result.config.quotas.maxAiRequestsPerDay).toBe(100);
    expect(result.config.database.rlsEnabled).toBe(true);
    expect(result.steps.every((s) => s.status === 'completed')).toBe(true);
  });

  it('provisions an enterprise-tier org with expanded quotas', async () => {
    const result = await provisionOrg(
      {
        orgId: 'org_test_enterprise',
        orgName: 'Test Enterprise Org',
        tier: 'enterprise',
        adminEmail: 'admin@enterprise.com',
        features: ['advanced-ai', 'sso', 'dedicated-support'],
      },
      noopExecutor,
    );

    expect(result.status).toBe('success');
    expect(result.config.tier).toBe('enterprise');
    expect(result.config.quotas.maxUsers).toBe(-1); // unlimited
    expect(result.config.quotas.maxAiRequestsPerDay).toBe(1_000_000);
    expect(result.config.security.mfaRequired).toBe(true);
    expect(result.config.features).toContain('sso');
  });

  it('handles partial failure gracefully', async () => {
    const failingExecutor: ProvisioningExecutor = {
      execute: async (step) => {
        if (step === 'provision-database') throw new Error('DB connection refused');
      },
    };

    const result = await provisionOrg(
      {
        orgId: 'org_partial',
        orgName: 'Partial Org',
        tier: 'starter',
        adminEmail: 'admin@partial.com',
      },
      failingExecutor,
    );

    expect(result.status).toBe('partial');
    const dbStep = result.steps.find((s) => s.name === 'provision-database');
    expect(dbStep!.status).toBe('failed');
    expect(dbStep!.error).toContain('DB connection refused');
  });

  it('rejects invalid orgId', async () => {
    await expect(
      provisionOrg(
        { orgId: '', orgName: 'Bad', tier: 'free', adminEmail: 'a@b.com' } as OrgProvisionRequest,
        noopExecutor,
      ),
    ).rejects.toThrow();
  });

  it('records provisioning duration', async () => {
    const result = await provisionOrg(
      {
        orgId: 'org_timed',
        orgName: 'Timed Org',
        tier: 'professional',
        adminEmail: 'admin@timed.com',
      },
      noopExecutor,
    );

    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});

describe('Org Deprovisioning', () => {
  it('deprovisions an org with data retention', async () => {
    const result = await deprovisionOrg('org_remove', 'Subscription cancelled', noopExecutor);

    expect(result.status).toBe('success');
    expect(result.dataRetentionDays).toBe(90);
    expect(result.steps.every((s) => s.status === 'completed')).toBe(true);
  });

  it('rejects empty orgId', async () => {
    await expect(deprovisionOrg('', 'test')).rejects.toThrow('orgId is required');
  });

  it('handles step failure during deprovisioning', async () => {
    const failingExecutor: ProvisioningExecutor = {
      execute: async (step) => {
        if (step === 'export-data') throw new Error('Storage unavailable');
      },
    };

    const result = await deprovisionOrg('org_deprov_fail', 'Cancelled', failingExecutor);
    expect(result.status).toBe('failed');
    const failedStep = result.steps.find((s) => s.name === 'export-data');
    expect(failedStep!.status).toBe('failed');
    expect(failedStep!.error).toContain('Storage unavailable');
  });

  it('handles non-Error thrown during deprovisioning', async () => {
    const failingExecutor: ProvisioningExecutor = {
      execute: async (step) => {
        if (step === 'disable-access') throw 'string error';
      },
    };

    const result = await deprovisionOrg('org_deprov_str', 'Test', failingExecutor);
    expect(result.status).toBe('failed');
    const failedStep = result.steps.find((s) => s.name === 'disable-access');
    expect(failedStep!.error).toBe('string error');
  });

  it('uses default executor when none is provided', async () => {
    const result = await deprovisionOrg('org_default', 'Dry run');
    expect(result.status).toBe('success');
    expect(result.steps.every((s) => s.status === 'completed')).toBe(true);
  });
});

describe('Org Provisioning — additional branches', () => {
  it('returns failed when all provisioning steps fail', async () => {
    const allFailExecutor: ProvisioningExecutor = {
      execute: async () => {
        throw new Error('everything broken');
      },
    };

    const result = await provisionOrg(
      { orgId: 'org_all_fail', orgName: 'Fail All', tier: 'free', adminEmail: 'a@b.com' },
      allFailExecutor,
    );

    expect(result.status).toBe('failed');
    expect(result.steps.every((s) => s.status === 'failed')).toBe(true);
  });

  it('handles non-Error thrown during provisioning', async () => {
    const executor: ProvisioningExecutor = {
      execute: async (step) => {
        if (step === 'setup-quotas') throw 42;
      },
    };

    const result = await provisionOrg(
      { orgId: 'org_non_error', orgName: 'Non-Error', tier: 'free', adminEmail: 'a@b.com' },
      executor,
    );

    expect(result.status).toBe('partial');
    const quotaStep = result.steps.find((s) => s.name === 'setup-quotas');
    expect(quotaStep!.error).toBe('42');
  });
});
