import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  canAccessDashboardPath,
  getAllowedPrefixesByExperience,
  getCupe4373DemoGroups,
  getCupe4373DemoNavigation,
  getDashboardExperience,
  getNavigationForExperience,
  getRoleLandingPath,
  isCupe4373DemoRuntime,
} from '../role-experience';

const ENV_KEYS = [
  'NEXT_PUBLIC_UE_DEMO_PROFILE',
  'NEXT_PUBLIC_UE_FEATURE_PROFILE',
  'UE_FEATURE_PROFILE',
  'UE_DEPLOYMENT_TYPE',
] as const;

describe('lib/dashboard/role-experience', () => {
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

  describe('getDashboardExperience', () => {
    it('maps roles to experiences with member default', () => {
      expect(getDashboardExperience('system_admin')).toBe('admin');
      expect(getDashboardExperience('officer')).toBe('governance');
      expect(getDashboardExperience('president')).toBe('executive');
      expect(getDashboardExperience('steward')).toBe('staff');
      expect(getDashboardExperience(undefined)).toBe('member');
      expect(getDashboardExperience('unknown')).toBe('member');
    });
  });

  describe('isCupe4373DemoRuntime', () => {
    it('detects each demo marker', () => {
      expect(isCupe4373DemoRuntime()).toBe(false);
      process.env.NEXT_PUBLIC_UE_DEMO_PROFILE = 'cupe4373';
      expect(isCupe4373DemoRuntime()).toBe(true);
      delete process.env.NEXT_PUBLIC_UE_DEMO_PROFILE;
      process.env.UE_DEPLOYMENT_TYPE = 'cupe4373-demo';
      expect(isCupe4373DemoRuntime()).toBe(true);
    });
  });

  describe('getCupe4373DemoNavigation', () => {
    it('returns member nav for members and full nav otherwise', () => {
      expect(getCupe4373DemoNavigation('member').length).toBe(4);
      expect(getCupe4373DemoNavigation('steward').length).toBeGreaterThan(4);
    });
    it('exposes the demo groups', () => {
      expect(getCupe4373DemoGroups().map((g) => g.key)).toContain('daily');
    });
  });

  describe('getRoleLandingPath', () => {
    it('routes by experience', () => {
      expect(getRoleLandingPath('member')).toBe('/dashboard/inbox');
      expect(getRoleLandingPath('steward')).toBe('/dashboard/work');
      expect(getRoleLandingPath('president')).toBe('/dashboard/intelligence');
      expect(getRoleLandingPath('officer')).toBe('/dashboard/governance');
      expect(getRoleLandingPath('system_admin')).toBe('/dashboard/admin/organizations');
    });
    it('lands everyone on /dashboard in cupe4373 demo', () => {
      process.env.UE_DEPLOYMENT_TYPE = 'cupe4373-demo';
      expect(getRoleLandingPath('member')).toBe('/dashboard');
    });
  });

  describe('getNavigationForExperience', () => {
    it('returns role-specific nav', () => {
      expect(getNavigationForExperience('member').length).toBeGreaterThan(0);
      expect(getNavigationForExperience('staff').some((i) => i.group === 'Operations')).toBe(true);
      expect(getNavigationForExperience('executive').length).toBeGreaterThan(0);
      expect(getNavigationForExperience('governance').length).toBeGreaterThan(0);
      expect(getNavigationForExperience('admin').length).toBeGreaterThan(0);
    });
    it('returns demo nav in cupe4373 demo', () => {
      process.env.UE_DEPLOYMENT_TYPE = 'cupe4373-demo';
      expect(getNavigationForExperience('member').length).toBe(4);
      expect(getNavigationForExperience('staff').length).toBeGreaterThan(4);
    });
  });

  describe('canAccessDashboardPath', () => {
    it('exposes the prefix map', () => {
      expect(getAllowedPrefixesByExperience().member).toContain('/dashboard');
    });
    it('allows in-scope paths and blocks out-of-scope ones', () => {
      expect(canAccessDashboardPath('/dashboard', 'member', false)).toBe(true);
      expect(canAccessDashboardPath('/dashboard/inbox', 'member', false)).toBe(true);
      expect(canAccessDashboardPath('/dashboard/security', 'member', false)).toBe(false);
    });
    it('blocks excluded surfaces in pilot mode', () => {
      expect(canAccessDashboardPath('/dashboard/executive-operating-intelligence', 'executive', false)).toBe(true);
      expect(canAccessDashboardPath('/dashboard/executive-operating-intelligence', 'executive', true)).toBe(false);
    });
  });
});
