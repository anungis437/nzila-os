import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHash } from 'crypto';

const TOKEN = 'test-capability-token';
const TOKEN_HASH = createHash('sha256').update(TOKEN, 'utf8').digest('hex');
const FUTURE = new Date(Date.now() + 60_000);
const ASSESSMENT_ID = '11111111-1111-1111-1111-111111111111';

const m = vi.hoisted(() => ({
  selectQueue: [] as unknown[][],
  generatePdfMock: vi.fn(),
  withSystemContext: vi.fn(),
  logger: { error: vi.fn() },
}));

function makeSelectChain(rows: unknown[]) {
  const chain: any = {
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => rows),
    orderBy: vi.fn(() => chain),
  };
  return chain;
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (fn: (tx: any) => Promise<unknown>) => {
    const tx = { select: vi.fn(() => makeSelectChain((m.selectQueue.shift() ?? []) as unknown[])) };
    return fn(tx);
  },
}));
vi.mock('@/db/schema/icra-schema', () => ({ icraAssessments: {}, icraMaturityProfiles: {} }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/icra/types', () => ({}));
vi.mock('@/lib/icra/org-context-mapper', () => ({ mapCtxToOrganizationContext: (x: any) => x }));
vi.mock('@/lib/icra-pdf/reportDataMapper', () => ({ mapToPdfReportData: () => ({ generatedAt: new Date() }) }));
vi.mock('@/lib/icra-pdf/generateExecutiveContinuityPdf', () => ({ generateExecutiveContinuityPdf: m.generatePdfMock }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: vi.fn(() => 'eq') };
});

function req(authorized = true) {
  const headers: Record<string, string> = {};
  if (authorized) headers.authorization = `Bearer ${TOKEN}`;
  return new Request(`http://localhost/api/icra/report/${ASSESSMENT_ID}`, { headers });
}

async function loadRoute() {
  return import('../icra/report/[assessmentId]/route');
}

describe('icra/report/[assessmentId] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.selectQueue = [];
    m.generatePdfMock.mockResolvedValue(Buffer.from('pdf-data'));
  });

  it('returns 400 for missing assessment id', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/icra/report/'), {
      params: Promise.resolve({ assessmentId: '' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid uuid format', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new Request('http://localhost/api/icra/report/not-a-uuid'), {
      params: Promise.resolve({ assessmentId: 'not-a-uuid' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns 404 when assessment not found', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([]);

    const response = await GET(req(), { params: Promise.resolve({ assessmentId: ASSESSMENT_ID }) });

    expect(response.status).toBe(404);
  });

  it('returns 401 when no capability token is presented', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      { id: 'a1', status: 'draft', reportTierId: 'executive_continuity_brief', organizationContext: {}, capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
    ]);

    const response = await GET(req(false), { params: Promise.resolve({ assessmentId: ASSESSMENT_ID }) });

    expect(response.status).toBe(401);
  });

  it('returns 422 when assessment not completed', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      { id: 'a1', status: 'draft', reportTierId: 'executive_continuity_brief', organizationContext: {}, capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
    ]);

    const response = await GET(req(), { params: Promise.resolve({ assessmentId: ASSESSMENT_ID }) });

    expect(response.status).toBe(422);
  });

  it('returns 403 when tier is not eligible for PDF', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push([
      { id: 'a1', status: 'completed', reportTierId: 'free_tier', organizationContext: {}, capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
    ]);

    const response = await GET(req(), { params: Promise.resolve({ assessmentId: ASSESSMENT_ID }) });

    expect(response.status).toBe(403);
  });

  it('returns pdf when assessment is complete, eligible, and the capability matches', async () => {
    const { GET } = await loadRoute();
    m.selectQueue.push(
      [{ id: 'a1', status: 'completed', reportTierId: 'executive_continuity_brief', organizationContext: {}, capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE }],
      [{ profilePayload: { dimensions: [], maturityBand: 'band_1' } }],
    );

    const response = await GET(req(), { params: Promise.resolve({ assessmentId: ASSESSMENT_ID }) });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/pdf');
  });
});
