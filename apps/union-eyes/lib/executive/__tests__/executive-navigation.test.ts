import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { navigationCopyKey } from '../../dashboard/navigation-copy';
import {
  canAccessDashboardPath,
  getDashboardExperience,
  getNavigationForExperience,
  getRoleLandingPath,
  getVisibleNavigationForExperience,
} from '../../dashboard/role-experience';
import {
  EXECUTIVE_DESTINATIONS,
  EXECUTIVE_HOME_HREF,
  getExecutiveNavigation,
} from '../executive-navigation';
import {
  EXECUTIVE_DESTINATION_KEYS,
  EXECUTIVE_DOMAINS,
  executiveDomainsByDestination,
} from '../capability-matrix';

const DASHBOARD_ROOT = path.resolve(__dirname, '../../../app/[locale]/dashboard');

describe('frozen executive navigation (UE-OFFICER-EXECUTIVE-CANONICAL-2.1)', () => {
  it('has exactly the seven frozen destinations, in order, plus only a secondary account control', () => {
    expect(EXECUTIVE_DESTINATIONS.map((d) => d.label)).toEqual([
      'Today',
      'Members & Service',
      'Governance & Organization',
      'Bargaining & Collective Action',
      'Finance & Resources',
      'Communications & Relations',
      'Continuity & Intelligence',
    ]);
    const nav = getExecutiveNavigation();
    expect(nav.filter((i) => i.group === 'Executive')).toHaveLength(7);
    expect(nav.filter((i) => i.group !== 'Executive').map((i) => i.href)).toEqual(['/dashboard/settings']);
    expect(new Set(nav.map((i) => i.href)).size).toBe(nav.length);
  });

  it('never advertises a link that has no page (no notFound/404 destinations)', () => {
    for (const item of getExecutiveNavigation()) {
      const dir = path.join(DASHBOARD_ROOT, item.href.replace('/dashboard/', ''));
      expect(existsSync(path.join(dir, 'page.tsx')), `${item.href} must resolve to a page`).toBe(true);
    }
  });

  it('lands executives on Today and removes the competing OCRA/workspace homes from the menu', () => {
    for (const role of ['president', 'vice_president', 'secretary_treasurer', 'officer']) {
      expect(getDashboardExperience(role)).toBe('executive');
      expect(getRoleLandingPath(role)).toBe(EXECUTIVE_HOME_HREF);
    }
    const hrefs = getNavigationForExperience('executive').map((i) => i.href);
    expect(hrefs).not.toContain('/dashboard/workspace');
    expect(hrefs).not.toContain('/dashboard/intelligence?scope=executive');
    expect(hrefs).not.toContain('/dashboard/trust');
    expect(hrefs).not.toContain('/dashboard/executive-operating-intelligence');
  });

  it('keeps federation/CLC governance, platform and casework surfaces out of the executive experience', () => {
    expect(getDashboardExperience('clc_executive')).toBe('governance');
    expect(getDashboardExperience('compliance_manager')).toBe('governance');
    expect(getDashboardExperience('steward')).toBe('staff');
    for (const blocked of ['/dashboard/workbench', '/dashboard/operations', '/dashboard/admin/organizations', '/dashboard/inbox']) {
      expect(canAccessDashboardPath(blocked, 'executive', false), blocked).toBe(false);
    }
    for (const item of getExecutiveNavigation()) {
      expect(canAccessDashboardPath(item.href, 'executive', false), item.href).toBe(true);
      expect(canAccessDashboardPath(item.href, 'executive', true), `${item.href} (pilot)`).toBe(true);
    }
  });

  it('localizes every destination label: each catalog has the key and French is not the English literal', () => {
    const catalog = (locale: string) =>
      JSON.parse(readFileSync(path.resolve(__dirname, `../../../messages/${locale}.json`), 'utf8')).experienceNavigation as Record<string, string>;
    const en = catalog('en-CA');
    for (const locale of ['en', 'en-CA', 'fr', 'fr-CA', 'it', 'pt']) {
      const copy = catalog(locale);
      for (const destination of EXECUTIVE_DESTINATIONS) {
        const key = navigationCopyKey(destination.label);
        expect(copy[key], `${locale}:${key}`).toBeTruthy();
        if (locale.startsWith('fr')) expect(copy[key], `${locale}:${key}`).not.toBe(en[key]);
      }
    }
  });

  it('does not give an elected officer or board role finance visibility by seniority', () => {
    const visible = (role: string) => getVisibleNavigationForExperience('executive', false, role).map((i) => i.href);
    expect(visible('officer')).not.toContain('/dashboard/finance');
    expect(visible('officer')).toHaveLength(7); // six destinations + settings
    for (const role of ['secretary_treasurer', 'vice_president', 'president']) {
      expect(visible(role)).toContain('/dashboard/finance');
      expect(visible(role)).toHaveLength(8);
    }
  });
});

describe('O01–O26 coverage matrix', () => {
  it('covers exactly O01..O26 once each, mapped to a frozen destination', () => {
    expect(EXECUTIVE_DOMAINS.map((d) => d.id)).toEqual(
      Array.from({ length: 26 }, (_, i) => `O${String(i + 1).padStart(2, '0')}`),
    );
    for (const d of EXECUTIVE_DOMAINS) expect(EXECUTIVE_DESTINATION_KEYS).toContain(d.destination);
    expect(EXECUTIVE_DESTINATIONS.map((d) => d.key)).toEqual([...EXECUTIVE_DESTINATION_KEYS]);
  });

  it('claims nothing OPERATIONAL and explains every gap', () => {
    for (const d of EXECUTIVE_DOMAINS) {
      expect(d.disposition, d.id).not.toBe('OPERATIONAL');
      expect(d.gap.length, d.id).toBeGreaterThan(20);
    }
  });

  it('keeps democratic, ratification and payment capabilities from being advertised as available', () => {
    const byId = Object.fromEntries(EXECUTIVE_DOMAINS.map((d) => [d.id, d.disposition]));
    expect(byId.O05).toBe('BLOCKED');
    expect(byId.O09).toBe('UNAVAILABLE');
    expect(byId.O11).toBe('BLOCKED');
    expect(byId.O13).toBe('UNAVAILABLE');
    expect(byId.O14).toBe('BLOCKED');
    expect(byId.O19).toBe('UNAVAILABLE');
  });

  it('assigns at least one domain to every destination', () => {
    for (const key of EXECUTIVE_DESTINATION_KEYS) {
      expect(executiveDomainsByDestination(key).length, key).toBeGreaterThan(0);
    }
  });
});
