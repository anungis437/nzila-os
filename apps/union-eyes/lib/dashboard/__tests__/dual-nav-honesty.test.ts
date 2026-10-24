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
        roleHomeHref: '/dashboard/intelligence',
        roleHomeIsOrientationHub: false,
      },
      {
        role: 'officer',
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

  it('keeps Workspace first in the sidebar for non-member roles; members start at their own Home with no hub', () => {
    for (const experience of ['staff', 'executive', 'governance', 'admin'] as const) {
      expect(getNavigationForExperience(experience)[0]).toMatchObject({
        label: 'Workspace',
        href: WORKSPACE_ORIENTATION_HUB_PATH,
      });
    }

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

    const executiveHome = honestyForNavigationItem(
      { label: 'Institutional Intelligence Reports', href: '/dashboard/intelligence' },
      '/dashboard/intelligence',
    );
    expect(executiveHome.navRole).toBe('role-home');
    expect(executiveHome.visibleQualifier).toContain('Not a Workspace tab');

    const executiveOverview = honestyForNavigationItem(
      {
        label: 'OCRA Intelligence (Executive Overview)',
        href: '/dashboard/intelligence?scope=executive',
      },
      '/dashboard/intelligence',
    );
    expect(executiveOverview.navRole).toBe('legacy-side');
    expect(executiveOverview.visibleQualifier).toBe('Not a Workspace tab');

    const cue = roleHomeHubCue(getDualNavHomes('president'));
    expect(cue.show).toBe(true);
    expect(cue.hubHref).toBe(WORKSPACE_ORIENTATION_HUB_PATH);
    expect(cue.hubHref).not.toBe(getRoleLandingPath('president'));
    expect(cue.intelligenceNote).toMatch(/not a Workspace tab/i);
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
        '/dashboard/notifications',
        '/dashboard/settings',
        '/dashboard/profile',
      ],
      executive: [
        '/dashboard',
        '/dashboard/workspace',
        '/dashboard/intelligence',
        '/dashboard/continuity-intelligence',
        '/dashboard/executive-operating-intelligence',
        '/dashboard/operations',
        '/dashboard/governance-center',
        '/dashboard/outcomes',
        '/dashboard/leadership',
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
