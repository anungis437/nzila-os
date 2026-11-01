import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { opaqueRef } from '@/lib/icra/opaque-ref';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
  updateQueue: [] as unknown[][],
  selectQueue: [] as unknown[][],
  withSystemContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.checkRateLimit }));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
  };
  return chain;
}

function makeUpdateChain(rows: unknown[]) {
  const chain: any = {
    set: vi.fn(() => chain),
    where: vi.fn(() => chain),
    returning: vi.fn(async () => rows),
  };
  return chain;
}

const mockTx: any = {
  update: vi.fn(() => makeUpdateChain(m.updateQueue.shift() ?? [])),
  select: vi.fn(() => makeSelectChain(m.selectQueue.shift() ?? [])),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/db/schema/workbook-schema', () => ({ workbooks: {} }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: vi.fn(() => 'and'),
    eq: vi.fn(() => 'eq'),
    gt: vi.fn(() => 'gt'),
    isNull: vi.fn(() => 'isNull'),
  };
});

async function loadRoute() {
  return import('../workbook/[id]/claim/route');
}

function claimRequest(claimToken = 'valid_claim_token_123') {
  return new NextRequest('http://localhost/api/workbook/w1/claim', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ claimToken }),
  });
}

async function postClaim(claimToken?: string) {
  const { POST } = await loadRoute();
  return POST(claimRequest(claimToken), { params: Promise.resolve({ id: 'w1' }) });
}

describe('workbook/[id]/claim route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 60 });
    m.updateQueue = [];
    m.selectQueue = [];
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.withSystemContext.mockImplementation((fn: (tx: any) => Promise<unknown>) => fn(mockTx));
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  it('records the claim audit on the same transaction, attributed to the claimant organization', async () => {
    m.updateQueue.push([{ id: 'w1' }]);

    const response = await postClaim();

    expect(response.status).toBe(200);
    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'u1',
        action: 'workbook.claim',
        resourceType: 'workbooks',
        resourceId: 'w1',
      }),
    );
  });

  it('fails the claim when its audit record cannot be written', async () => {
    m.updateQueue.push([{ id: 'w1' }]);
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'));

    const response = await postClaim();

    expect(response.status).toBe(500);
  });

  it('writes no audit when nothing was claimed', async () => {
    m.updateQueue.push([]);
    m.selectQueue.push([]);

    const response = await postClaim();

    expect(response.status).toBe(404);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await postClaim();

    expect(response.status).toBe(401);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid json', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/workbook/w1/claim', {
      method: 'POST',
      body: '{bad-json',
    }), { params: Promise.resolve({ id: 'w1' }) });

    expect(response.status).toBe(400);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('returns 422 for an invalid token', async () => {
    const response = await postClaim('x');

    expect(response.status).toBe(422);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('returns 403 when organization context is missing', async () => {
    m.getOrganizationIdForUser.mockResolvedValueOnce(null);

    const response = await postClaim();

    expect(response.status).toBe(403);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('claims the workbook with one trusted conditional mutation', async () => {
    m.updateQueue.push([{ id: 'w1' }]);

    const response = await postClaim();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      workbookId: 'w1',
      organizationId: 'org_1',
    });
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    expect(mockTx.update).toHaveBeenCalledTimes(1);
    expect(mockTx.select).not.toHaveBeenCalled();
    expect(m.logger.info).toHaveBeenCalledWith(
      '[workbook-claim] Workbook claimed',
      { workbookRef: opaqueRef('w1'), userId: 'u1', orgId: 'org_1' },
    );
  });

  it('returns 404 when the workbook or token does not match', async () => {
    m.updateQueue.push([]);
    m.selectQueue.push([]);

    const response = await postClaim();

    expect(response.status).toBe(404);
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    expect(mockTx.update).toHaveBeenCalledTimes(1);
    expect(mockTx.select).toHaveBeenCalledTimes(1);
  });

  it('returns 409 when token-scoped diagnosis finds an already claimed workbook', async () => {
    m.updateQueue.push([]);
    m.selectQueue.push([{ claimedAt: new Date(), claimTokenExpiresAt: new Date() }]);

    const response = await postClaim();

    expect(response.status).toBe(409);
  });

  it('returns 410 when token-scoped diagnosis finds an expired claim', async () => {
    m.updateQueue.push([]);
    m.selectQueue.push([{ claimedAt: null, claimTokenExpiresAt: new Date(0) }]);

    const response = await postClaim();

    expect(response.status).toBe(410);
  });

  it('returns a privacy-preserving 404 when a concurrent winner has consumed the token', async () => {
    m.updateQueue.push([]);
    m.selectQueue.push([]);

    const response = await postClaim();

    expect(response.status).toBe(404);
    expect(mockTx.update).toHaveBeenCalledTimes(1);
    expect(mockTx.select).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when the trusted claim transaction fails', async () => {
    m.withSystemContext.mockRejectedValueOnce(new Error('db error'));

    const response = await postClaim();

    expect(response.status).toBe(500);
    expect(m.logger.error).toHaveBeenCalledWith(
      '[workbook-claim] Claim failed',
      { workbookRef: opaqueRef('w1'), err: expect.any(Error) },
    );
  });

  // DEF-0B12-WBK-CLAIM-HAS-NO-RATE-LIMIT-AND-READS-AN-UNCAPPED-BODY
  it('rate limits claim attempts and never reads the body of a refused request', async () => {
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 120 });
    const response = await postClaim();
    expect(response.status).toBe(429);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  it('refuses an oversized body with 413 before parsing it', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/workbook/w1/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claimToken: 'x'.repeat(20_000) }),
    }), { params: Promise.resolve({ id: 'w1' }) });
    expect(response.status).toBe(413);
    expect(m.withSystemContext).not.toHaveBeenCalled();
  });

  // DEF-0B12-WBK-ROUTES-LOG-THE-BEARER-WORKBOOK-ID
  it('logs an opaque reference for the workbook, never the identifier that acts as a capability', async () => {
    m.updateQueue.push([{ id: 'w1' }]);
    await postClaim();
    const logged = JSON.stringify(m.logger.info.mock.calls);
    expect(logged).not.toContain('"w1"');
    expect(logged).toContain(opaqueRef('w1'));
  });
});
