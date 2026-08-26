import { describe, expect, it } from 'vitest';

import {
  canAccessDashboardPath,
  getAllowedPrefixesByExperience,
  getDashboardExperience,
  getNavigationForExperience,
  getRoleLandingPath,
} from '../role-experience';

describe('lib/dashboard/role-experience', () => {
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

  describe('getRoleLandingPath', () => {
    it('routes by experience', () => {
      expect(getRoleLandingPath('member')).toBe('/dashboard/workspace');
      expect(getRoleLandingPath('steward')).toBe('/dashboard/workbench');
      expect(getRoleLandingPath('president')).toBe('/dashboard/intelligence');
      expect(getRoleLandingPath('officer')).toBe('/dashboard/governance');
      expect(getRoleLandingPath('system_admin')).toBe('/dashboard/admin/organizations');
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
