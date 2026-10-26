import { describe, expect, it } from 'vitest';

import { WORKSPACE_PERSONA_TAB_AVAILABILITY } from '@/components/workspace/workspace-persona-availability';
import {
  honestyForNavigationItem,
  roleHomeHubCue,
  ROLE_EXECUTION_CHROME_LABEL,
  ROLE_EXECUTION_DESTINATIONS_LABEL,
} from '../dual-nav-honesty';
import {
  getAllowedPrefixesByExperience,
  getDualNavHomes,
  getNavigationForExperience,
  getRoleLandingPath,
  ROLE_EXECUTION_HOME_BY_EXPERIENCE,
  WORKSPACE_ORIENTATION_HUB_PATH,
  type DashboardExperience,
} from '../role-experience';

describe('EC-G03 landing × experience', () => {
  it('keeps getRoleLandingPath targets and records which ones are not the hub', () => {
    const table: Array<{
      role: string;
      experience: DashboardExperience;
      roleHomeHref: string;
      roleHomeIsOrientationHub: boolean;
    }> = [
      {
        role: 'member',
        experience: 'member',
        roleHomeHref: '/dashboard',
        roleHomeIsOrientationHub: false,
      },
      {
        role: 'steward',
        experience: 'staff',
        roleHomeHref: '/dashboard/workbench',
        roleHomeIsOrientationHub: false,
      },
      {
        role: 'chief_steward',
        experience: 'staff',
        roleHomeHref: '/dashboard/workbench',
        roleHomeIsOrientationHub: false,
      },
      {
        role: 'president',
        experience: 'executive',
        roleHomeHref: '/dashboard/executive',
        roleHomeIsOrientationHub: false,
      },
      {
        role: 'officer',
        experience: 'executive',
        roleHomeHref: '/dashboard/executive',
        roleHomeIsOrientationHub: false,
      },
      {
        role: 'clc_executive',
        experience: 'governance',
        roleHomeHref: '/dashboard/governance',
        roleHomeIsOrientationHub: false,
      },
      {
        role: 'system_admin',
        experience: 'admin',
        roleHomeHref: '/dashboard/admin/organizations',
        roleHomeIsOrientationHub: false,
      },
    ];

    for (const row of table) {
      expect(getRoleLandingPath(row.role)).toBe(row.roleHomeHref);
      expect(getDualNavHomes(row.role)).toEqual({
        experience: row.experience,
        roleHomeHref: row.roleHomeHref,
        orientationHubHref: WORKSPACE_ORIENTATION_HUB_PATH,
        roleHomeIsOrientationHub: row.roleHomeIsOrientationHub,
      });
      expect(ROLE_EXECUTION_HOME_BY_EXPERIENCE[row.experience]).toBe(row.roleHomeHref);
    }

    expect(getRoleLandingPath(undefined)).toBe('/dashboard');
    expect(getRoleLandingPath('unknown')).toBe('/dashboard');
  });

  it('keeps Workspace first in the sidebar for governance and admin; members start at their own Home; staff and executives have no competing hub entry (frozen persona navigation)', () => {
    for (const experience of ['governance', 'admin'] as const) {
      expect(getNavigationForExperience(experience)[0]).toMatchObject({
        label: 'Workspace',
        href: WORKSPACE_ORIENTATION_HUB_PATH,
      });
    }
    expect(getNavigationForExperience('executive').some((i) => i.href === WORKSPACE_ORIENTATION_HUB_PATH)).toBe(false);
    // Representative 2.2 freezes seven destinations; Workspace stays reachable via the hub cue.
    expect(getNavigationForExperience('staff').some((item) => item.href === WORKSPACE_ORIENTATION_HUB_PATH)).toBe(false);
    expect(roleHomeHubCue(getDualNavHomes('steward')).show).toBe(true);

    const memberNav = getNavigationForExperience('member');
    expect(memberNav[0]).toMatchObject({ label: 'Home', href: '/dashboard' });
    expect(memberNav.map((item) => item.label)).not.toContain('Workspace');
    expect(ROLE_EXECUTION_HOME_BY_EXPERIENCE.member).toBe('/dashboard');
    expect(ROLE_EXECUTION_HOME_BY_EXPERIENCE.staff).not.toBe(WORKSPACE_ORIENTATION_HUB_PATH);
    expect(ROLE_EXECUTION_HOME_BY_EXPERIENCE.executive).not.toBe(WORKSPACE_ORIENTATION_HUB_PATH);
    expect(ROLE_EXECUTION_HOME_BY_EXPERIENCE.governance).not.toBe(WORKSPACE_ORIENTATION_HUB_PATH);
    expect(ROLE_EXECUTION_HOME_BY_EXPERIENCE.admin).not.toBe(WORKSPACE_ORIENTATION_HUB_PATH);
  });

  it('qualifies landmarks and points the role-home cue at the hub', () => {
    expect(ROLE_EXECUTION_CHROME_LABEL).not.toBe('Primary');
    expect(ROLE_EXECUTION_CHROME_LABEL).not.toBe('Primary navigation');
    expect(ROLE_EXECUTION_DESTINATIONS_LABEL).not.toBe('Primary');
    expect(ROLE_EXECUTION_CHROME_LABEL).not.toBe(ROLE_EXECUTION_DESTINATIONS_LABEL);

    const staff = honestyForNavigationItem(
      { label: 'Workspace', href: '/dashboard/workspace' },
      '/dashboard/workbench',
    );
    expect(staff).toMatchObject({
      navRole: 'hub',
      visibleQualifier: 'Orientation hub',
      accessibleName: 'Workspace, orientation hub',
    });

    const intelligenceHome = honestyForNavigationItem(
      { label: 'Institutional Intelligence Reports', href: '/dashboard/intelligence' },
      '/dashboard/intelligence',
    );
    expect(intelligenceHome.navRole).toBe('role-home');
    expect(intelligenceHome.visibleQualifier).toContain('Not a Workspace tab');

    const executiveOverview = honestyForNavigationItem(
      {
        label: 'OCRA Intelligence (Executive Overview)',
        href: '/dashboard/intelligence?scope=executive',
      },
      '/dashboard/intelligence',
    );
    expect(executiveOverview.navRole).toBe('legacy-side');
    expect(executiveOverview.visibleQualifier).toBe('Not a Workspace tab');

    // Staff still reach the hub; executives no longer advertise it because their allow-list rejects it.
    const staffCue = roleHomeHubCue(getDualNavHomes('steward'));
    expect(staffCue.show).toBe(true);
    expect(staffCue.hubHref).toBe(WORKSPACE_ORIENTATION_HUB_PATH);
    expect(roleHomeHubCue(getDualNavHomes('president')).show).toBe(false);
    expect(roleHomeHubCue(getDualNavHomes('president')).intelligenceNote).toBeNull();
    expect(roleHomeHubCue(getDualNavHomes('member')).show).toBe(false);
  });
});

