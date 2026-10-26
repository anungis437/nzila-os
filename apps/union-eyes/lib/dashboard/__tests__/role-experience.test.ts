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
      expect(getDashboardExperience('officer')).toBe('executive');
      expect(getDashboardExperience('clc_executive')).toBe('governance');
      expect(getDashboardExperience('president')).toBe('executive');
      expect(getDashboardExperience('steward')).toBe('staff');
      expect(getDashboardExperience(undefined)).toBe('member');
      expect(getDashboardExperience('unknown')).toBe('member');
    });
  });

  describe('getRoleLandingPath', () => {
    it('routes by experience', () => {
      expect(getRoleLandingPath('member')).toBe('/dashboard');
      expect(getRoleLandingPath('steward')).toBe('/dashboard/workbench');
      expect(getRoleLandingPath('president')).toBe('/dashboard/executive');
      expect(getRoleLandingPath('officer')).toBe('/dashboard/executive');
      expect(getRoleLandingPath('clc_executive')).toBe('/dashboard/governance');
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
      expect(canAccessDashboardPath('/dashboard/inbox', 'member', false)).toBe(false);
      expect(canAccessDashboardPath('/dashboard/claims', 'member', false)).toBe(true);
      expect(canAccessDashboardPath('/dashboard/workspace', 'member', false)).toBe(false);
      expect(canAccessDashboardPath('/dashboard/security', 'member', false)).toBe(false);
    });
    it('blocks excluded surfaces in pilot mode', () => {
      expect(canAccessDashboardPath('/dashboard/executive-operating-intelligence', 'executive', false)).toBe(true);
      expect(canAccessDashboardPath('/dashboard/executive-operating-intelligence', 'executive', true)).toBe(false);
    });
  });

  describe('getVisibleNavigationForExperience', () => {
    it('does not advertise Operations Continuity (pilot-excluded) to executives in or out of pilot mode', () => {
      for (const pilot of [false, true]) {
        const nav = getVisibleNavigationForExperience('executive', pilot);
        expect(nav.some((i) => i.href === '/dashboard/executive-operating-intelligence')).toBe(false);
      }
    });

    it('does not over-filter the frozen executive navigation in pilot mode', () => {
      const fullNav = getNavigationForExperience('executive');
      const pilotNav = getVisibleNavigationForExperience('executive', true);
      expect(pilotNav).toEqual(fullNav);
    });

    it('leaves member and staff navigation unchanged outside pilot mode', () => {
      for (const experience of ['member', 'staff'] as const) {
        expect(getVisibleNavigationForExperience(experience, false)).toEqual(
          getNavigationForExperience(experience),
        );
      }
    });

    it('leaves member and staff navigation unchanged in pilot mode', () => {
      for (const experience of ['member', 'staff'] as const) {
        expect(getVisibleNavigationForExperience(experience, true)).toEqual(
          getNavigationForExperience(experience),
        );
      }
    });

    it('hides the admin Exports entry in pilot mode (it targets a pilot-excluded /dashboard/movement-insights prefix)', () => {
      const fullNav = getVisibleNavigationForExperience('admin', false, 'admin');
      const pilotNav = getVisibleNavigationForExperience('admin', true);
      expect(fullNav.some((i) => i.href === '/dashboard/movement-insights/export')).toBe(true);
      expect(pilotNav.some((i) => i.href === '/dashboard/movement-insights/export')).toBe(false);
      expect(pilotNav.length).toBe(fullNav.length - 1);
    });

    it('does not advertise platform operations to an ordinary organization admin', () => {
      const nav = getVisibleNavigationForExperience('admin', false, 'admin');
      for (const path of ['/dashboard/admin/members', '/dashboard/security', '/dashboard/integrations', '/dashboard/operations']) {
        expect(nav.some(item => item.href === path)).toBe(false);
      }
      expect(nav.some(item => item.href === '/dashboard/audits')).toBe(true);
      expect(getVisibleNavigationForExperience('admin', false, 'platform_lead')).toEqual(getNavigationForExperience('admin'));
    });

    it('keeps the administrator-only audit destination out of the officer menu', () => {
      expect(getVisibleNavigationForExperience('governance', false, 'officer').some(item => item.href === '/dashboard/audits')).toBe(false);
      expect(getVisibleNavigationForExperience('governance', false, 'national_officer').some(item => item.href === '/dashboard/audits')).toBe(true);
    });

    it('routes staff priorities to the priorities console and omits member support operations', () => {
      const priorities = getVisibleNavigationForExperience('staff', false, 'steward').find(item => item.label === 'Tasks & Deadlines');
      expect(priorities?.href).toBe('/dashboard/priorities');
      expect(canAccessDashboardPath(priorities!.href, 'staff', false)).toBe(true);
      expect(getVisibleNavigationForExperience('member', false, 'member').some(item => item.href === '/dashboard/support')).toBe(false);
    });

    it('offers exactly the seven Representative 2.2 destinations plus account settings to a steward', () => {
      const nav = getVisibleNavigationForExperience('staff', false, 'steward');
      expect(nav.filter(item => item.group !== 'Settings').map(item => item.label)).toEqual([
        'Today', 'Representation', 'Members & Workplaces', 'Communications',
        'Documents & Evidence', 'Tasks & Deadlines', 'Knowledge & Guidance',
      ]);
      expect(nav.filter(item => item.group === 'Settings').map(item => item.label)).toEqual(['Profile & Settings']);
      for (const item of nav) expect(canAccessDashboardPath(item.href.split('?')[0], 'staff', false)).toBe(true);
    });

    it('does not advertise the knowledge destination to staff roles below steward', () => {
      for (const role of ['bargaining_committee', 'health_safety_rep']) {
        expect(getVisibleNavigationForExperience('staff', false, role).some(item => item.href === '/dashboard/clause-library')).toBe(false);
      }
    });
  });
});
