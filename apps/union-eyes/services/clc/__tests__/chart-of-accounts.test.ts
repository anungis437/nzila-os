import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => {
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  return { queue, db: { select: () => makeChain() } };
});

vi.mock('@/db/db', () => ({ db: h.db }));
vi.mock('@/db/schema/domains/financial/chart-of-accounts', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  and: vi.fn(() => ({})),
  isNull: vi.fn(() => ({})),
}));

import { ChartOfAccountsService, chartOfAccounts } from '../chart-of-accounts';

const push = (...items: unknown[]) => h.queue.push(...items);
const svc = new ChartOfAccountsService();

const account = (overrides: Record<string, unknown> = {}) => ({
  accountCode: '4100',
  accountName: 'Per-Capita Tax Revenue',
  accountType: 'revenue',
  accountCategory: 'per_capita_revenue',
  statisticsCanadaCode: 'REV-PER-CAPITA',
  description: 'desc',
  isActive: true,
  parentAccountCode: null,
  sortOrder: 1100,
  ...overrides,
});

beforeEach(() => {
  h.queue.length = 0;
});

describe('account queries', () => {
  it('getAllAccounts returns CLC-standard active accounts', async () => {
    push([account(), account({ accountCode: '4200' })]);
    const r = await svc.getAllAccounts();
    expect(r).toHaveLength(2);
  });

  it('getAccountByCode returns the first matching record', async () => {
    push([account()]);
    const r = await svc.getAccountByCode('4100');
    expect(r?.accountCode).toBe('4100');
  });

  it('getAccountByCode returns undefined when not found', async () => {
    push([]);
    expect(await svc.getAccountByCode('9999')).toBeUndefined();
  });

  it('getAccountsByType filters by account type', async () => {
    push([account({ accountType: 'expense', accountCode: '5100' })]);
    const r = await svc.getAccountsByType('expense');
    expect(r[0].accountType).toBe('expense');
  });

  it('getAccountsByCategory filters by category', async () => {
    push([account({ accountCategory: 'salaries_wages' })]);
    const r = await svc.getAccountsByCategory('salaries_wages');
    expect(r).toHaveLength(1);
  });

  it('getChildAccounts returns children of a parent code', async () => {
    push([account({ accountCode: '4100-001', parentAccountCode: '4100' })]);
    const r = await svc.getChildAccounts('4100');
    expect(r[0].parentAccountCode).toBe('4100');
  });
});

describe('account mappings', () => {
  it('getAccountMapping maps db columns to the interface', async () => {
    push([{ transactionType: 'dues_collection', debitAccountCode: '7100', creditAccountCode: '4200-001', description: 'd' }]);
    const r = await svc.getAccountMapping('dues_collection');
    expect(r).toEqual({ transactionType: 'dues_collection', debitAccount: '7100', creditAccount: '4200-001', description: 'd' });
  });

  it('getAccountMapping returns undefined when no row matches', async () => {
    push([]);
    expect(await svc.getAccountMapping('nope')).toBeUndefined();
  });

  it('getAllAccountMappings maps every row and defaults a missing description', async () => {
    push([{ transactionType: 't1', debitAccountCode: 'd', creditAccountCode: 'c', description: null }]);
    const r = await svc.getAllAccountMappings();
    expect(r[0].description).toBe('');
  });
});

describe('per-capita account helpers', () => {
  it('getPerCapitaRevenueAccount returns account 4100', async () => {
    push([account({ accountCode: '4100' })]);
    const r = await svc.getPerCapitaRevenueAccount();
    expect(r.accountCode).toBe('4100');
  });

  it('getPerCapitaRevenueAccount throws when missing', async () => {
    push([]);
    await expect(svc.getPerCapitaRevenueAccount()).rejects.toThrow('4100');
  });

  it('getPerCapitaExpenseAccount returns account 5300', async () => {
    push([account({ accountCode: '5300', accountType: 'expense' })]);
    const r = await svc.getPerCapitaExpenseAccount();
    expect(r.accountCode).toBe('5300');
  });

  it('getPerCapitaExpenseAccount throws when missing', async () => {
    push([]);
    await expect(svc.getPerCapitaExpenseAccount()).rejects.toThrow('5300');
  });
});

describe('isValidAccountCode', () => {
  it('accepts 4-digit and sub-account codes', () => {
    expect(svc.isValidAccountCode('4000')).toBe(true);
    expect(svc.isValidAccountCode('4100-001')).toBe(true);
  });

  it('rejects malformed codes', () => {
    expect(svc.isValidAccountCode('41000')).toBe(false);
    expect(svc.isValidAccountCode('abc')).toBe(false);
  });
});

describe('hierarchy helpers', () => {
  it('getAccountPath walks parent codes', async () => {
    push([account({ accountCode: '4100-001', parentAccountCode: '4100' })]); // initial
    push([account({ accountCode: '4100', parentAccountCode: null })]); // parent
    const r = await svc.getAccountPath('4100-001');
    expect(r).toBe('4100 > 4100-001');
  });

  it('getAccountPath returns empty string when the account is missing', async () => {
    push([]);
    expect(await svc.getAccountPath('9999')).toBe('');
  });

  it('getAccountFullName builds a slash-delimited name hierarchy', async () => {
    push([account({ accountName: 'Legal Counsel', parentAccountCode: '5200' })]);
    push([account({ accountName: 'Legal and Professional Fees', parentAccountCode: null })]);
    const r = await svc.getAccountFullName('5200-001');
    expect(r).toBe('Legal and Professional Fees / Legal Counsel');
  });

  it('getAccountFullName returns empty string when missing', async () => {
    push([]);
    expect(await svc.getAccountFullName('9999')).toBe('');
  });
});

describe('exports', () => {
  it('exportToJSON serializes all accounts', async () => {
    push([account()]);
    const json = await svc.exportToJSON();
    expect(JSON.parse(json)).toHaveLength(1);
  });

  it('exportToCSV produces a header and data rows with flags and defaults', async () => {
    push([account({ isActive: false, accountCategory: null, statisticsCanadaCode: null, description: null, parentAccountCode: null, sortOrder: null })]);
    const csv = await svc.exportToCSV();
    const lines = csv.split('\n');
    expect(lines[0]).toContain('Code');
    expect(lines[1]).toContain(',N,'); // isActive false -> N
    expect(lines[1]).toContain(',0'); // sortOrder default
  });

  it('getAllAccountsSync returns the hardcoded constant', () => {
    const r = svc.getAllAccountsSync();
    expect(r.length).toBeGreaterThan(0);
    expect(r[0].code).toBe('4000');
  });
});

it('exposes a singleton instance', () => {
  expect(chartOfAccounts).toBeInstanceOf(ChartOfAccountsService);
});
