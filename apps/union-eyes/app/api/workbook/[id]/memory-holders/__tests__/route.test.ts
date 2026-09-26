import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withClaimedWorkbookAccess: vi.fn(),
  runStewardshipCartography: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  selectQueue: [] as unknown[][],
  insertResult: [{ id: 'holder_1' }] as unknown[],
}));

const mockDb = {
  select: vi.fn(() => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
    };
    return chain;
  }),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => m.insertResult),
    })),
  })),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/workbook/access-control', () => ({
  withClaimedWorkbookAccess: m.withClaimedWorkbookAccess,
}));
vi.mock('@/lib/workbook/engines/stewardshipCartography', () => ({
  runStewardshipCartography: m.runStewardshipCartography,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));

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

// ROUND 50 REGRESSION: memory-holders GET/POST previously only checked
// workbook existence, not claimed-ownership — see lib/workbook/access-control.ts
// and its dedicated test suite for the underlying logic. These tests prove
// the route actually invokes and respects that check.
describe('workbook/[id]/memory-holders route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.runStewardshipCartography.mockReturnValue({ score: 0 });
    allowAccess();
  });

  it('GET returns the access-control error status when access is denied', async () => {
    const { GET } = await loadRoute();
    m.withClaimedWorkbookAccess.mockResolvedValueOnce({ ok: false, status: 403, error: 'Forbidden' });

    const response = await GET(new NextRequest('http://localhost/api/workbook/w1/memory-holders'), {
      params: Promise.resolve({ id: 'w1' }),
    });

    expect(response.status).toBe(403);
  });

  it('GET returns 404 when access-control reports the workbook missing', async () => {
    const { GET } = await loadRoute();
    m.withClaimedWorkbookAccess.mockResolvedValueOnce({ ok: false, status: 404, error: 'Workbook not found' });

    const response = await GET(new NextRequest('http://localhost/api/workbook/w1/memory-holders'), {
      params: Promise.resolve({ id: 'w1' }),
    });

    expect(response.status).toBe(404);
  });

  it('GET returns cartography payload when access is allowed', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);

    const response = await GET(new NextRequest('http://localhost/api/workbook/w1/memory-holders'), {
      params: Promise.resolve({ id: 'w1' }),
    });

    expect(response.status).toBe(200);
    expect(m.withClaimedWorkbookAccess).toHaveBeenCalledWith(
      { workbookId: 'w1', operation: 'read' },
      expect.any(Function),
    );
  });

  it('POST returns the access-control error status when access is denied', async () => {
    const { POST } = await loadRoute();
    m.withClaimedWorkbookAccess.mockResolvedValueOnce({ ok: false, status: 403, error: 'Forbidden' });

    const response = await POST(new NextRequest('http://localhost/api/workbook/w1/memory-holders', {
      method: 'POST',
      body: JSON.stringify({ role: 'x', responsibility: 'y' }),
    }), { params: Promise.resolve({ id: 'w1' }) });

    expect(response.status).toBe(403);
  });

  it('POST creates a memory holder when access is allowed', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(new NextRequest('http://localhost/api/workbook/w1/memory-holders', {
      method: 'POST',
      body: JSON.stringify({ role: 'Treasurer', responsibility: 'Payroll' }),
    }), { params: Promise.resolve({ id: 'w1' }) });

    expect(response.status).toBe(201);
    expect(m.withClaimedWorkbookAccess).toHaveBeenCalledWith(
      { workbookId: 'w1', operation: 'write' },
      expect.any(Function),
    );
  });
});
