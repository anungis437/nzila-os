import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => {
  const state = { selectQueue: [] as unknown[][] };
  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);
  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      orderBy: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      then: (resolve: (value: unknown[]) => unknown) => nextSelect().then(resolve),
    };
    return chain;
  };
  return {
    state,
    hasMinRole: vi.fn(),
    buildPilotReferenceVersionRecord: vi.fn(),
    buildProposalPackage: vi.fn(),
    normalizeCommercialState: vi.fn(),
    logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
    queueSelect: (...rows: unknown[][]) => state.selectQueue.push(...rows),
    reset: () => { state.selectQueue = []; },
    createSelectChain,
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
  update: vi.fn(() => ({
    set: vi.fn(() => ({ where: vi.fn(async () => []) })),
  })),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/api-auth-guard', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    hasMinRole: m.hasMinRole,
    withApiAuth: vi.fn((handler: (req: NextRequest, ctx?: any) => Promise<Response>) => (req: NextRequest, ctx?: any) => handler(req, ctx)),
  };
});
vi.mock('@/lib/pilot/commercialization-wave1', () => ({
  buildPilotReferenceVersionRecord: m.buildPilotReferenceVersionRecord,
  buildProposalPackage: m.buildProposalPackage,
  normalizeCommercialState: m.normalizeCommercialState,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));

async function loadRoute() {
  return import('../pilot/apply/[id]/reference-profile/route');
}

describe('pilot/apply/[id]/reference-profile route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.reset();
    m.hasMinRole.mockResolvedValue(true);
    m.normalizeCommercialState.mockReturnValue('proposal_ready');
    m.buildProposalPackage.mockReturnValue({
      generatedAt: '2026-06-11T00:00:00.000Z',
      qualificationScores: { opportunityTier: 'high', overallOpportunityScore: 80 },
      signals: { adoptionScore: 70, activityScore: 65, riskScore: 30, renewalLikelihood: 72, expansionLikelihood: 68 },
    });
    m.buildPilotReferenceVersionRecord.mockReturnValue({ versionId: 'ref_v1', checksum: 'chk_1' });
  });

  it('GET returns forbidden when caller lacks steward role', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/p1/reference-profile'), { params: { id: 'p1' } });
    expect(response.status).toBe(403);
  });

  it('GET returns 404 when pilot application is missing', async () => {
    const { GET } = await loadRoute();
    m.queueSelect([]);

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/p1/reference-profile'), { params: { id: 'p1' } });
    expect(response.status).toBe(404);
  });

  it('GET returns generated reference profile payload', async () => {
    const { GET } = await loadRoute();
    m.queueSelect(
      [{ id: 'p1', organizationName: 'Org One', organizationType: 'local', contactName: 'Casey', contactEmail: 'c@example.com', memberCount: 100, jurisdictions: [], sectors: [], currentSystem: 'legacy', challenges: [], goals: [], readinessScore: 70, responses: {} }],
      [{ pilotId: 'p1', organizerAdoptionRate: '75', memberEngagementRate: '62', healthScore: '80', casesManaged: 8, daysActive: 30, lastCalculated: new Date() }],
    );

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply/p1/reference-profile'), { params: Promise.resolve({ id: 'p1' }) });
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.referenceProfile.pilotId).toBe('p1');
  });

  it('POST skips persist when identical checksum already exists', async () => {
    const { POST } = await loadRoute();
    m.queueSelect(
      [{ id: 'p1', organizationName: 'Org One', organizationType: 'local', contactName: 'Casey', contactEmail: 'c@example.com', memberCount: 100, jurisdictions: [], sectors: [], currentSystem: 'legacy', challenges: [], goals: [], readinessScore: 70, responses: { pilotReferenceVersions: [{ checksum: 'chk_1', versionId: 'ref_old' }] } }],
      [{ pilotId: 'p1', lastCalculated: new Date() }],
    );

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/p1/reference-profile', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'manual' }),
    }), { params: { id: 'p1' } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.persisted).toBe(false);
  });

  it('POST persists new reference snapshot when checksum is new', async () => {
    const { POST } = await loadRoute();
    m.queueSelect(
      [{ id: 'p1', organizationName: 'Org One', organizationType: 'local', contactName: 'Casey', contactEmail: 'c@example.com', memberCount: 100, jurisdictions: [], sectors: [], currentSystem: 'legacy', challenges: [], goals: [], readinessScore: 70, responses: {} }],
      [{ pilotId: 'p1', lastCalculated: new Date() }],
    );

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/p1/reference-profile', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ source: 'manual', milestone: 'm1' }),
    }), { params: { id: 'p1' } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.persisted).toBe(true);
    expect(mockDb.update).toHaveBeenCalled();
  });
});
