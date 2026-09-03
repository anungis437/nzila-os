import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const TEST_ORG_ID = '00000000-0000-0000-0000-000000000001';

const m = vi.hoisted(() => {
  const state = {
    selectQueue: [] as unknown[][],
    lockCalls: [] as Array<{ limit: number; mode: string }>,
  };

  const nextSelect = () => Promise.resolve((state.selectQueue.shift() ?? []) as unknown[]);

  const createSelectChain = () => {
    const chain = {
      from: vi.fn(() => chain),
      where: vi.fn(() => chain),
      limit: vi.fn((n: number) => ({
        for: vi.fn((mode: string) => {
          state.lockCalls.push({ limit: n, mode });
          return nextSelect();
        }),
      })),
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
      state.lockCalls = [];
    },
    hasMinRole: vi.fn(),
    authorizePilotAccess: vi.fn(async () => ({ ok: true, reason: 'platform', actorOrganizationId: null })),
    getPilotEffectiveOrganizationId: vi.fn(() => 'test-org'),
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
  getPilotEffectiveOrganizationId: m.getPilotEffectiveOrganizationId,
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
  buildPilotContractNumber: (pilotApplicationId: string) => `PILOT-${pilotApplicationId.slice(0, 8).toUpperCase()}`,
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
    m.getPilotEffectiveOrganizationId.mockReturnValue('test-org');
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
    const appRow = {
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
        reviewedAt: null,
        approvedAt: null,
        responses: { commercialState: 'proposal_ready', organizationId: TEST_ORG_ID },
    };
    // round 23: existence/authorization pre-check read, then the locked authoritative read
    m.queueSelect([appRow], [appRow]);
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
    const appRow = {
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
    };
    // round 23: this check now happens INSIDE the locked transaction, so the
    // transaction DOES get entered (and rolls back) rather than never starting.
    m.queueSelect([appRow], [appRow]);

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
    expect(mockDb.transaction).toHaveBeenCalledTimes(1);
  });

  it('round 22: locks the pilot row with SELECT ... FOR UPDATE before creating any financial artifact (concurrency hardening)', async () => {
    const { POST } = await loadRoute();
    m.queueSelect(
      [{ id: 'app-1' }], // round 23: existence/authorization pre-check read
      [
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
          reviewedAt: null,
          approvedAt: null,
          // round 25: commercial terms must be platform-approved before any
          // financial-artifact-creating transition.
          verifiedMemberCount: 250,
          verifiedPilotAmount: '12000.00',
          verifiedSubscriptionPlanId: null,
          responses: { commercialState: 'proposal_ready' },
        },
      ], // the locked authoritative read (round 23)
      [], // billing account lookup — none found, monetization staged only
    );

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'contract_sent' }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });

    expect(response.status).toBe(200);
    expect(m.state.lockCalls).toContainEqual({ limit: 1, mode: 'update' });
  });

  it('round 23: derives fromState from the row read INSIDE the lock, not the pre-check snapshot', async () => {
    const { POST } = await loadRoute();
    m.normalizeCommercialState.mockImplementation((v: unknown) => (typeof v === 'string' ? v : 'lead'));
    m.queueSelect(
      [{ id: 'app-1', responses: { commercialState: 'STALE_PRECHECK_STATE' }, verifiedOrganizationId: 'stale-org' }],
      [
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
          reviewedAt: null,
          approvedAt: null,
          // round 25: commercial terms must be platform-approved before any
          // financial-artifact-creating transition.
          verifiedMemberCount: 250,
          verifiedPilotAmount: '12000.00',
          verifiedSubscriptionPlanId: null,
          responses: { commercialState: 'FRESH_LOCKED_STATE' },
        },
      ],
      [], // billing account lookup
    );

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'contract_sent', allowSkip: true }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.fromState).toBe('FRESH_LOCKED_STATE');
    expect(m.normalizeCommercialState).toHaveBeenCalledWith('FRESH_LOCKED_STATE');
    expect(m.normalizeCommercialState).not.toHaveBeenCalledWith('STALE_PRECHECK_STATE');
  });

  it('round 25: rejects a financial-artifact-creating transition when commercial terms have not been approved', async () => {
    const { POST } = await loadRoute();
    m.queueSelect(
      [{ id: 'app-1' }],
      [
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
          reviewedAt: null,
          approvedAt: null,
          // No verifiedMemberCount/verifiedPilotAmount — terms never approved.
          verifiedMemberCount: null,
          verifiedPilotAmount: null,
          responses: { commercialState: 'proposal_ready' },
        },
      ],
    );

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'contract_sent' }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('Commercial terms have not been approved'),
    });
  });

  it('round 25: rejects subscription_active when no subscription plan has been approved, even with approved member count/amount', async () => {
    const { POST } = await loadRoute();
    m.normalizeCommercialState.mockReturnValueOnce('invoice_issued');
    m.queueSelect(
      [{ id: 'app-1' }],
      [
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
          reviewedAt: null,
          approvedAt: null,
          verifiedMemberCount: 250,
          verifiedPilotAmount: '12000.00',
          verifiedSubscriptionPlanId: null,
          responses: { commercialState: 'invoice_issued' },
        },
      ],
    );

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'subscription_active', allowSkip: true }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('No approved subscription plan'),
    });
  });

  it('round 25: uses the platform-approved verifiedPilotAmount, never a client-supplied member count or responses.subscriptionPlanId, for a financial transition', async () => {
    const { POST } = await loadRoute();
    m.queueSelect(
      [{ id: 'app-1' }],
      [
        {
          id: 'app-1',
          organizationName: 'Union Eyes',
          organizationType: 'local',
          contactName: 'Casey',
          contactEmail: 'casey@example.com',
          // Applicant/steward-controlled memberCount claims a huge org —
          // must NOT influence the amount actually invoiced.
          memberCount: 999999,
          jurisdictions: [],
          sectors: [],
          currentSystem: 'legacy',
          challenges: [],
          goals: [],
          readinessScore: 65,
          reviewedAt: null,
          approvedAt: null,
          verifiedMemberCount: 250,
          verifiedPilotAmount: '12000.00',
          verifiedSubscriptionPlanId: null,
          // Attacker-style stray key — must never be read for billing.
          responses: { commercialState: 'proposal_ready', subscriptionPlanId: 'attacker-chosen-plan' },
        },
      ],
      [{ id: 'billing-account-1' }], // billing account lookup — found
      [], // existingContract lookup — none found, triggers insert
    );

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'contract_sent' }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });

    expect(response.status).toBe(200);
    const insertCall = mockDb.insert.mock.results[0]?.value as { values: ReturnType<typeof vi.fn> } | undefined;
    expect(insertCall?.values).toHaveBeenCalledWith(
      expect.objectContaining({ totalContractValue: '12000.00' }),
    );
  });

  it('round 26: revalidates the approved subscription plan is still active AT ACTIVATION TIME, staging only when it is not', async () => {
    const { POST } = await loadRoute();
    m.normalizeCommercialState.mockReturnValueOnce('invoice_issued');
    m.queueSelect(
      [{ id: 'app-1' }],
      [
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
          reviewedAt: null,
          approvedAt: null,
          verifiedMemberCount: 250,
          verifiedPilotAmount: '12000.00',
          verifiedSubscriptionPlanId: 'plan-x',
          responses: { commercialState: 'invoice_issued' },
        },
      ],
      [{ id: 'billing-account-1' }], // billing account lookup — found
      [{ id: 'plan-x', isActive: false }], // plan revalidation — no longer active
    );

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'subscription_active', allowSkip: true }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.monetization.subscriptionId).toBeUndefined();
    expect(payload.data.monetization.notes).toContainEqual(expect.stringMatching(/no longer active/));
  });

  it('round 26: activates the subscription when the approved plan is still active', async () => {
    const { POST } = await loadRoute();
    m.normalizeCommercialState.mockReturnValueOnce('invoice_issued');
    m.queueSelect(
      [{ id: 'app-1' }],
      [
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
          reviewedAt: null,
          approvedAt: null,
          verifiedMemberCount: 250,
          verifiedPilotAmount: '12000.00',
          verifiedSubscriptionPlanId: 'plan-x',
          responses: { commercialState: 'invoice_issued' },
        },
      ],
      [{ id: 'billing-account-1' }], // billing account lookup — found
      [{ id: 'plan-x', isActive: true }], // plan revalidation — still active
      [], // existing subscription lookup — none found, triggers insert
    );

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'subscription_active', allowSkip: true }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.monetization.subscriptionId).toBe('generated-id');
  });
});