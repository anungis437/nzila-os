import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  generateWorkbookPdf: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  selectQueue: [] as unknown[][],
}));

const mockDb = {
  select: vi.fn(() => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn(async () => (m.selectQueue.shift() ?? []) as unknown[]),
    };
    return chain;
  }),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({
  auth: m.auth,
}));
vi.mock('@/db', () => ({
  db: mockDb,
}));
vi.mock('@/lib/workbook-pdf/generateWorkbookPdf', () => ({
  generateWorkbookPdf: m.generateWorkbookPdf,
}));
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: m.getOrganizationIdForUser,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn() }));

async function loadRoute() {
  return import('../workbook/[id]/export/route');
}

describe('workbook/[id]/export route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.generateWorkbookPdf.mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
  });

  it('returns 401 when unauthenticated', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await GET(new NextRequest('http://localhost/api/workbook/w1/export'), {
      params: Promise.resolve({ id: 'w1' }),
    });

    expect(response.status).toBe(401);
  });

  it('returns 404 when workbook does not exist', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);

    const response = await GET(new NextRequest('http://localhost/api/workbook/w1/export'), {
      params: Promise.resolve({ id: 'w1' }),
    });

    expect(response.status).toBe(404);
  });

  it('returns 403 when workbook is not claimed', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      { id: 'w1', reportTierId: 'workbook_self_guided', claimedByUserId: null },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/workbook/w1/export'), {
      params: Promise.resolve({ id: 'w1' }),
    });

    expect(response.status).toBe(403);
  });

  it('returns 403 when requester is outside owner organization', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      { id: 'w1', reportTierId: 'workbook_self_guided', claimedByUserId: 'owner_1' },
    ]);
    m.getOrganizationIdForUser
      .mockResolvedValueOnce('org_requester')
      .mockResolvedValueOnce('org_owner');

    const response = await GET(new NextRequest('http://localhost/api/workbook/w1/export'), {
      params: Promise.resolve({ id: 'w1' }),
    });

    expect(response.status).toBe(403);
  });

  it('returns 402 when workbook tier is not eligible for export', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      { id: 'w1', reportTierId: 'basic_preview', claimedByUserId: 'user_1' },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/workbook/w1/export'), {
      params: Promise.resolve({ id: 'w1' }),
    });

    expect(response.status).toBe(402);
  });

  it('returns 404 when PDF generator returns no buffer', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      { id: 'w1', reportTierId: 'workbook_self_guided', claimedByUserId: 'user_1' },
    ]);
    m.generateWorkbookPdf.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest('http://localhost/api/workbook/w1/export'), {
      params: Promise.resolve({ id: 'w1' }),
    });

    expect(response.status).toBe(404);
  });

  it('returns 503 when PDF generation throws', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      { id: 'w1', reportTierId: 'workbook_self_guided', claimedByUserId: 'user_1' },
    ]);
    m.generateWorkbookPdf.mockRejectedValueOnce(new Error('render failed'));

    const response = await GET(new NextRequest('http://localhost/api/workbook/w1/export'), {
      params: Promise.resolve({ id: 'w1' }),
    });

    expect(response.status).toBe(503);
    expect(m.logger.error).toHaveBeenCalled();
  });

  it('returns PDF attachment on success', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      { id: 'w1', reportTierId: 'workbook_self_guided', claimedByUserId: 'user_1' },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/workbook/w1/export'), {
      params: Promise.resolve({ id: 'w1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(response.headers.get('content-disposition')).toContain('governance-entropy-workbook-w1.pdf');
  });
});
