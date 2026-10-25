import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withClaimedWorkbookAccess: vi.fn(),
  auditClaimedWorkbookWrite: vi.fn(),
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
  withClaimedWorkbookAccess: m.withClaimedWorkbookAccess,
}));
vi.mock('@/lib/workbook/claimed-write-audit', () => ({
  auditClaimedWorkbookWrite: m.auditClaimedWorkbookWrite,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), and: vi.fn() }));

async function loadRoute() {
  return import('../route');
}

function allowAccess() {
  m.withClaimedWorkbookAccess.mockImplementation(
    async (
      args: { workbookId: string; operation: 'read' | 'write' },
      cb: (authority: unknown) => Promise<unknown>,
    ) => {
      const authority = {
        kind: 'preclaim',
        workbookId: args.workbookId,
        claimedByUserId: null,
        claimedOrgId: null,
        actorUserId: null,
        operation: args.operation,
      };
      const value = await cb(authority);
      return { ok: true as const, value, authority };
    },
  );
}

// ROUND 50 REGRESSION: PATCH/DELETE previously had no ownership check at
// all, letting anyone who knew workbookId+holderId edit/delete succession
// data even after the workbook became identity-linked via claim.
describe('workbook/[id]/memory-holders/[holderId] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.updateResult = [{ id: 'holder_1' }];
    m.deleteResult = [{ id: 'holder_1' }];
    m.auditClaimedWorkbookWrite.mockResolvedValue(undefined);
    allowAccess();
  });

  it('PATCH records an audit inside the access boundary and names only the changed fields', async () => {
    const { PATCH } = await loadRoute();

    const response = await PATCH(new NextRequest('http://localhost/api/workbook/w1/memory-holders/h1', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'x', notes: 'private' }),
    }), { params: Promise.resolve({ id: 'w1', holderId: 'h1' }) });

    expect(response.status).toBe(200);
    expect(m.auditClaimedWorkbookWrite).toHaveBeenCalledWith(
      expect.objectContaining({ workbookId: 'w1' }),
      expect.objectContaining({
        action: 'workbook.memory_holder.update',
        resourceId: 'h1',
        details: { fields: ['role', 'notes'] },
      }),
    );
  });

  it('PATCH on a holder that is not in the workbook is 404 with no audit', async () => {
    const { PATCH } = await loadRoute();
    m.updateResult = [];

    const response = await PATCH(new NextRequest('http://localhost/api/workbook/w1/memory-holders/h9', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'x' }),
    }), { params: Promise.resolve({ id: 'w1', holderId: 'h9' }) });

    expect(response.status).toBe(404);
    expect(m.auditClaimedWorkbookWrite).not.toHaveBeenCalled();
  });

  it('PATCH fails when its audit cannot be written', async () => {
    const { PATCH } = await loadRoute();
    m.auditClaimedWorkbookWrite.mockRejectedValueOnce(new Error('audit down'));

    const response = await PATCH(new NextRequest('http://localhost/api/workbook/w1/memory-holders/h1', {
      method: 'PATCH',
      body: JSON.stringify({ role: 'x' }),
    }), { params: Promise.resolve({ id: 'w1', holderId: 'h1' }) });

    expect(response.status).toBe(503);
  });

  it('DELETE records an audit, and a missing holder is 404 with none', async () => {
    const { DELETE } = await loadRoute();
    const ctx = { params: Promise.resolve({ id: 'w1', holderId: 'h1' }) };

    const ok = await DELETE(new NextRequest('http://localhost/api/workbook/w1/memory-holders/h1', { method: 'DELETE' }), ctx);
    expect(ok.status).toBe(200);
    expect(m.auditClaimedWorkbookWrite).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'workbook.memory_holder.delete', resourceId: 'h1' }),
    );

    m.auditClaimedWorkbookWrite.mockClear();
    m.deleteResult = [];
    const missing = await DELETE(new NextRequest('http://localhost/api/workbook/w1/memory-holders/h1', { method: 'DELETE' }), ctx);
    expect(missing.status).toBe(404);
    expect(m.auditClaimedWorkbookWrite).not.toHaveBeenCalled();
  });

  it('PATCH returns the access-control error status when access is denied', async () => {
    const { PATCH } = await loadRoute();
    m.withClaimedWorkbookAccess.mockResolvedValueOnce({ ok: false, status: 403, error: 'Forbidden' });

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
    expect(m.withClaimedWorkbookAccess).toHaveBeenCalledWith(
      { workbookId: 'w1', operation: 'write' },
      expect.any(Function),
    );
  });

  it('DELETE returns the access-control error status when access is denied', async () => {
    const { DELETE } = await loadRoute();
    m.withClaimedWorkbookAccess.mockResolvedValueOnce({ ok: false, status: 401, error: 'Authentication required' });

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
    expect(m.withClaimedWorkbookAccess).toHaveBeenCalledWith(
      { workbookId: 'w1', operation: 'write' },
      expect.any(Function),
    );
  });
});
