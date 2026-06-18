import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'insert', 'update', 'set', 'values', 'returning', 'delete']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const execute = vi.fn();
  const db = {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
    execute,
  };
  return { queue, db, execute };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  sql: vi.fn(() => ({})),
  lte: vi.fn(() => ({})),
  isNotNull: vi.fn(() => ({})),
}));

import * as calc from '../per-capita-calculator';

const pushSel = (...items: unknown[]) => h.queue.push(...items);

beforeEach(() => {
  h.queue.length = 0;
  h.execute.mockReset();
});

describe('getMemberStanding', () => {
  it('returns not-in-good-standing when there is no membership', async () => {
    pushSel([]); // membership lookup
    const r = await calc.getMemberStanding('u1', 'o1');
    expect(r.isGoodStanding).toBe(false);
    expect(r.lastDuesPaymentDate).toBeNull();
  });

  it('returns good standing when a recent payment exists', async () => {
    pushSel([{ userId: 'u1' }]); // membership
    h.execute.mockResolvedValueOnce([{ last_payment_date: new Date(), dues_owing: '0' }]);
    const r = await calc.getMemberStanding('u1', 'o1');
    expect(r.isGoodStanding).toBe(true);
  });

  it('returns not-in-good-standing when the last payment is stale', async () => {
    pushSel([{ userId: 'u1' }]);
    h.execute.mockResolvedValueOnce([{ last_payment_date: null, dues_owing: '120' }]);
    const r = await calc.getMemberStanding('u1', 'o1');
    expect(r.isGoodStanding).toBe(false);
    expect(r.duesOwing).toBe(120);
  });
});

describe('countGoodStandingMembers', () => {
  it('parses member counts from the query result', async () => {
    h.execute.mockResolvedValueOnce([{ total_members: '10', good_standing_members: '8' }]);
    const r = await calc.countGoodStandingMembers('o1');
    expect(r.total).toBe(10);
    expect(r.goodStanding).toBe(8);
    expect(r.remittable).toBe(8);
  });

  it('defaults to zero when no rows are returned', async () => {
    h.execute.mockResolvedValueOnce([]);
    const r = await calc.countGoodStandingMembers('o1');
    expect(r.total).toBe(0);
  });
});

describe('calculatePerCapita', () => {
  it('throws when the organization is not found', async () => {
    pushSel([]);
    await expect(calc.calculatePerCapita('o1', 3, 2024)).rejects.toThrow('not found');
  });

  it('returns null when there is no parent organization', async () => {
    pushSel([{ id: 'o1', parentId: null }]);
    expect(await calc.calculatePerCapita('o1', 3, 2024)).toBeNull();
  });

  it('returns null when the per-capita rate is non-positive', async () => {
    pushSel([{ id: 'o1', parentId: 'p1', settings: { perCapitaRate: '0' } }]);
    expect(await calc.calculatePerCapita('o1', 3, 2024)).toBeNull();
  });

  it('computes a remittance with settings rate and charter number', async () => {
    pushSel([{ id: 'o1', parentId: 'p1', settings: { perCapitaRate: '2.5', remittanceDay: '10' }, charterNumber: 'CH-1' }]);
    h.execute.mockResolvedValueOnce([{ total_members: '10', good_standing_members: '8' }]);
    const r = await calc.calculatePerCapita('o1', 3, 2024);
    expect(r).not.toBeNull();
    expect(r!.totalAmount).toBe(20);
    expect(r!.clcAccountCode).toBe('CH-1');
    expect(r!.toOrganizationId).toBe('p1');
  });

  it('falls back to a default rate when settings are not an object', async () => {
    pushSel([{ id: 'o1', parentId: 'p1', settings: null }]);
    h.execute.mockResolvedValueOnce([{ total_members: '4', good_standing_members: '4' }]);
    const r = await calc.calculatePerCapita('o1', 3, 2024);
    expect(r!.perCapitaRate).toBe(1);
  });
});

describe('calculateAllPerCapita', () => {
  it('calculates for rated orgs and swallows per-org errors', async () => {
    pushSel([
      { id: 'o1', parentId: 'p1', status: 'active', settings: { perCapitaRate: '2.0' } },
      { id: 'o2', parentId: 'p1', status: 'active', settings: { perCapitaRate: '3.0' } },
      { id: 'o3', parentId: 'p1', status: 'active', settings: {} }, // filtered out (no rate)
    ]);
    pushSel([{ id: 'o1', parentId: 'p1', settings: { perCapitaRate: '2.0' } }]); // calculatePerCapita(o1)
    h.execute.mockResolvedValueOnce([{ total_members: '5', good_standing_members: '5' }]);
    pushSel([]); // calculatePerCapita(o2) -> org not found -> throws -> caught
    const r = await calc.calculateAllPerCapita(3, 2024);
    expect(r).toHaveLength(1);
    expect(r[0].fromOrganizationId).toBe('o1');
  });
});

