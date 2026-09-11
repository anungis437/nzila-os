import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';

const TOKEN = 'test-capability-token';
const TOKEN_HASH = createHash('sha256').update(TOKEN, 'utf8').digest('hex');
const FUTURE = new Date(Date.now() + 60_000);

const m = vi.hoisted(() => ({
  withSystemContext: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: m.eq };
});
vi.mock('@/db/schema/icra-schema', () => ({
  icraAssessments: { id: 'id' },
  icraOrganizations: { id: 'id' },
}));

async function loadRoute() {
  return import('../icra/start/route');
}

function mockGetSelect(rows: unknown[]) {
  m.withSystemContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
    const tx = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({ limit: vi.fn(async () => rows) })),
        })),
      })),
    };
    return fn(tx);
  });
}

describe('icra/start route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.eq.mockReturnValue('eq');
    m.withSystemContext.mockImplementation(async (fn: (tx: any) => Promise<unknown>) => {
      let insertCount = 0;
      const tx = {
        insert: vi.fn(() => ({
          values: vi.fn(() => ({
            returning: vi.fn(async () => {
              insertCount += 1;
              if (insertCount === 1) return [{ id: 'org_1' }];
              return [{ id: 'assessment_1' }];
            }),
          })),
        })),
      };
      return fn(tx);
    });
  });

  it('POST returns 400 for invalid payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: 12 }),
    }));

    expect(response.status).toBe(400);
  });

  it('POST creates assessment, returns 201 with a capability token, and sets the issuance cookie', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        locale: 'en-CA',
        organizationContext: { name: 'Org', sector: 'public', jurisdiction: 'ON' },
        consent: {
          acknowledgedAntiSurveillance: true,
          acknowledgedDataHandling: true,
          acknowledgedExplainability: true,
        },
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.assessmentId).toBe('assessment_1');
    expect(typeof payload.capabilityToken).toBe('string');
    expect(payload.capabilityToken.length).toBeGreaterThan(20);
    expect(response.headers.get('set-cookie')).toContain('icra_cap_assessment_1=');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(m.logger.info).toHaveBeenCalled();
  });

  it('POST returns 500 when start transaction fails', async () => {
    const { POST } = await loadRoute();
    m.withSystemContext.mockRejectedValueOnce(new Error('db down'));

    const response = await POST(new NextRequest('http://localhost/api/icra/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: 'en-CA' }),
    }));

    expect(response.status).toBe(500);
  });

  it('GET returns 400 when assessmentId is missing', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/icra/start'));

    expect(response.status).toBe(400);
  });

  it('GET returns 404 when assessment does not exist', async () => {
    mockGetSelect([]);
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/icra/start?assessmentId=a1', {
      headers: { authorization: `Bearer ${TOKEN}` },
    }));

    expect(response.status).toBe(404);
  });

  it('GET returns 401 when no capability token is presented', async () => {
    mockGetSelect([
      { id: 'a1', status: 'in_progress', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
    ]);
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/icra/start?assessmentId=a1'));

    expect(response.status).toBe(401);
  });

  it('GET returns 401 when the presented capability token does not match', async () => {
    mockGetSelect([
      { id: 'a1', status: 'in_progress', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
    ]);
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/icra/start?assessmentId=a1', {
      headers: { authorization: 'Bearer wrong-token' },
    }));

    expect(response.status).toBe(401);
  });

  it('GET returns a bounded DTO (never the raw row) when the capability matches', async () => {
    mockGetSelect([
      {
        id: 'a1',
        status: 'in_progress',
        locale: 'en-CA',
        organizationContext: { name: 'Org' },
        questionBankVersion: 1,
        doctrineVersion: '1.0.0',
        reportTierId: 'continuity_reflection',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        submittedAt: null,
        capabilityTokenHash: TOKEN_HASH,
        capabilityTokenExpiresAt: FUTURE,
        // Sensitive fields that must NEVER appear in the response:
        stripePaymentRef: 'pi_secret',
        claimEmail: 'someone@example.com',
        claimToken: 'super-secret-claim-token',
        claimTokenExpiresAt: FUTURE,
        claimedByUserId: 'user_123',
        claimedOrgId: 'org_456',
      },
    ]);
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/icra/start?assessmentId=a1', {
      headers: { authorization: `Bearer ${TOKEN}` },
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.assessment.id).toBe('a1');
    expect(payload.assessment.status).toBe('in_progress');
    const keys = Object.keys(payload.assessment);
    expect(keys).not.toContain('stripePaymentRef');
    expect(keys).not.toContain('claimEmail');
    expect(keys).not.toContain('claimToken');
    expect(keys).not.toContain('claimTokenExpiresAt');
    expect(keys).not.toContain('claimedByUserId');
    expect(keys).not.toContain('claimedOrgId');
    expect(keys).not.toContain('capabilityTokenHash');
    expect(keys).not.toContain('capabilityTokenExpiresAt');
  });
});
