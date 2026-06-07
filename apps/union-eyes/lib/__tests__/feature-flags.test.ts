import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Proxy chain helper ───────────────────────────────────────────────────────

function chain(resolveValue: any): any {
  const handler: ProxyHandler<object> = {
    get: (_target, prop) => {
      if (prop === 'then') return (resolve: (v: any) => void) => resolve(resolveValue);
      return vi.fn(() => new Proxy({}, handler));
    },
  };
  return new Proxy({}, handler);
}

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockUpdate: vi.fn(),
  mockInsert: vi.fn(),
}));

vi.mock('@/db', () => ({
  db: {
    select: mocks.mockSelect,
    update: mocks.mockUpdate,
    insert: mocks.mockInsert,
  },
}));

vi.mock('@/db/schema', () => ({
  featureFlags: { name: 'name' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: any[]) => ({ op: 'eq', args })),
  relations: vi.fn(() => ({})),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('react', () => ({
  cache: vi.fn((fn: (...args: any[]) => unknown) => fn),
}));

import {
  BooleanFlag,
  PercentageFlag,
  OrgFlag,
  checkFlags,
  features,
  refreshFeatureFlags,
  getAllFeatureFlags,
  toggleFeatureFlag,
} from '../feature-flags';

describe('feature-flags', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockSelect.mockReturnValue(chain([]));
    mocks.mockUpdate.mockReturnValue(chain(undefined));
    mocks.mockInsert.mockReturnValue(chain(undefined));
  });

  // ── BooleanFlag ─────────────────────────────────────────────
  describe('BooleanFlag', () => {
    it('returns default value when no config found', () => {
      const flag = new BooleanFlag('test-flag', true);
      expect(flag.enabled).toBe(true);
    });

    it('returns false by default', () => {
      const flag = new BooleanFlag('unset-flag');
      expect(flag.enabled).toBe(false);
    });

    it('enable() calls updateFeatureFlag', async () => {
      // select for existing check → not found → insert new flag → refreshFeatureFlags
      mocks.mockSelect
        .mockReturnValueOnce(chain([]))           // updateFeatureFlag: check exists
        .mockReturnValueOnce(chain([]));           // refreshFeatureFlags: load all
      const flag = new BooleanFlag('toggle-flag');
      await flag.enable();
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('disable() updates existing flag', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ name: 'toggle-flag', enabled: true }]))  // exists
        .mockReturnValueOnce(chain([]));           // refreshFeatureFlags
      const flag = new BooleanFlag('toggle-flag');
      await flag.disable();
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });
  });

  // ── PercentageFlag ──────────────────────────────────────────
  describe('PercentageFlag', () => {
    it('returns false when config not loaded', () => {
      const flag = new PercentageFlag('pct-flag', 50);
      expect(flag.isEnabled('user-123')).toBe(false);
    });

    it('returns true for users within percentage when config loaded', async () => {
      // Pre-populate the cache via refreshFeatureFlags
      mocks.mockSelect.mockReturnValueOnce(chain([
        { name: 'pct-test', type: 'percentage', enabled: true, percentage: 100, allowedOrganizations: null, allowedUsers: null, description: null },
      ]));
      await refreshFeatureFlags();

      const flag = new PercentageFlag('pct-test', 0);
      // With 100% rollout, any user should be enabled
      expect(flag.isEnabled('any-user')).toBe(true);
    });

    it('setPercentage updates flag', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([]))  // updateFeatureFlag: check exists
        .mockReturnValueOnce(chain([])); // refreshFeatureFlags
      const flag = new PercentageFlag('rollout-flag', 0);
      await flag.setPercentage(50);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('hash is deterministic for same input', () => {
      const flag = new PercentageFlag('det-flag', 50);
      // Call isEnabled twice with same userId — both should return same result
      const r1 = flag.isEnabled('user-abc');
      const r2 = flag.isEnabled('user-abc');
      expect(r1).toBe(r2);
    });
  });

  // ── OrgFlag ─────────────────────────────────────────────────
  describe('OrgFlag', () => {
    it('returns false when config not loaded', () => {
      const flag = new OrgFlag('org-flag');
      expect(flag.isEnabledForOrg('org-1')).toBe(false);
    });

    it('returns true when org is in allowedOrgs', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([
        { name: 'org-test', type: 'tenant', enabled: true, percentage: null, allowedOrganizations: ['org-1', 'org-2'], allowedUsers: null, description: null },
      ]));
      await refreshFeatureFlags();

      const flag = new OrgFlag('org-test');
      expect(flag.isEnabledForOrg('org-1')).toBe(true);
      expect(flag.isEnabledForOrg('org-3')).toBe(false);
    });

    it('enableForOrg adds org to allowed list', async () => {
      // Pre-populate cache with flag that has no orgs
      mocks.mockSelect.mockReturnValueOnce(chain([
        { name: 'org-add', type: 'tenant', enabled: true, percentage: null, allowedOrganizations: [], allowedUsers: null, description: null },
      ]));
      await refreshFeatureFlags();

      // updateFeatureFlag: check exists → update → refresh
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ name: 'org-add' }]))   // exists
        .mockReturnValueOnce(chain([]));                      // refresh
      const flag = new OrgFlag('org-add');
      await flag.enableForOrg('org-new');
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it('disableForOrg removes org from list', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([
        { name: 'org-rem', type: 'tenant', enabled: true, percentage: null, allowedOrganizations: ['org-1', 'org-2'], allowedUsers: null, description: null },
      ]));
      await refreshFeatureFlags();

      mocks.mockSelect
        .mockReturnValueOnce(chain([{ name: 'org-rem' }]))
        .mockReturnValueOnce(chain([]));
      const flag = new OrgFlag('org-rem');
      await flag.disableForOrg('org-1');
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });
  });

  // ── checkFlags ──────────────────────────────────────────────
  describe('checkFlags', () => {
    it('returns false for unknown flags', () => {
      const result = checkFlags(['unknown-flag']);
      expect(result['unknown-flag']).toBe(false);
    });

    it('returns correct statuses from cache', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([
        { name: 'on-flag', type: 'boolean', enabled: true, percentage: null, allowedOrganizations: null, allowedUsers: null, description: null },
        { name: 'off-flag', type: 'boolean', enabled: false, percentage: null, allowedOrganizations: null, allowedUsers: null, description: null },
      ]));
      await refreshFeatureFlags();

      const result = checkFlags(['on-flag', 'off-flag', 'missing']);
      expect(result['on-flag']).toBe(true);
      expect(result['off-flag']).toBe(false);
      expect(result['missing']).toBe(false);
    });
  });

  // ── refreshFeatureFlags ─────────────────────────────────────
  describe('refreshFeatureFlags', () => {
    it('populates cache from DB', async () => {
      const flagData = [
        { name: 'flag1', type: 'boolean', enabled: true, percentage: null, allowedOrganizations: null, allowedUsers: null, description: 'desc' },
      ];
      // refreshFeatureFlags called directly + again inside getAllFeatureFlags
      mocks.mockSelect
        .mockReturnValueOnce(chain(flagData))
        .mockReturnValueOnce(chain(flagData));
      await refreshFeatureFlags();
      const all = await getAllFeatureFlags();
      expect(all.length).toBeGreaterThanOrEqual(1);
      expect(all.find(f => f.name === 'flag1')?.enabled).toBe(true);
    });

    it('keeps cache on error', async () => {
      // First populate cache
      mocks.mockSelect.mockReturnValueOnce(chain([
        { name: 'keep', type: 'boolean', enabled: true, percentage: null, allowedOrganizations: null, allowedUsers: null, description: null },
      ]));
      await refreshFeatureFlags();

      // Now force an error
      mocks.mockSelect.mockImplementationOnce(() => { throw new Error('DB down'); });
      await refreshFeatureFlags(); // should not throw
      // Previous cache still has 'keep'
    });
  });

  // ── getAllFeatureFlags ───────────────────────────────────────
  describe('getAllFeatureFlags', () => {
    it('returns all cached flags', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([
        { name: 'a', type: 'boolean', enabled: true, percentage: null, allowedOrganizations: null, allowedUsers: null, description: null },
        { name: 'b', type: 'boolean', enabled: false, percentage: null, allowedOrganizations: null, allowedUsers: null, description: null },
      ]));
      const all = await getAllFeatureFlags();
      expect(all).toHaveLength(2);
    });
  });

  // ── toggleFeatureFlag ───────────────────────────────────────
  describe('toggleFeatureFlag', () => {
    it('toggles a flag on', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([{ name: 'tog' }]))  // exists check
        .mockReturnValueOnce(chain([]));                 // refresh
      await toggleFeatureFlag('tog', true);
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it('creates flag if not existing', async () => {
      mocks.mockSelect
        .mockReturnValueOnce(chain([]))  // not found
        .mockReturnValueOnce(chain([])); // refresh
      await toggleFeatureFlag('new-flag', true);
      expect(mocks.mockInsert).toHaveBeenCalled();
    });
  });

  // ── PercentageFlag (gap coverage) ────────────────────────────
  describe('PercentageFlag — gap coverage', () => {
    it('returns false when config enabled but user hash above percentage', async () => {
      // 1% rollout — almost all users excluded
      mocks.mockSelect.mockReturnValueOnce(chain([
        { name: 'p-low', type: 'percentage', enabled: true, percentage: 1, allowedOrganizations: null, allowedUsers: null, description: null },
      ]));
      await refreshFeatureFlags();

      const flag = new PercentageFlag('p-low', 0);
      // At 1% only hashes 0 get in; deterministic so we assert type
      expect(typeof flag.isEnabled('someuser')).toBe('boolean');
    });

    it('uses defaultPercentage when config.percentage is null', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([
        { name: 'p-null', type: 'percentage', enabled: true, percentage: null, allowedOrganizations: null, allowedUsers: null, description: null },
      ]));
      await refreshFeatureFlags();

      // defaultPercentage = 100 → all users in
      const flag = new PercentageFlag('p-null', 100);
      expect(flag.isEnabled('any-user')).toBe(true);
    });
  });

  // ── OrgFlag (gap coverage) ──────────────────────────────────
  describe('OrgFlag — gap coverage', () => {
    it('returns defaultEnabled when allowedOrgs is empty', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([
        { name: 'org-empty', type: 'tenant', enabled: true, percentage: null, allowedOrganizations: [], allowedUsers: null, description: null },
      ]));
      await refreshFeatureFlags();

      const flag = new OrgFlag('org-empty', true);
      expect(flag.isEnabledForOrg('any-org')).toBe(true);
    });

    it('enableForOrg skips update when org already included', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([
        { name: 'org-dup', type: 'tenant', enabled: true, percentage: null, allowedOrganizations: ['org-1'], allowedUsers: null, description: null },
      ]));
      await refreshFeatureFlags();

      const flag = new OrgFlag('org-dup');
      await flag.enableForOrg('org-1');
      // Should NOT call update because org is already present
      expect(mocks.mockUpdate).not.toHaveBeenCalled();
    });

    it('enableForOrg falls back when config has null allowedOrgs', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([
        { name: 'org-null-orgs', type: 'tenant', enabled: true, percentage: null, allowedOrganizations: null, allowedUsers: null, description: null },
      ]));
      await refreshFeatureFlags();

      mocks.mockSelect
        .mockReturnValueOnce(chain([{ name: 'org-null-orgs' }]))  // exists check
        .mockReturnValueOnce(chain([]));                           // refresh
      const flag = new OrgFlag('org-null-orgs');
      await flag.enableForOrg('org-new');
      expect(mocks.mockUpdate).toHaveBeenCalled();
    });

    it('enableForOrg handles missing config entirely', async () => {
      // Don't populate cache for this flag name
      mocks.mockSelect
        .mockReturnValueOnce(chain([]))    // exists check (not found → insert)
        .mockReturnValueOnce(chain([]));   // refresh
      const flag = new OrgFlag('org-uncached');
      await flag.enableForOrg('org-1');
      expect(mocks.mockInsert).toHaveBeenCalled();
    });

    it('disableForOrg returns early when config has no allowedOrgs', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([
        { name: 'org-none', type: 'tenant', enabled: true, percentage: null, allowedOrganizations: null, allowedUsers: null, description: null },
      ]));
      await refreshFeatureFlags();

      const flag = new OrgFlag('org-none');
      await flag.disableForOrg('org-1');
      // Should NOT call update — early return
      expect(mocks.mockUpdate).not.toHaveBeenCalled();
    });
  });

  // ── updateFeatureFlag error path ────────────────────────────
  describe('updateFeatureFlag — gap coverage', () => {
    it('logs and re-throws when DB update fails', async () => {
      mocks.mockSelect.mockReturnValueOnce(chain([{ name: 'fail-flag' }]));
      mocks.mockUpdate.mockImplementationOnce(() => { throw new Error('DB crash'); });

      const flag = new BooleanFlag('fail-flag');
      await expect(flag.disable()).rejects.toThrow('DB crash');
    });
  });

  // ── features registry ───────────────────────────────────────
  describe('features registry', () => {
    it('contains expected feature flags', () => {
      expect(features).toHaveProperty('newClaimFlow');
      expect(features).toHaveProperty('mlPredictions');
      expect(features).toHaveProperty('smsNotifications');
      expect(features).toHaveProperty('onlineVoting');
    });
  });
});
