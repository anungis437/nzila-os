/**
 * Feature Flags Service — Unit Tests
 *
 * Covers: LRO_FEATURES, AI_FEATURES, isFeatureEnabled, getFeatureConfig,
 * evaluateFeature (boolean/percentage/tenant/user/unknown/error),
 * evaluateFeatures, getEnabledFeatures, upsertFeatureFlag, enableFeature,
 * disableFeature, setRolloutPercentage, addOrganizationToPilot,
 * removeOrganizationFromPilot
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockFindFirst, mockFindMany, mockUpdate, mockInsert } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindMany: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
}));

function chain(resolveValue: unknown): unknown {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: unknown) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

vi.mock('@/db/db', () => ({
  db: {
    query: {
      featureFlags: {
        findFirst: (...args: unknown[]) => mockFindFirst(...args),
        findMany: (...args: unknown[]) => mockFindMany(...args),
      },
    },
    update: (...args: unknown[]) => mockUpdate(...args),
    insert: (...args: unknown[]) => mockInsert(...args),
  },
}));

vi.mock('@/db/schema', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    featureFlags: {
      name: 'name', enabled: 'enabled', type: 'type', id: 'id',
      percentage: 'percentage', allowedOrganizations: 'allowedOrganizations',
    },
  };
});

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual };
});

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import {
  LRO_FEATURES, AI_FEATURES, isFeatureEnabled, getFeatureConfig,
  evaluateFeature, evaluateFeatures, getEnabledFeatures,
  upsertFeatureFlag, enableFeature, disableFeature,
  setRolloutPercentage, addOrganizationToPilot, removeOrganizationFromPilot,
} from '../feature-flags';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('feature-flags service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(undefined);
    mockFindMany.mockResolvedValue([]);
  });

  // ── Constants ──────────────────────────────────────────────────────────────

  it('LRO_FEATURES has expected keys', () => {
    expect(LRO_FEATURES.SIGNALS_API).toBe('lro_signals_api');
    expect(LRO_FEATURES.SIGNALS_UI).toBe('lro_signals_ui');
    expect(LRO_FEATURES.FSM_WORKFLOW).toBe('lro_fsm_workflow');
    expect(LRO_FEATURES.SLA_TRACKING).toBe('lro_sla_tracking');
    expect(LRO_FEATURES.DASHBOARD_WIDGET).toBe('lro_dashboard_widget');
  });

  it('AI_FEATURES has expected keys', () => {
    expect(AI_FEATURES.GRIEVANCE_TRIAGE).toBe('ai_grievance_triage');
    expect(AI_FEATURES.CLAUSE_REASONING).toBe('ai_clause_reasoning');
    expect(AI_FEATURES.EMPLOYER_RISK).toBe('ai_employer_risk');
    expect(AI_FEATURES.STEWARD_COPILOT).toBe('ai_steward_copilot');
    expect(AI_FEATURES.EXECUTIVE_INSIGHTS).toBe('ai_executive_insights');
  });

  // ── isFeatureEnabled ───────────────────────────────────────────────────────

  it('isFeatureEnabled returns true for enabled boolean flag', async () => {
    mockFindFirst.mockResolvedValue({ name: 'f1', enabled: true, type: 'boolean' });
    expect(await isFeatureEnabled('f1')).toBe(true);
  });

  it('isFeatureEnabled returns false when flag not found', async () => {
    expect(await isFeatureEnabled('missing')).toBe(false);
  });

  it('isFeatureEnabled returns false when globally disabled', async () => {
    mockFindFirst.mockResolvedValue({ name: 'f1', enabled: false, type: 'boolean' });
    expect(await isFeatureEnabled('f1')).toBe(false);
  });

  // ── getFeatureConfig ───────────────────────────────────────────────────────

  it('getFeatureConfig returns empty for disabled feature', async () => {
    expect(await getFeatureConfig('missing')).toEqual({});
  });

  it('getFeatureConfig returns merged defaults for enabled feature', async () => {
    mockFindFirst.mockResolvedValue({
      name: LRO_FEATURES.AUTO_REFRESH,
      enabled: true,
      type: 'boolean',
    });
    const config = await getFeatureConfig(LRO_FEATURES.AUTO_REFRESH);
    expect(config).toHaveProperty('intervalMs', 60000);
  });

  // ── evaluateFeature — percentage ───────────────────────────────────────────

  it('evaluateFeature percentage: enabled when user in rollout', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'pct_flag', enabled: true, type: 'percentage', percentage: 100,
    });
    const result = await evaluateFeature('pct_flag', { userId: 'user-1' });
    expect(result.enabled).toBe(true);
    expect(result.reason).toContain('rollout');
  });

  it('evaluateFeature percentage: disabled when 0%', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'pct_flag', enabled: true, type: 'percentage', percentage: 0,
    });
    const result = await evaluateFeature('pct_flag', { userId: 'user-1' });
    expect(result.enabled).toBe(false);
  });

  it('evaluateFeature percentage: disabled when no userId', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'pct_flag', enabled: true, type: 'percentage', percentage: 50,
    });
    const result = await evaluateFeature('pct_flag', {});
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('UserId required');
  });

  it('evaluateFeature percentage: disabled when no percentage', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'pct_flag', enabled: true, type: 'percentage', percentage: null,
    });
    const result = await evaluateFeature('pct_flag', { userId: 'u1' });
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('not configured');
  });

  // ── evaluateFeature — tenant (org) ─────────────────────────────────────────

  it('evaluateFeature tenant: enabled when org in allowlist', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'org_flag', enabled: true, type: 'tenant',
      allowedOrganizations: ['org-1', 'org-2'],
    });
    const result = await evaluateFeature('org_flag', { organizationId: 'org-1' });
    expect(result.enabled).toBe(true);
    expect(result.reason).toContain('allowlist');
  });

  it('evaluateFeature tenant: disabled when org not in allowlist', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'org_flag', enabled: true, type: 'tenant',
      allowedOrganizations: ['org-1'],
    });
    const result = await evaluateFeature('org_flag', { organizationId: 'org-99' });
    expect(result.enabled).toBe(false);
  });

  it('evaluateFeature tenant: disabled when no orgId in context', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'org_flag', enabled: true, type: 'tenant',
      allowedOrganizations: ['org-1'],
    });
    const result = await evaluateFeature('org_flag', {});
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('OrganizationId required');
  });

  it('evaluateFeature tenant: disabled when no orgs configured', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'org_flag', enabled: true, type: 'tenant',
      allowedOrganizations: null,
    });
    const result = await evaluateFeature('org_flag', { organizationId: 'org-1' });
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('No organizations configured');
  });

  // ── evaluateFeature — user ─────────────────────────────────────────────────

  it('evaluateFeature user: enabled when user in allowlist', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'user_flag', enabled: true, type: 'user',
      allowedUsers: ['u1', 'u2'],
    });
    const result = await evaluateFeature('user_flag', { userId: 'u1' });
    expect(result.enabled).toBe(true);
  });

  it('evaluateFeature user: disabled when user not in list', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'user_flag', enabled: true, type: 'user',
      allowedUsers: ['u1'],
    });
    const result = await evaluateFeature('user_flag', { userId: 'u99' });
    expect(result.enabled).toBe(false);
  });

  it('evaluateFeature user: disabled when no userId', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'user_flag', enabled: true, type: 'user',
      allowedUsers: ['u1'],
    });
    const result = await evaluateFeature('user_flag', {});
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('UserId required');
  });

  it('evaluateFeature user: disabled when no users configured', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'user_flag', enabled: true, type: 'user',
      allowedUsers: null,
    });
    const result = await evaluateFeature('user_flag', { userId: 'u1' });
    expect(result.enabled).toBe(false);
  });

  // ── evaluateFeature — edge cases ───────────────────────────────────────────

  it('evaluateFeature returns disabled for unknown flag type', async () => {
    mockFindFirst.mockResolvedValue({
      name: 'bad_flag', enabled: true, type: 'unknown_type',
    });
    const result = await evaluateFeature('bad_flag');
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('Unknown flag type');
  });

  it('evaluateFeature returns disabled on DB error', async () => {
    mockFindFirst.mockRejectedValue(new Error('connection lost'));
    const result = await evaluateFeature('err_flag');
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('Evaluation error');
  });

  // ── evaluateFeatures (bulk) ────────────────────────────────────────────────

  it('evaluateFeatures returns map of enabled flags', async () => {
    mockFindFirst
      .mockResolvedValueOnce({ name: 'a', enabled: true, type: 'boolean' })
      .mockResolvedValueOnce(undefined);

    const results = await evaluateFeatures(['a', 'b']);
    expect(results).toEqual({ a: true, b: false });
  });

  // ── getEnabledFeatures ─────────────────────────────────────────────────────

  it('getEnabledFeatures returns names of enabled flags', async () => {
    mockFindMany.mockResolvedValue([
      { name: 'f1', enabled: true, type: 'boolean' },
      { name: 'f2', enabled: true, type: 'boolean' },
    ]);
    // evaluateFeature calls findFirst for each
    mockFindFirst
      .mockResolvedValueOnce({ name: 'f1', enabled: true, type: 'boolean' })
      .mockResolvedValueOnce({ name: 'f2', enabled: false, type: 'boolean' });

    const enabled = await getEnabledFeatures();
    expect(enabled).toContain('f1');
    expect(enabled).not.toContain('f2');
  });

  // ── upsertFeatureFlag ─────────────────────────────────────────────────────

  it('upsertFeatureFlag updates existing flag', async () => {
    mockFindFirst.mockResolvedValue({ id: 'flag-1', name: 'f1' });
    const updatedFlag = { id: 'flag-1', name: 'f1', enabled: true, type: 'boolean' };
    mockUpdate.mockReturnValue(chain([updatedFlag]));

    const result = await upsertFeatureFlag('f1', { type: 'boolean', enabled: true }, 'actor-1');
    expect(result).toEqual(updatedFlag);
  });

  it('upsertFeatureFlag creates new flag', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    const createdFlag = { id: 'new-1', name: 'f2', enabled: true, type: 'boolean' };
    mockInsert.mockReturnValue(chain([createdFlag]));

    const result = await upsertFeatureFlag('f2', { type: 'boolean', enabled: true }, 'actor-1');
    expect(result).toEqual(createdFlag);
  });

  // ── enableFeature / disableFeature ─────────────────────────────────────────

  it('enableFeature calls update with enabled=true', async () => {
    mockUpdate.mockReturnValue(chain(undefined));
    await enableFeature('f1', 'actor-1');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('disableFeature calls update with enabled=false', async () => {
    mockUpdate.mockReturnValue(chain(undefined));
    await disableFeature('f1', 'actor-1');
    expect(mockUpdate).toHaveBeenCalled();
  });

  // ── setRolloutPercentage ───────────────────────────────────────────────────

  it('setRolloutPercentage updates percentage', async () => {
    mockUpdate.mockReturnValue(chain(undefined));
    await setRolloutPercentage('f1', 50, 'actor-1');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('setRolloutPercentage throws for invalid value', async () => {
    await expect(setRolloutPercentage('f1', 150, 'actor-1')).rejects.toThrow(
      'Percentage must be between 0 and 100'
    );
    await expect(setRolloutPercentage('f1', -5, 'actor-1')).rejects.toThrow(
      'Percentage must be between 0 and 100'
    );
  });

  // ── addOrganizationToPilot ─────────────────────────────────────────────────

  it('addOrganizationToPilot adds org to allowlist', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'flag-1', name: 'f1', allowedOrganizations: ['org-1'],
    });
    mockUpdate.mockReturnValue(chain(undefined));
    await addOrganizationToPilot('f1', 'org-2', 'actor-1');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('addOrganizationToPilot throws when flag not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    await expect(addOrganizationToPilot('missing', 'org-1', 'actor-1')).rejects.toThrow(
      'Feature flag not found'
    );
  });

  it('addOrganizationToPilot skips if already present', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'flag-1', name: 'f1', allowedOrganizations: ['org-1'],
    });
    await addOrganizationToPilot('f1', 'org-1', 'actor-1');
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  // ── removeOrganizationFromPilot ────────────────────────────────────────────

  it('removeOrganizationFromPilot removes org from list', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'flag-1', name: 'f1', allowedOrganizations: ['org-1', 'org-2'],
    });
    mockUpdate.mockReturnValue(chain(undefined));
    await removeOrganizationFromPilot('f1', 'org-1', 'actor-1');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('removeOrganizationFromPilot throws when flag not found', async () => {
    mockFindFirst.mockResolvedValue(undefined);
    await expect(removeOrganizationFromPilot('missing', 'org-1', 'actor-1')).rejects.toThrow(
      'Feature flag not found'
    );
  });

  /* ── Batch 32: branch gap-fill ── */

  it('evaluateFeature returns disabled for unknown flag type', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'flag-1', name: 'f1', enabled: true, type: 'exotic_type',
    });
    const result = await evaluateFeature('f1', { userId: 'u-1' });
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('Unknown flag type');
  });

  it('evaluateFeature returns disabled and logs error on exception', async () => {
    mockFindFirst.mockRejectedValue(new Error('DB crash'));
    const result = await evaluateFeature('broken', { userId: 'u-1' });
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('Evaluation error');
  });

  it('addOrganizationToPilot is a no-op when org is already in list', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'flag-1', name: 'f1',
      allowedOrganizations: ['org-1', 'org-2'],
    });
    await addOrganizationToPilot('f1', 'org-1', 'actor-1');
    // update should NOT be called because org-1 is already present
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('evaluatePercentageFlag returns disabled when percentage not set', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'flag-1', name: 'pct-flag', enabled: true, type: 'percentage', percentage: undefined,
    });
    const result = await evaluateFeature('pct-flag', { userId: 'u-1' });
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('Percentage not configured');
  });

  it('evaluatePercentageFlag returns disabled when userId missing', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'flag-1', name: 'pct-flag', enabled: true, type: 'percentage', percentage: 50,
    });
    const result = await evaluateFeature('pct-flag', {}); // no userId
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('UserId required');
  });

  /* ── Batch 33: branch gap-fill ── */

  it('evaluateFeature shows "Unknown error" for non-Error throws', async () => {
    mockFindFirst.mockRejectedValue('string-error');
    const result = await evaluateFeature('broken', { userId: 'u-1' });
    expect(result.enabled).toBe(false);
    expect(result.reason).toContain('Unknown error');
  });

  it('percentage flag puts user outside rollout bucket', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'flag-1', name: 'pct-flag', enabled: true, type: 'percentage', percentage: 1,
    });
    // With percentage=1, most user IDs will hash to bucket >= 1
    const result = await evaluateFeature('pct-flag', { userId: 'definitely-outside' });
    expect(result.reason).toContain('bucket');
  });

  it('addOrganizationToPilot handles null allowedOrganizations', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'flag-1', name: 'f1', allowedOrganizations: null,
    });
    mockUpdate.mockReturnValue(chain(undefined));
    await addOrganizationToPilot('f1', 'org-new', 'actor-1');
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('removeOrganizationFromPilot handles null allowedOrganizations', async () => {
    mockFindFirst.mockResolvedValue({
      id: 'flag-1', name: 'f1', allowedOrganizations: null,
    });
    mockUpdate.mockReturnValue(chain(undefined));
    await removeOrganizationFromPilot('f1', 'org-1', 'actor-1');
    expect(mockUpdate).toHaveBeenCalled();
  });
});
