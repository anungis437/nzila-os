import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';

const m = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      then: (resolve: (value: unknown[]) => unknown) => nextSelect().then(resolve),
    };
    return chain;
  };

  const createUpdateChain = () => ({
    set: vi.fn(() => ({
      where: vi.fn(async () => []),
    })),
  });

  return {
    state,
    queueSelect: (...results: unknown[][]) => state.selectQueue.push(...results),
    resetQueues: () => {
      state.selectQueue = [];
    },
    hasMinRole: vi.fn(),
    authorizePilotAccess: vi.fn(async () => ({ ok: true, reason: 'platform', actorOrganizationId: null })),
    getPilotVerifiedOrganizationId: vi.fn(() => TEST_ORG_ID),
    withSystemContext: vi.fn(async (fn: (db: unknown) => Promise<unknown>) => fn(mockDb)),
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    buildProposalPackage: vi.fn(),
    buildPilotArtifactVersionRecord: vi.fn(),
    inferPilotStatusFromCommercialState: vi.fn(),
    isCommercialTransitionAllowed: vi.fn(),
    normalizeCommercialState: vi.fn(),
    createSelectChain,
    createUpdateChain,
  };
});

const mockDb = {
  select: vi.fn(() => m.createSelectChain()),
  update: vi.fn(() => m.createUpdateChain()),
  insert: vi.fn(() => ({
    values: vi.fn(() => ({
      returning: vi.fn(async () => [{ id: 'generated-id' }]),
    })),
  })),
  transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb)),
};

vi.mock('@/db', () => ({ db: mockDb }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/pilot/pilot-ownership', () => ({
  // Access granted in unit tests; ownership is exercised by pilot-ownership.test.ts.
  enforcePilotOwnership: vi.fn(async () => null),
  wrapPilotItemRoute: <T,>(handler: T) => handler,
  authorizePilotAccess: m.authorizePilotAccess,
  getPilotClaimedOrganizationId: vi.fn(() => 'test-org'),
  getPilotVerifiedOrganizationId: m.getPilotVerifiedOrganizationId,
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: m.withSystemContext,
}));

vi.mock('@/lib/api-auth-guard', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    hasMinRole: m.hasMinRole,
    withApiAuth: vi.fn(
      (handler: (req: NextRequest, ctx?: { params?: { id: string } }) => Promise<Response>) =>
        (req: NextRequest, ctx?: { params?: { id: string } }) => handler(req, ctx)
    ),
  };
});

vi.mock('@/lib/pilot/commercialization-wave1', () => ({
  COMMERCIAL_STATE_ORDER: [
    'proposal_ready',
    'contract_sent',
    'contract_signed',
    'invoice_issued',
    'subscription_active',
  ],
  buildProposalPackage: m.buildProposalPackage,
  buildPilotArtifactVersionRecord: m.buildPilotArtifactVersionRecord,
  inferPilotStatusFromCommercialState: m.inferPilotStatusFromCommercialState,
  isCommercialTransitionAllowed: m.isCommercialTransitionAllowed,
  normalizeCommercialState: m.normalizeCommercialState,
}));

async function loadRoute() {
  return import('../pilot/apply/[id]/commercial-transition/route');
}

