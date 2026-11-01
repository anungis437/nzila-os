import { beforeEach, describe, expect, it, vi } from 'vitest';

// The route answers a path value that is not a UUID as not found, so the tests use a real identifier.
const A1 = '00000000-0000-4000-8000-0000000000a1';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  hasMinRole: vi.fn(),
  getCurrentUser: vi.fn(),
  isClaimExpired: vi.fn(),
  persistAtomicAudit: vi.fn(),
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

const mockTx: any = {
  select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])),
  update: vi.fn(() => {
    const chain: any = {
      set: vi.fn(() => chain),
      where: vi.fn(() => chain),
      returning: vi.fn(async () => (m.updateQueue.shift() ?? []) as unknown[]),
    };
    return chain;
  }),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
// Claiming needs an organization administrator (added after this test was written; disclosed).
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole, getCurrentUser: m.getCurrentUser }));
vi.mock('@/lib/icra/claim-tokens', () => ({ isClaimExpired: m.isClaimExpired }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: (fn: (tx: any) => Promise<unknown>) => fn(mockTx) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/db/schema/icra-schema', () => ({ icraAssessments: { claimEmail: 'claim_email' } }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    and: vi.fn(() => 'and'),
    eq: vi.fn(() => 'eq'),
    gt: vi.fn(() => 'gt'),
    isNull: vi.fn(() => 'isNull'),
    or: vi.fn(() => 'or'),
  };
});

async function loadRoute() {
  return import('../icra/[assessmentId]/claim/route');
}

describe('icra/[assessmentId]/claim route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.updateQueue = [];
    m.auth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.hasMinRole.mockResolvedValue(true);
    m.getCurrentUser.mockResolvedValue({ id: 'u1', email: 'Buyer@Example.com' });
    m.isClaimExpired.mockReturnValue(false);
    m.persistAtomicAudit.mockResolvedValue(undefined);
  });

  it('returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await POST(new NextRequest('http://localhost/api/icra/a1/claim', {
      method: 'POST', body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ assessmentId: A1 }) });

    expect(response.status).toBe(401);
  });

  it('refuses a member who is not an organization administrator and consumes nothing', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);
    const response = await POST(new NextRequest('http://localhost/api/icra/a1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ assessmentId: A1 }) });
    expect(response.status).toBe(403);
    expect(mockTx.update).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid json', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/a1/claim', {
      method: 'POST', body: '{bad-json',
    }), { params: Promise.resolve({ assessmentId: A1 }) });

    expect(response.status).toBe(400);
  });

  it('returns 422 for invalid claim token', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/a1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'short' }),
    }), { params: Promise.resolve({ assessmentId: A1 }) });

    expect(response.status).toBe(422);
  });

  it('returns 403 when org context is missing', async () => {
    const { POST } = await loadRoute();
    m.getOrganizationIdForUser.mockResolvedValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/icra/a1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ assessmentId: A1 }) });

    expect(response.status).toBe(403);
  });

  it('returns 404 when assessment or token does not match', async () => {
    const { POST } = await loadRoute();
    m.selectQueue.push([]);

    const response = await POST(new NextRequest('http://localhost/api/icra/a1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ assessmentId: A1 }) });

    expect(response.status).toBe(404);
  });

  it('returns 409 when assessment is already claimed', async () => {
    const { POST } = await loadRoute();
    m.updateQueue.push([]);
    m.selectQueue.push([{ id: A1, claimToken: 'valid_token_xxxx', claimedAt: new Date(), claimTokenExpiresAt: new Date() }]);

    const response = await POST(new NextRequest('http://localhost/api/icra/a1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ assessmentId: A1 }) });

    expect(response.status).toBe(409);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('returns 410 when claim token is expired', async () => {
    const { POST } = await loadRoute();
    m.updateQueue.push([]);
    m.selectQueue.push([{ id: A1, claimToken: 'valid_token_xxxx', claimedAt: null, claimTokenExpiresAt: new Date() }]);
    m.isClaimExpired.mockReturnValueOnce(true);

    const response = await POST(new NextRequest('http://localhost/api/icra/a1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ assessmentId: A1 }) });

    expect(response.status).toBe(410);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('claims assessment successfully with the audit on the same transaction', async () => {
    const { POST } = await loadRoute();
    m.updateQueue.push([{ id: A1 }]);

    const response = await POST(new NextRequest('http://localhost/api/icra/a1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ assessmentId: A1 }) });

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.organizationId).toBe('org_1');
    expect(m.logger.info).toHaveBeenCalled();
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'u1',
        action: 'icra.assessment.claim',
        resourceType: 'icra_assessments',
        resourceId: A1,
      }),
    );
  });

  // F06 A7: the claim is the purchaser's, not any organization administrator's who holds the token.
  const claim = async () => {
    const { POST } = await loadRoute();
    return POST(new NextRequest('http://localhost/api/icra/a1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ assessmentId: A1 }) });
  };

  it('refuses a caller with no verified account e-mail before anything is written', async () => {
    m.getCurrentUser.mockResolvedValueOnce({ id: 'u1', email: null });

    const response = await claim();

    expect(response.status).toBe(403);
    expect(mockTx.update).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('makes the purchaser e-mail part of the one conditional write, compared case-insensitively', async () => {
    m.updateQueue.push([{ id: A1 }]);

    const response = await claim();

    expect(response.status).toBe(200);
    const { and } = await import('drizzle-orm');
    const conditions = vi.mocked(and).mock.calls.flat();
    expect(JSON.stringify(conditions, (_key, value) => (typeof value === 'function' ? undefined : value))).toContain('buyer@example.com');
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(mockTx, expect.objectContaining({ details: expect.objectContaining({ purchaserEmailMatched: true }) }));
  });

  it.each([
    ['a different e-mail', 'someone-else@example.com'],
    ['no recorded purchaser', null],
  ])('refuses the token holder whose account has %s than the purchaser, consuming nothing', async (_label, claimEmail) => {
    m.updateQueue.push([]);
    m.selectQueue.push([{ id: A1, claimToken: 'valid_token_xxxx', claimedAt: null, claimTokenExpiresAt: null, claimEmail }]);

    const response = await claim();

    expect(response.status).toBe(403);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('fails the claim when its audit record cannot be written', async () => {
    const { POST } = await loadRoute();
    m.updateQueue.push([{ id: A1 }]);
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'));

    const response = await POST(new NextRequest('http://localhost/api/icra/a1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ assessmentId: A1 }) });

    expect(response.status).toBe(500);
  });

  it('returns 500 on database error during claim', async () => {
    const { POST } = await loadRoute();
    mockTx.update.mockImplementationOnce(() => {
      throw new Error('db error');
    });

    const response = await POST(new NextRequest('http://localhost/api/icra/a1/claim', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ claimToken: 'valid_token_xxxx' }),
    }), { params: Promise.resolve({ assessmentId: A1 }) });

    expect(response.status).toBe(500);
    expect(m.logger.error).toHaveBeenCalled();
  });
});
