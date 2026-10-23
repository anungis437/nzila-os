import { describe, expect, it } from 'vitest';
import { navigationDestination, selectedNavigationDestination } from '../navigation-selection';
import { getVisibleNavigationForExperience, type DashboardExperience } from '../role-experience';

describe('canonical navigation selection', () => {
  const items = [
    { label: 'Inbox', href: '/dashboard/inbox' },
    { label: 'Intake', href: '/dashboard/inbox?type=intake' },
    { label: 'Messages', href: '/dashboard/inbox?type=message' },
    { label: 'Cases', href: '/dashboard/cases' },
    { label: 'New case', href: '/dashboard/cases/new' },
  ];
  it('selects one query-specific destination without treating filters as a different destination', () => {
    expect(selectedNavigationDestination(items, '/fr-CA/dashboard/inbox', 'sort=recent&type=message'))
      .toBe('/dashboard/inbox?type=message');
  });
  it('prefers the most specific route and does not match partial path segments', () => {
    expect(selectedNavigationDestination(items, '/en-CA/dashboard/cases/new', '')).toBe('/dashboard/cases/new');
    expect(selectedNavigationDestination(items, '/en-CA/dashboard/cases-extra', '')).toBeUndefined();
  });
  it.each(['member', 'staff', 'executive', 'governance', 'admin'] as DashboardExperience[])
    ('has no duplicate destination identities for %s', experience => {
      const ids = getVisibleNavigationForExperience(experience, false).map(item => navigationDestination(item.href));
      expect(new Set(ids).size).toBe(ids.length);
    });
});
