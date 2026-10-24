import { describe, expect, it } from 'vitest';
import type { LeadershipDashboardPayload } from '../../services/dashboard-kpi-service';
import { buildExecutiveToday, getTodayCopy } from '../today';

const metrics = {
  kpi: { activeGrievances: 12, resolvedThisMonth: 1, avgTriageDays: 1, avgResolutionDays: 2, arbitrationCount: 0, overdueCases: 4 },
  provenance: {
    version: 'v3',
    generatedAt: '2026-10-23T12:00:00.000Z',
    window: { timeframe: 'monthly', start: '', end: '' },
    sources: [{ table: 'grievances', rowCount: 40, organizationScoped: true }],
    cache: { namespace: 'n', key: 'k', ttlSeconds: 600, hit: true },
  },
} as unknown as LeadershipDashboardPayload;

const card = (model: ReturnType<typeof buildExecutiveToday>, id: string) => model.cards.find((c) => c.id === id)!;

describe('executive Today view model', () => {
  it('shows sourced values with provenance only when the source was read', () => {
    const model = buildExecutiveToday({ metrics, mandatePresent: false, canSeeFinance: false });
    expect(card(model, 'service-exceptions')).toMatchObject({ state: 'SOURCED', value: 4 });
    expect(card(model, 'active-matters')).toMatchObject({ state: 'SOURCED', value: 12 });
    expect(model.provenance).toEqual({
      generatedAt: '2026-10-23T12:00:00.000Z',
      cacheHit: true,
      sources: [{ table: 'grievances', rowCount: 40 }],
    });
  });

  it('reports unavailable, never zero, when the source cannot be read', () => {
    const model = buildExecutiveToday({ metrics: null, mandatePresent: false, canSeeFinance: false });
    for (const id of ['service-exceptions', 'active-matters']) {
      expect(card(model, id).state).toBe('UNAVAILABLE');
      expect(card(model, id)).not.toHaveProperty('value');
    }
    expect(model.provenance).toBeNull();
  });

  it('never implies an empty decision queue, an obligation count or a financial position', () => {
    const model = buildExecutiveToday({ metrics, mandatePresent: true, canSeeFinance: true });
    expect(card(model, 'decisions')).toEqual({ id: 'decisions', state: 'UNAVAILABLE', href: '/dashboard/governance' });
    expect(card(model, 'commitments').state).toBe('UNAVAILABLE');
    for (const id of ['decisions', 'obligations', 'meetings', 'commitments']) {
      expect(card(model, id)).not.toHaveProperty('value');
    }
    expect(card(model, 'obligations').state).toBe('LIMITED');
  });

  it('links to Finance only for offices that can open it, and reports mandate state truthfully', () => {
    expect(card(buildExecutiveToday({ metrics, mandatePresent: false, canSeeFinance: false }), 'commitments').href).toBeUndefined();
    expect(card(buildExecutiveToday({ metrics, mandatePresent: false, canSeeFinance: true }), 'commitments').href).toBe('/dashboard/finance');
    expect(buildExecutiveToday({ metrics, mandatePresent: false, canSeeFinance: false }).mandateStatus).toBe('NO_VERIFIED_MANDATE');
    expect(buildExecutiveToday({ metrics, mandatePresent: true, canSeeFinance: false }).mandateStatus).toBe('MANDATE_PRESENT');
  });

  it('has complete English and French copy for every card and state', () => {
    const en = getTodayCopy('en-CA');
    const fr = getTodayCopy('fr-CA');
    expect(Object.keys(fr.cards).sort()).toEqual(Object.keys(en.cards).sort());
    expect(Object.keys(fr.states).sort()).toEqual(Object.keys(en.states).sort());
    expect(fr.title).not.toBe(en.title);
    expect(fr.NO_VERIFIED_MANDATE).not.toBe(en.NO_VERIFIED_MANDATE);
    expect(getTodayCopy('fr').title).toBe(fr.title);
    expect(getTodayCopy('es').title).toBe(en.title);
  });
});
