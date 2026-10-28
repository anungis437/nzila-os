import { describe, expect, it, vi } from 'vitest';

// DEF-0B12-CRUD-TAX-PATHS-SERVE-THE-PER-CAPITA-REMITTANCE-LEDGER-TO-ANY-MEMBER: four "tax" paths were generic CRUD
// collections over per_capita_remittances at the member read floor. They generate nothing and read nothing now.

const m = vi.hoisted(() => ({ select: vi.fn(), insert: vi.fn() }));

vi.mock('@/db', () => ({ db: { select: m.select, insert: m.insert } }));
vi.mock('@/db/db', () => ({ db: { select: m.select, insert: m.insert } }));
vi.mock('@/lib/api/framework', async () => {
  const { ApiError } = await vi.importActual<typeof import('@/lib/api/errors')>('@/lib/api/errors');
  return {
    ApiError,
    withApi: (_cfg: unknown, handler: () => Promise<unknown>) => async () => {
      try {
        return await handler();
      } catch (error) {
        return { status: (error as { code?: string }).code === 'NOT_IMPLEMENTED' ? 501 : 500, message: (error as Error).message };
      }
    },
  };
});

const PATHS = ['../tax/slips/route', '../tax/t106/route', '../tax/rl-1/generate/route', '../tax/cope/receipts/route'];

describe.each(PATHS)('%s', (path) => {
  it.each(['GET', 'POST'])('answers 501 to %s and touches no table', async (method) => {
    const mod = (await import(path)) as Record<string, () => Promise<{ status: number; message: string }>>;
    const result = await mod[method]();
    expect(result.status).toBe(501);
    expect(result.message).toContain('not implemented');
    expect(m.select).not.toHaveBeenCalled();
    expect(m.insert).not.toHaveBeenCalled();
  });

  it('exports no PATCH or DELETE handler', async () => {
    const mod = (await import(path)) as Record<string, unknown>;
    expect(mod.PATCH).toBeUndefined();
    expect(mod.DELETE).toBeUndefined();
  });
});
