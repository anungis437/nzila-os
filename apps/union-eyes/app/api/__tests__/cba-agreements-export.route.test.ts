import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B4-CBA-EXPORT-SILENTLY-TRUNCATED: the export asked for 10000 rows but the list serves 100 a page, so the file silently held the first
// page. It reads every page, and refuses a result set over its bound instead of cutting it.
const m = vi.hoisted(() => ({ listAgreements: vi.fn() }));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx),
  ApiError: { badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }) },
  z: require('zod'),
}));
vi.mock('@/lib/services/cba-intelligence/extraction-service', () => ({ listAgreements: m.listAgreements }));

const row = (n: number) => ({
  id: `a${n}`, title: `Agreement ${n}`, employerNormalized: null, unionNormalized: null, localEntity: null, jurisdiction: 'ON', sector: null,
  effectiveDate: null, expiryDate: null, termMonths: null, employeeCoverage: null, reviewStatus: 'reviewed', overallConfidence: null, sourceUrl: null, createdAt: null,
});
const page = (from: number, count: number) => Array.from({ length: count }, (_, i) => row(from + i));

async function run() {
  const { GET } = await import('../cba-intelligence/agreements/export/route');
  return (GET as never as (ctx: unknown) => Promise<Response>)({ query: {} });
}

describe('cba-intelligence/agreements/export', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exports every row across pages, not just the first page', async () => {
    m.listAgreements.mockImplementation(async (_q: unknown, { page: p }: { page: number }) => ({
      items: p === 1 ? page(0, 100) : p === 2 ? page(100, 100) : page(200, 30), total: 230, page: p, limit: 100,
    }));
    const csv = await (await run()).text();
    expect(csv.split('\n')).toHaveLength(231);
    expect(csv).toContain('a229');
    expect(m.listAgreements).toHaveBeenCalledTimes(3);
  });

  it('refuses a result set over the export bound, reading no further pages', async () => {
    m.listAgreements.mockResolvedValue({ items: page(0, 100), total: 10001, page: 1, limit: 100 });
    await expect(run()).rejects.toMatchObject({ status: 400, message: expect.stringContaining('10001') });
    expect(m.listAgreements).toHaveBeenCalledTimes(1);
  });

  it('stops if a page comes back empty before the total is reached, rather than looping', async () => {
    m.listAgreements.mockImplementation(async (_q: unknown, { page: p }: { page: number }) => ({ items: p === 1 ? page(0, 100) : [], total: 250, page: p, limit: 100 }));
    const csv = await (await run()).text();
    expect(csv.split('\n')).toHaveLength(101);
  });
});
