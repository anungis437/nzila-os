import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  isClaimExpired: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
  selectQueue: [] as unknown[][],
  updateQueue: [] as unknown[][],
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}

const mockDb: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  update: vi.fn(() => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => undefined),
    })),
  })),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@/lib/icra/claim-tokens', () => ({ isClaimExpired: m.isClaimExpired }));
vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/db/schema/workbook-schema', () => ({ workbooks: {} }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, and: vi.fn(() => 'and'), eq: vi.fn(() => 'eq') };
});

async function loadRoute() {
  return import('../workbook/[id]/claim/route');
}

describe('workbook/[id]/claim route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.updateQueue = [];
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.isClaimExpired.mockReturnValue(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await POST(new NextRequest('http://localhost/api/workbook/wb1/claim', {
      method: 'POST', body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ id: 'wb1' }) });

    expect(response.status).toBe(401);
  });

  it('returns 400 for invalid json', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/workbook/wb1/claim', {
      method: 'POST', body: '{bad-json',
    }), { params: Promise.resolve({ id: 'wb1' }) });

    expect(response.status).toBe(400);
  });

  it('returns 422 for invalid token', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/workbook/wb1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'x' }),
    }), { params: Promise.resolve({ id: 'wb1' }) });

    expect(response.status).toBe(422);
  });

  it('returns 403 when org context is missing', async () => {
    const { POST } = await loadRoute();
    m.getOrganizationIdForUser.mockResolvedValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/workbook/wb1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ id: 'wb1' }) });

    expect(response.status).toBe(403);
  });

  it('returns 404 when workbook or token does not match', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(new NextRequest('http://localhost/api/workbook/wb1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ id: 'wb1' }) });

    expect(response.status).toBe(404);
  });

  it('returns 409 when workbook is already claimed', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'wb1', claimToken: 'valid_token_xxxx', claimedAt: new Date(), claimTokenExpiresAt: new Date(), reportTierId: 'brief' }]);

    const response = await POST(new NextRequest('http://localhost/api/workbook/wb1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ id: 'wb1' }) });

    expect(response.status).toBe(409);
  });

  it('claims workbook successfully', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'wb1', claimToken: 'valid_token_xxxx', claimedAt: null, claimTokenExpiresAt: new Date(Date.now() + 3600000), reportTierId: 'brief' }]);

    const response = await POST(new NextRequest('http://localhost/api/workbook/wb1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ id: 'wb1' }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.workbookId).toBe('wb1');
    expect(m.logger.info).toHaveBeenCalled();
  });

  it('returns 410 when claim token is expired', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'wb1', claimToken: 'valid_token_xxxx', claimedAt: null, claimTokenExpiresAt: new Date(Date.now() - 3600000), reportTierId: 'brief' }]);
    m.isClaimExpired.mockReturnValueOnce(true);

    const response = await POST(new NextRequest('http://localhost/api/workbook/wb1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ id: 'wb1' }) });

    expect(response.status).toBe(410);
  });

  it('returns 500 on database error during claim', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([{ id: 'wb1', claimToken: 'valid_token_xxxx', claimedAt: null, claimTokenExpiresAt: new Date(Date.now() + 3600000), reportTierId: 'brief' }]);
    mockDb.update.mockImplementationOnce(() => {
      throw new Error('db error');
    });

    const response = await POST(new NextRequest('http://localhost/api/workbook/wb1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ id: 'wb1' }) });

    expect(response.status).toBe(500);
    expect(m.logger.error).toHaveBeenCalled();
  });
});