describe('pilot/apply/[id]/commercial-transition route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.resetQueues();
    m.hasMinRole.mockResolvedValue(true);
    m.authorizePilotAccess.mockResolvedValue({ ok: true, reason: 'platform', actorOrganizationId: null });
    m.getPilotVerifiedOrganizationId.mockReturnValue(TEST_ORG_ID);
    m.isCommercialTransitionAllowed.mockReturnValue(true);
    m.normalizeCommercialState.mockReturnValue('proposal_ready');
    m.inferPilotStatusFromCommercialState.mockReturnValue('approved');
    m.buildProposalPackage.mockReturnValue({
      generatedAt: '2026-06-11T00:00:00.000Z',
      economicsTier: { targetPriceRange: '$12K-$20K' },
      qualificationScores: {
        pilotFitScore: 70,
        pilotRiskScore: 35,
        pilotRevenueScore: 68,
        pilotReadinessScore: 66,
        pilotStrategicValueScore: 72,
        overallOpportunityScore: 69,
        opportunityTier: 'high',
      },
      artifacts: { package: 'v1' },
    });
    m.buildPilotArtifactVersionRecord.mockReturnValue({
      versionId: 'artifact-v1',
      checksum: 'checksum-v1',
    });
  });

  it('returns 403 when user lacks system_admin role', async () => {
    const { POST } = await loadRoute();
    m.hasMinRole.mockResolvedValueOnce(false);

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'contract_sent' }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ error: 'Forbidden' });
  });

  it('returns 403 when the ownership decision is same-org, not platform (PR #752 round 19 — billing requires platform-tier verification, not a self-attested claim)', async () => {
    const { POST } = await loadRoute();
    m.queueSelect([
      {
        id: 'app-1',
        organizationName: 'Union Eyes',
        organizationType: 'local',
        contactName: 'Casey',
        contactEmail: 'casey@example.com',
        memberCount: 250,
        jurisdictions: [],
        sectors: [],
        currentSystem: 'legacy',
        challenges: [],
        goals: [],
        readinessScore: 65,
        responses: { commercialState: 'proposal_ready', organizationId: TEST_ORG_ID },
      },
    ]);
    m.authorizePilotAccess.mockResolvedValueOnce({ ok: true, reason: 'same-org', actorOrganizationId: 'test-org' });

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'contract_sent' }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });

    expect(response.status).toBe(403);
  });

  it('returns 400 when route params are missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'contract_sent' }),
      headers: { 'content-type': 'application/json' },
    }), {});

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'Pilot application id is required' });
  });

  it('returns 400 for invalid target states', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'unknown_state' }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: 'A valid targetState is required' });
  });

  it('returns 404 when pilot application is not found', async () => {
    const { POST } = await loadRoute();
    m.queueSelect([]);

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'contract_sent' }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: 'Pilot application not found' });
  });

  it('returns 400 for disallowed state transitions when allowSkip is false', async () => {
    const { POST } = await loadRoute();
    m.queueSelect([
      {
        id: 'app-1',
        organizationName: 'Union Eyes',
        organizationType: 'local',
        contactName: 'Casey',
        contactEmail: 'casey@example.com',
        memberCount: 250,
        jurisdictions: [],
        sectors: [],
        currentSystem: 'legacy',
        challenges: [],
        goals: [],
        readinessScore: 65,
        responses: { commercialState: 'proposal_ready', organizationId: TEST_ORG_ID },
      },
    ]);
    m.normalizeCommercialState.mockReturnValueOnce('proposal_ready');
    m.isCommercialTransitionAllowed.mockReturnValueOnce(false);

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'invoice_issued' }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Invalid transition'),
      data: expect.objectContaining({ fromState: 'proposal_ready', targetState: 'invoice_issued' }),
    });
  });

  it('returns 409 (round 20) when the pilot organization has not been verified — never falls back to the claimed responses.organizationId', async () => {
    const { POST } = await loadRoute();
    m.getPilotVerifiedOrganizationId.mockReturnValueOnce(null);
    m.queueSelect([
      {
        id: 'app-1',
        reviewedAt: null,
        approvedAt: null,
        organizationName: 'Union Eyes',
        organizationType: 'local',
        contactName: 'Casey',
        contactEmail: 'casey@example.com',
        memberCount: 250,
        jurisdictions: [],
        sectors: [],
        currentSystem: 'legacy',
        challenges: [],
        goals: [],
        readinessScore: 65,
        responses: { commercialState: 'proposal_ready' },
      },
    ]);

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({
        targetState: 'contract_sent',
        allowSkip: true,
        reason: 'pilot uplift',
        source: 'test-suite',
      }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });

    expect(response.status).toBe(409);
    expect(mockDb.transaction).not.toHaveBeenCalled();
  });
});