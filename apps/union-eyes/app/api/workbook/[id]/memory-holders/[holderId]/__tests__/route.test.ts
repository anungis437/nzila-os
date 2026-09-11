import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  verifyClaimedWorkbookAccess: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  updateResult: [{ id: 'holder_1' }] as unknown[],
  deleteResult: [{ id: 'holder_1' }] as unknown[],
}));

const mockDb = {
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(() => ({
        returning: vi.fn(async () => m.updateResult),
      })),
    })),
  })),
  delete: vi.fn(() => ({
    where: vi.fn(() => ({
      returning: vi.fn(async () => m.deleteResult),
    })),
  })),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/workbook/access-control', () => ({
  verifyClaimedWorkbookAccess: m.verifyClaimedWorkbookAccess,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), and: vi.fn() }));

async function loadRoute() {
  return import('../route');
}

// ROUND 50 REGRESSION: PATCH/DELETE previously had no ownership check at
// all, letting anyone who knew workbookId+holderId edit/delete succession
// data even after the workbook became identity-linked via claim.
describe('workbook/[id]/memory-holders/[holderId] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.verifyClaimedWorkbookAccess.mockResolvedValue({ ok: true });
  });

  it('PATCH returns the access-control error status when access is denied', async () => {
    const { PATCH } = await loadRoute();
    m.verifyClaimedWorkbookAccess.mockResolvedValueOnce({ ok: false, status: 403, error: 'Forbidden' });

    const response = await PATCH(new NextRequest('http://localhost/api/workbook/w1/memory-holders/h1', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'x' }),
    }), { params: Promise.resolve({ id: 'w1', holderId: 'h1' }) });

    expect(response.status).toBe(403);
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it('PATCH updates the holder when access is allowed', async () => {
    const { PATCH } = await loadRoute();

    const response = await PATCH(new NextRequest('http://localhost/api/workbook/w1/memory-holders/h1', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'x' }),
    }), { params: Promise.resolve({ id: 'w1', holderId: 'h1' }) });

    expect(response.status).toBe(200);
    expect(m.verifyClaimedWorkbookAccess).toHaveBeenCalledWith('w1');
  });

  it('DELETE returns the access-control error status when access is denied', async () => {
    const { DELETE } = await loadRoute();
    m.verifyClaimedWorkbookAccess.mockResolvedValueOnce({ ok: false, status: 401, error: 'Authentication required' });

    const response = await DELETE(new NextRequest('http://localhost/api/workbook/w1/memory-holders/h1', {
      method: 'DELETE',
    }), { params: Promise.resolve({ id: 'w1', holderId: 'h1' }) });

    expect(response.status).toBe(401);
    expect(mockDb.delete).not.toHaveBeenCalled();
  });

  it('DELETE removes the holder when access is allowed', async () => {
    const { DELETE } = await loadRoute();

    const response = await DELETE(new NextRequest('http://localhost/api/workbook/w1/memory-holders/h1', {
      method: 'DELETE',
    }), { params: Promise.resolve({ id: 'w1', holderId: 'h1' }) });

    expect(response.status).toBe(200);
    expect(m.verifyClaimedWorkbookAccess).toHaveBeenCalledWith('w1');
  });
});
