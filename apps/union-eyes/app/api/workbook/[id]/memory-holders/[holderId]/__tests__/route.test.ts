import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withClaimedWorkbookAccess: vi.fn(),
  auditClaimedWorkbookWrite: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  updateResult: [{ id: 'holder_1' }] as unknown[],
  deleteResult: [{ id: 'holder_1' }] as unknown[],
}));

const WORKBOOK = '11111111-1111-4111-8111-111111111111';
const HOLDER = '22222222-2222-4222-8222-222222222222';
const MISSING_HOLDER = '33333333-3333-4333-8333-333333333333';

// The transaction the access boundary hands to the callback (authority.tx): every statement the route makes goes through it.
const boundaryTx = {
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

// The ambient handle must never be reached by this route: a statement on it would run outside the authority's context.
const ambient = new Proxy({}, { get: () => { throw new Error('the ambient database handle was used'); } });
vi.mock('@/db', () => ({ db: ambient }));
vi.mock('@/db/db', () => ({ db: ambient }));
vi.mock('@/lib/workbook/access-control', () => ({
  withClaimedWorkbookAccess: m.withClaimedWorkbookAccess,
}));
vi.mock('@/lib/workbook/claimed-write-audit', () => ({
  auditClaimedWorkbookWrite: m.auditClaimedWorkbookWrite,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => ({ ...(await importOriginal<typeof import('drizzle-orm')>()), eq: vi.fn(), and: vi.fn() }));

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
        tx: boundaryTx,
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

    const response = await PATCH(new NextRequest(`http://localhost/api/workbook/${WORKBOOK}/memory-holders/${HOLDER}`, {
      method: 'PATCH',
      // Clearing a note is a change that removes identifying detail, so it needs no notice; writing one now does (see holder-notice.ts).
      body: JSON.stringify({ role: 'x', notes: null }),
    }), { params: Promise.resolve({ id: WORKBOOK, holderId: HOLDER }) });

    expect(response.status).toBe(200);
    expect(boundaryTx.update).toHaveBeenCalledTimes(1);
    expect(m.auditClaimedWorkbookWrite).toHaveBeenCalledWith(
      expect.objectContaining({ workbookId: WORKBOOK, tx: boundaryTx }),
      expect.objectContaining({
        action: 'workbook.memory_holder.update',
        resourceId: HOLDER,
        details: { fields: ['role', 'notes'] },
      }),
    );
  });

  // Replaced in F06 batch 5 (A7): these two pinned that a write matching nothing is not recorded. It is now recorded as an attempt (a claimed
  // workbook only; a pre-claim one has no actor), so an identified person's miss on the organization's people map is visible.
  it('PATCH on a holder that is not in the workbook is 404 and is recorded as a missed attempt, never as an update', async () => {
    const { PATCH } = await loadRoute();
    m.updateResult = [];

    const response = await PATCH(new NextRequest(`http://localhost/api/workbook/${WORKBOOK}/memory-holders/${MISSING_HOLDER}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'x' }),
    }), { params: Promise.resolve({ id: WORKBOOK, holderId: MISSING_HOLDER }) });

    expect(response.status).toBe(404);
    expect(m.auditClaimedWorkbookWrite).toHaveBeenCalledTimes(1);
    expect(m.auditClaimedWorkbookWrite).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'workbook.memory_holder.update_not_found', resourceId: MISSING_HOLDER }),
    );
  });

  it('PATCH fails when its audit cannot be written', async () => {
    const { PATCH } = await loadRoute();
    m.auditClaimedWorkbookWrite.mockRejectedValueOnce(new Error('audit down'));

    const response = await PATCH(new NextRequest(`http://localhost/api/workbook/${WORKBOOK}/memory-holders/${HOLDER}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'x' }),
    }), { params: Promise.resolve({ id: WORKBOOK, holderId: HOLDER }) });

    expect(response.status).toBe(503);
  });

  it('DELETE records an audit, and a missing holder is 404 recorded as a missed attempt', async () => {
    const { DELETE } = await loadRoute();
    const ctx = { params: Promise.resolve({ id: WORKBOOK, holderId: HOLDER }) };

    const ok = await DELETE(new NextRequest(`http://localhost/api/workbook/${WORKBOOK}/memory-holders/${HOLDER}`, { method: 'DELETE' }), ctx);
    expect(ok.status).toBe(200);
    expect(boundaryTx.delete).toHaveBeenCalledTimes(1);
    expect(m.auditClaimedWorkbookWrite).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'workbook.memory_holder.delete', resourceId: HOLDER }),
    );

    m.auditClaimedWorkbookWrite.mockClear();
    m.deleteResult = [];
    const missing = await DELETE(new NextRequest(`http://localhost/api/workbook/${WORKBOOK}/memory-holders/${HOLDER}`, { method: 'DELETE' }), ctx);
    expect(missing.status).toBe(404);
    expect(m.auditClaimedWorkbookWrite).toHaveBeenCalledTimes(1);
    expect(m.auditClaimedWorkbookWrite).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'workbook.memory_holder.delete_not_found', resourceId: HOLDER }),
    );
  });

  it('PATCH returns the access-control error status when access is denied', async () => {
    const { PATCH } = await loadRoute();
    m.withClaimedWorkbookAccess.mockResolvedValueOnce({ ok: false, status: 403, error: 'Forbidden' });

    const response = await PATCH(new NextRequest(`http://localhost/api/workbook/${WORKBOOK}/memory-holders/${HOLDER}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'x' }),
    }), { params: Promise.resolve({ id: WORKBOOK, holderId: HOLDER }) });

    expect(response.status).toBe(403);
    expect(boundaryTx.update).not.toHaveBeenCalled();
  });

  it('PATCH updates the holder when access is allowed', async () => {
    const { PATCH } = await loadRoute();

    const response = await PATCH(new NextRequest(`http://localhost/api/workbook/${WORKBOOK}/memory-holders/${HOLDER}`, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'x' }),
    }), { params: Promise.resolve({ id: WORKBOOK, holderId: HOLDER }) });

    expect(response.status).toBe(200);
    expect(m.withClaimedWorkbookAccess).toHaveBeenCalledWith(
      { workbookId: WORKBOOK, operation: 'write', capability: null },
      expect.any(Function),
    );
  });

  it('DELETE returns the access-control error status when access is denied', async () => {
    const { DELETE } = await loadRoute();
    m.withClaimedWorkbookAccess.mockResolvedValueOnce({ ok: false, status: 401, error: 'Authentication required' });

    const response = await DELETE(new NextRequest(`http://localhost/api/workbook/${WORKBOOK}/memory-holders/${HOLDER}`, {
      method: 'DELETE',
    }), { params: Promise.resolve({ id: WORKBOOK, holderId: HOLDER }) });

    expect(response.status).toBe(401);
    expect(boundaryTx.delete).not.toHaveBeenCalled();
  });

  it('DELETE removes the holder when access is allowed', async () => {
    const { DELETE } = await loadRoute();

    const response = await DELETE(new NextRequest(`http://localhost/api/workbook/${WORKBOOK}/memory-holders/${HOLDER}`, {
      method: 'DELETE',
      headers: { cookie: `wbk_cap_${WORKBOOK}=tok-1` },
    }), { params: Promise.resolve({ id: WORKBOOK, holderId: HOLDER }) });

    expect(response.status).toBe(200);
    expect(m.withClaimedWorkbookAccess).toHaveBeenCalledWith(
      { workbookId: WORKBOOK, operation: 'write', capability: 'tok-1' },
      expect.any(Function),
    );
  });

  it('answers a malformed workbook or holder identifier as absent, without resolving authority or reaching SQL', async () => {
    const { PATCH, DELETE } = await loadRoute();

    const badHolderPatch = await PATCH(new NextRequest(`http://localhost/api/workbook/${WORKBOOK}/memory-holders/h1`, {
      method: 'PATCH',
      body: JSON.stringify({ role: 'x' }),
    }), { params: Promise.resolve({ id: WORKBOOK, holderId: 'h1' }) });
    const badWorkbookDelete = await DELETE(new NextRequest(`http://localhost/api/workbook/w1/memory-holders/${HOLDER}`, { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'w1', holderId: HOLDER }),
    });

    expect(badHolderPatch.status).toBe(404);
    expect(badWorkbookDelete.status).toBe(404);
    expect(m.withClaimedWorkbookAccess).not.toHaveBeenCalled();
  });
});