describe('EC-G03 guards', () => {
  it('keeps the EC-003 WORKSPACE_PERSONA_TAB_AVAILABILITY cells unchanged', () => {
    // Same equality pattern as the #826 deep-work coherence guard.
    expect(WORKSPACE_PERSONA_TAB_AVAILABILITY).toEqual({
      executive: {
        overview: 'available',
        'case-operations': 'stub',
        members: 'stub',
        governance: 'available',
        continuity: 'available',
        financial: 'stub',
        documents: 'stub',
      },
      steward: {
        overview: 'available',
        'case-operations': 'available',
        members: 'available',
        governance: 'stub',
        continuity: 'available',
        financial: 'stub',
        documents: 'stub',
      },
      governance: {
        overview: 'available',
        'case-operations': 'stub',
        members: 'stub',
        governance: 'available',
        continuity: 'available',
        financial: 'stub',
        documents: 'stub',
      },
      onboarding: {
        overview: 'stub',
        'case-operations': 'stub',
        members: 'stub',
        governance: 'stub',
        continuity: 'stub',
        financial: 'stub',
        documents: 'stub',
      },
      procurement: {
        overview: 'stub',
        'case-operations': 'stub',
        members: 'stub',
        governance: 'stub',
        continuity: 'stub',
        financial: 'stub',
        documents: 'stub',
      },
      'degraded-runtime': {
        overview: 'stub',
        'case-operations': 'stub',
        members: 'stub',
        governance: 'stub',
        continuity: 'stub',
        financial: 'stub',
        documents: 'stub',
      },
    });
  });

  it('does not widen canAccessDashboardPath allow-lists', () => {
    expect(getAllowedPrefixesByExperience()).toEqual({
      // Widened only by the frozen UE-MEMBER-CANONICAL-2.1 destinations; each has a member page.
      member: [
        '/dashboard',
        '/dashboard/claims',
        '/dashboard/claims/new',
        '/dashboard/documents',
        '/dashboard/messages',
        '/dashboard/union',
        '/dashboard/help',
        '/dashboard/settings',
        '/dashboard/profile',
        '/dashboard/preferences',
        '/dashboard/privacy',
      ],
      staff: [
        '/dashboard',
        '/dashboard/workspace',
        '/dashboard/workbench',
        '/dashboard/priorities',
        '/dashboard/operations',
        '/dashboard/inbox',
        '/dashboard/intelligence',
        '/dashboard/members',
        '/dashboard/documents',
        '/dashboard/correspondence',
        '/dashboard/clause-library',
        '/dashboard/notifications',
        '/dashboard/messages/staff',
        '/dashboard/settings',
        '/dashboard/profile',
      ],
      executive: [
        '/dashboard',
        '/dashboard/executive',
        '/dashboard/leadership',
        '/dashboard/governance',
        '/dashboard/bargaining',
        '/dashboard/finance',
        '/dashboard/correspondence',
        '/dashboard/continuity-intelligence',
        '/dashboard/priorities',
        '/dashboard/committees',
        '/dashboard/intelligence',
        '/dashboard/executive-operating-intelligence',
        '/dashboard/governance-center',
        '/dashboard/outcomes',
        '/dashboard/trust',
        '/dashboard/settings',
        '/dashboard/profile',
      ],
      governance: [
        '/dashboard',
        '/dashboard/workspace',
        '/dashboard/governance',
        '/dashboard/trust',
        '/dashboard/workbench',
        '/dashboard/continuity-intelligence',
        '/dashboard/intelligence',
        '/dashboard/audits',
        '/dashboard/settings',
        '/dashboard/profile',
      ],
      admin: [
        '/dashboard',
        '/dashboard/workspace',
        '/dashboard/admin',
        '/dashboard/admin/organizations',
        '/dashboard/admin/members',
        '/dashboard/admin/onboarding',
        '/dashboard/governance',
        '/dashboard/audits',
        '/dashboard/security',
        '/dashboard/movement-insights/export',
        '/dashboard/integrations',
        '/dashboard/operations',
        '/dashboard/settings',
        '/dashboard/profile',
      ],
    });
  });
});
