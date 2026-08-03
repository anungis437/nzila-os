import { describe, expect, it } from 'vitest';
import { UserRole } from '../auth/roles';
import { REQUIRED_VISIBLE_LABELS } from '../../e2e/helpers/role-fixtures';
import { getNavigationForExperience, getRoleLandingPath } from './role-experience';

describe('getRoleLandingPath', () => {
  it.each([
    [UserRole.MEMBER, '/dashboard/workspace'],
    [UserRole.STEWARD, '/dashboard/workbench'],
    [UserRole.COO, '/dashboard/intelligence'],
    [UserRole.OFFICER, '/dashboard/governance'],
    [UserRole.ADMIN, '/dashboard/admin/organizations'],
  ])('maps %s to a real dashboard landing route', (role, expected) => {
    expect(getRoleLandingPath(role)).toBe(expected);
  });
});

describe('getNavigationForExperience', () => {
  it('keeps the sidebar label contract aligned with the current experience navigation', () => {
    const experiences = [
      ['member', getNavigationForExperience('member'), REQUIRED_VISIBLE_LABELS.member],
      ['staff', getNavigationForExperience('staff'), REQUIRED_VISIBLE_LABELS.staff],
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
