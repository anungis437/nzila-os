import { describe, expect, it } from 'vitest';

import {
  canAccessDashboardPath,
  getAllowedPrefixesByExperience,
  getDashboardExperience,
  getNavigationForExperience,
  getRoleLandingPath,
  getVisibleNavigationForExperience,
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

  describe('getVisibleNavigationForExperience', () => {
    it('shows Operations Continuity for executives outside pilot mode', () => {
      const nav = getVisibleNavigationForExperience('executive', false);
      expect(nav.some((i) => i.href === '/dashboard/executive-operating-intelligence')).toBe(true);
    });

    it('hides Operations Continuity for executives in pilot mode', () => {
      const nav = getVisibleNavigationForExperience('executive', true);
      expect(nav.some((i) => i.href === '/dashboard/executive-operating-intelligence')).toBe(false);
    });

    it('does not over-filter the rest of the executive nav in pilot mode', () => {
      const fullNav = getNavigationForExperience('executive');
      const pilotNav = getVisibleNavigationForExperience('executive', true);
      // Only the pilot-excluded entry should be removed; every other entry
      // from the full SOT nav must still be present.
      const stillAllowedHrefs = fullNav
        .map((i) => i.href)
        .filter((href) => href !== '/dashboard/executive-operating-intelligence');
      for (const href of stillAllowedHrefs) {
        expect(pilotNav.some((i) => i.href === href)).toBe(true);
      }
      expect(pilotNav.length).toBe(fullNav.length - 1);
    });

    it('evaluates query-param routes against the correct pathname', () => {
      // /dashboard/intelligence?scope=executive is not itself pilot-excluded
      // (only /dashboard/executive-operating-intelligence is); it must remain
      // visible even though its href carries a query string.
      const nav = getVisibleNavigationForExperience('executive', true);
      expect(nav.some((i) => i.href === '/dashboard/intelligence?scope=executive')).toBe(true);
    });

    it('leaves member, staff, governance, and admin navigation unchanged outside pilot mode', () => {
      for (const experience of ['member', 'staff', 'governance', 'admin'] as const) {
        expect(getVisibleNavigationForExperience(experience, false)).toEqual(
          getNavigationForExperience(experience),
        );
      }
    });

    it('leaves member, staff, and governance navigation unchanged in pilot mode (none of their entries are pilot-excluded)', () => {
      for (const experience of ['member', 'staff', 'governance'] as const) {
        expect(getVisibleNavigationForExperience(experience, true)).toEqual(
          getNavigationForExperience(experience),
        );
      }
    });

    it('hides the admin Exports entry in pilot mode (it targets a pilot-excluded /dashboard/movement-insights prefix)', () => {
      const fullNav = getNavigationForExperience('admin');
      const pilotNav = getVisibleNavigationForExperience('admin', true);
      expect(fullNav.some((i) => i.href === '/dashboard/movement-insights/export')).toBe(true);
      expect(pilotNav.some((i) => i.href === '/dashboard/movement-insights/export')).toBe(false);
      expect(pilotNav.length).toBe(fullNav.length - 1);
    });
  });
});
