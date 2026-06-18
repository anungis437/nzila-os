import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  db: { select: vi.fn() },
  withSystemContext: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('@/db/db', () => ({ db: m.db }));
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

  it('POST creates assessment and returns 201', async () => {
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
    expect(payload).toEqual({ assessmentId: 'assessment_1' });
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
    const { GET } = await loadRoute();
    const limit = vi.fn(async () => []);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    m.db.select.mockReturnValue({ from });

    const response = await GET(new NextRequest('http://localhost/api/icra/start?assessmentId=a1'));

    expect(response.status).toBe(404);
  });

  it('GET returns assessment payload when found', async () => {
    const { GET } = await loadRoute();
    const limit = vi.fn(async () => [{ id: 'a1' }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    m.db.select.mockReturnValue({ from });

    const response = await GET(new NextRequest('http://localhost/api/icra/start?assessmentId=a1'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ assessment: { id: 'a1' } });
  });
});