describe('savePerCapitaRemittances', () => {
  const baseCalc = {
    fromOrganizationId: 'o1', toOrganizationId: 'p1', remittanceMonth: 3, remittanceYear: 2024,
    totalMembers: 10, goodStandingMembers: 8, remittableMembers: 8, perCapitaRate: 2, totalAmount: 16,
    dueDate: new Date('2024-04-10'), clcAccountCode: 'CH-1', glAccount: 'GL',
  };

  it('updates existing remittances and inserts new ones', async () => {
    pushSel([{ id: 'ex1' }]); // existing for calc1 -> update
    pushSel([]); // update result
    pushSel([]); // existing for calc2 (none) -> insert
    pushSel([]); // insert result
    const r = await calc.savePerCapitaRemittances([baseCalc, { ...baseCalc, fromOrganizationId: 'o2' }]);
    expect(r.saved).toBe(2);
    expect(r.errors).toBe(0);
  });

  it('counts errors when a save throws', async () => {
    pushSel(new Error('db down')); // existing lookup rejects
    const r = await calc.savePerCapitaRemittances([baseCalc]);
    expect(r.errors).toBe(1);
    expect(r.saved).toBe(0);
  });
});

describe('getRemittanceStatusForParent', () => {
  it('maps query rows to remittance status objects', async () => {
    h.execute.mockResolvedValueOnce([{
      organization_id: 'o1', organization_name: 'Local 1',
      total_due: '100', total_paid: '50', total_overdue: '0',
      pending_count: '2', overdue_count: '0', last_remittance_date: null,
    }]);
    const r = await calc.getRemittanceStatusForParent('p1');
    expect(r[0].organizationName).toBe('Local 1');
    expect(r[0].totalDue).toBe(100);
    expect(r[0].pendingCount).toBe(2);
  });

  it('accepts an explicit year', async () => {
    h.execute.mockResolvedValueOnce([]);
    const r = await calc.getRemittanceStatusForParent('p1', 2023);
    expect(r).toEqual([]);
  });
});

describe('getOverdueRemittances', () => {
  it('returns pending remittances past the grace period', async () => {
    pushSel([{ id: 'r1' }, { id: 'r2' }]);
    const r = await calc.getOverdueRemittances();
    expect(r).toHaveLength(2);
  });
});

describe('markOverdueRemittances', () => {
  it('returns the number of rows marked overdue', async () => {
    pushSel([{ id: 'r1' }, { id: 'r2' }, { id: 'r3' }]);
    expect(await calc.markOverdueRemittances()).toBe(3);
  });

  it('returns zero when no rows are affected', async () => {
    pushSel([]);
    expect(await calc.markOverdueRemittances()).toBe(0);
  });
});

describe('updateLastRemittanceDate', () => {
  it('merges the remittance date into org settings', async () => {
    pushSel([{ id: 'o1', settings: { existing: true } }]); // org lookup
    pushSel([]); // update
    await expect(calc.updateLastRemittanceDate('o1', new Date('2024-04-15'))).resolves.toBeUndefined();
  });

  it('does nothing when the organization is missing', async () => {
    pushSel([]); // org lookup empty
    await expect(calc.updateLastRemittanceDate('o1', new Date())).resolves.toBeUndefined();
  });
});

describe('processMonthlyPerCapita', () => {
  it('orchestrates calculation, saving and overdue marking', async () => {
    pushSel([]); // calculateAllPerCapita -> no orgs
    pushSel([]); // markOverdueRemittances update
    const r = await calc.processMonthlyPerCapita();
    expect(r).toEqual({ calculated: 0, saved: 0, errors: 0, overdueMarked: 0 });
  });
});

it('exposes the PerCapitaCalculator facade', () => {
  expect(calc.PerCapitaCalculator.calculatePerCapita).toBe(calc.calculatePerCapita);
  expect(calc.PerCapitaCalculator.DEFAULT_REMITTANCE_DAY).toBe(15);
});
