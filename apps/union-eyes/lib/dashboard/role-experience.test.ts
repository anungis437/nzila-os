import { describe, expect, it } from 'vitest';
import { UserRole } from '../auth/roles';
import { REQUIRED_VISIBLE_LABELS, STAKEHOLDER_ORDER, getFixture } from '../../e2e/helpers/role-fixtures';
import { getDashboardExperience, getNavigationForExperience, getRoleLandingPath, getVisibleNavigationForExperience } from './role-experience';

describe('getRoleLandingPath', () => {
  it.each([
    [UserRole.MEMBER, '/dashboard'],
    [UserRole.STEWARD, '/dashboard/workbench'],
    [UserRole.COO, '/dashboard/executive'],
    [UserRole.OFFICER, '/dashboard/executive'],
    [UserRole.ADMIN, '/dashboard/admin/organizations'],
  ])('maps %s to a real dashboard landing route', (role, expected) => {
    expect(getRoleLandingPath(role)).toBe(expected);
  });
});

describe('getNavigationForExperience', () => {
  it('keeps the sidebar label contract aligned with the current experience navigation', () => {
    const experiences = [
      ['member', getNavigationForExperience('member'), REQUIRED_VISIBLE_LABELS.member],
      ['staff', getNavigationForExperience('staff'), REQUIRED_VISIBLE_LABELS.steward],
      ['executive', getNavigationForExperience('executive'), REQUIRED_VISIBLE_LABELS.executive],
      ['governance', getNavigationForExperience('governance'), REQUIRED_VISIBLE_LABELS.governance],
      ['admin', getNavigationForExperience('admin'), REQUIRED_VISIBLE_LABELS.admin],
    ] as const;

    for (const [experienceName, nav, labels] of experiences) {
      const presentLabels = new Set(nav.map((item) => item.label));
      for (const label of labels) {
        expect(presentLabels.has(label), `${experienceName} should expose sidebar label ${label}`).toBe(true);
      }
    }
  });
});


describe('the complete role-specific browser navigation contract', () => {
  it.each(STAKEHOLDER_ORDER)('requires only available destinations for the %s profile', (profile) => {
    const fixture = getFixture(profile);
    const visible = getVisibleNavigationForExperience(getDashboardExperience(fixture.userRole), true, fixture.userRole);
    const required = REQUIRED_VISIBLE_LABELS[profile];
    expect(required.length).toBeGreaterThan(2);
    expect(new Set(required).size).toBe(required.length);
    const missing = required.filter(label => !visible.some(item => item.label === label));
    expect(missing, `${profile} (${fixture.userRole}): every declared label must survive the real role filter`).toEqual([]);
  });

  // This is the programme's explicit handler set; platform seniority and an experience name grant no handler navigation.
  const handlers = new Set(['steward', 'chief_steward', 'officer', 'president', 'vice_president', 'secretary_treasurer', 'health_safety_rep', 'bargaining_committee']);
  it.each(Object.values(UserRole).filter(role => !handlers.has(role)))('offers no case-handler destination to %s', (role) => {
    const visible = getVisibleNavigationForExperience(getDashboardExperience(role), true, role);
    expect(visible.map(item => item.href.split('?')[0])).not.toContain('/dashboard/workbench');
    expect(visible.map(item => item.href.split('?')[0])).not.toContain('/dashboard/grievances');
  });

  it('keeps Support Agent correspondence outside its permitted destinations', () => {
    const fixture = getFixture('staff');
    const visible = getVisibleNavigationForExperience(getDashboardExperience(fixture.userRole), true, fixture.userRole);
    expect(visible.map(item => item.href.split('?')[0])).not.toContain('/dashboard/correspondence');
  });
});
