import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    getCurrentUser: vi.fn(),
    persistAtomicAudit: vi.fn(),
    recordDenial: vi.fn(async () => true),
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
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
// The denial record is written in its own transaction after the rollback; its own behaviour is proven in lib/pilot/__tests__/acceptance-denial.test.ts.
vi.mock('@/lib/pilot/acceptance-denial', () => ({ recordAcceptanceDenial: m.recordDenial }));

vi.mock('@/lib/api-auth-guard', async (orig) => {
  const actual = await orig<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    hasMinRole: m.hasMinRole,
    getCurrentUser: m.getCurrentUser,
    withApiAuth: vi.fn(
      (handler: (req: NextRequest, ctx?: { params?: { id: string } }) => Promise<Response>) =>
        (req: NextRequest, ctx?: { params?: { id: string } }) => handler(req, ctx)
    ),
  };
});

vi.mock('@/lib/pilot/commercialization-wave1', () => ({
  COMMERCIAL_STATE_ORDER: [
    'proposal_ready',
    'approved',
    'contract_sent',
    'contract_signed',
    'invoice_issued',
    'pilot_active',
    'pilot_complete',
    'subscription_offered',
    'subscription_active',
  ],
  buildProposalPackage: m.buildProposalPackage,
  buildPilotArtifactVersionRecord: m.buildPilotArtifactVersionRecord,
  buildPilotContractNumber: (pilotApplicationId: string) => `PILOT-${pilotApplicationId.slice(0, 8).toUpperCase()}`,
  buildCommercialTermsSnapshot: (input: Record<string, unknown>) => ({
    snapshot: {
      ...input,
      commercialTermsApprovedAt:
        input.commercialTermsApprovedAt instanceof Date
          ? input.commercialTermsApprovedAt.toISOString()
          : input.commercialTermsApprovedAt,
    },
    fingerprint: 'test-fingerprint',
  }),
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
    m.getCurrentUser.mockResolvedValue({ id: 'platform-admin-1', role: 'system_admin' });
    m.persistAtomicAudit.mockResolvedValue(undefined);
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
          commercialTermsApprovedBy: 'admin-1',
          commercialTermsApprovedAt: new Date('2026-01-01T00:00:00.000Z'),
          responses: { commercialState: 'proposal_ready' },
        },
      ], // the locked authoritative read (round 23)
      [{ id: 'billing-account-1' }], // billing account lookup — found
      [], // existing contract lookup — none, so one is created
    );

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'contract_sent' }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });

    expect(response.status).toBe(200);
    expect(m.state.lockCalls).toContainEqual({ limit: 1, mode: 'update' });
  });

  describe('atomic audit', () => {
    const lockedRow = {
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
      commercialTermsApprovedBy: 'admin-1',
      commercialTermsApprovedAt: new Date('2026-01-01T00:00:00.000Z'),
      responses: { commercialState: 'proposal_ready' },
    };
    const call = async () => {
      const { POST } = await loadRoute();
      return POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
        method: 'POST',
        body: JSON.stringify({ targetState: 'contract_sent', reason: 'sent to the union' }),
        headers: { 'content-type': 'application/json' },
      }), { params: { id: 'app-1' } });
    };

    it('records the transition on the same transaction under the verified organization, attributed to the actor', async () => {
      m.queueSelect([{ id: 'app-1' }], [lockedRow], [{ id: 'billing-account-1' }], []);

      const response = await call();

      expect(response.status).toBe(200);
      expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          organizationId: TEST_ORG_ID,
          userId: 'platform-admin-1',
          action: 'pilot.commercial_transition',
          resourceType: 'pilot_applications',
          resourceId: 'app-1',
          details: expect.objectContaining({ fromState: 'proposal_ready', targetState: 'contract_sent', reason: 'sent to the union' }),
        }),
      );
    });

    it('fails the transition when its audit cannot be written, so no contract or state change commits', async () => {
      m.queueSelect([{ id: 'app-1' }], [lockedRow], [{ id: 'billing-account-1' }], []);
      m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'));

      const response = await call();

      expect(response.status).toBe(500);
    });

    it('writes no audit for a rejected transition', async () => {
      m.queueSelect([{ id: 'app-1' }], [{ ...lockedRow, verifiedMemberCount: null }], []);

      const response = await call();

      expect(response.status).toBe(409);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('refuses an unauthenticated actor before touching the database', async () => {
      m.getCurrentUser.mockResolvedValueOnce(null);

      const response = await call();

      expect(response.status).toBe(401);
      expect(m.withSystemContext).not.toHaveBeenCalled();
    });
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
          commercialTermsApprovedBy: 'admin-1',
          commercialTermsApprovedAt: new Date('2026-01-01T00:00:00.000Z'),
          responses: { commercialState: 'FRESH_LOCKED_STATE' },
        },
      ],
      [{ id: 'billing-account-1' }], // billing account lookup — found
      [], // existing contract lookup — none, so one is created
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

  it('round 28: rejects a financial transition when verifiedMemberCount/Amount are set but commercialTermsApprovedBy/At are still null (partially populated/drifted row)', async () => {
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
          verifiedMemberCount: 250,
          verifiedPilotAmount: '12000.00',
          verifiedSubscriptionPlanId: null,
          // Drifted/partially-populated row: approver/timestamp never set.
          commercialTermsApprovedBy: null,
          commercialTermsApprovedAt: null,
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
          commercialTermsApprovedBy: 'admin-1',
          commercialTermsApprovedAt: new Date('2026-01-01T00:00:00.000Z'),
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
          commercialTermsApprovedBy: 'admin-1',
          commercialTermsApprovedAt: new Date('2026-01-01T00:00:00.000Z'),
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

  it('round 27: stamps an immutable commercial-terms snapshot/fingerprint into the created contract metadata', async () => {
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
          verifiedMemberCount: 250,
          verifiedPilotAmount: '12000.00',
          verifiedSubscriptionPlanId: null,
          commercialTermsApprovedBy: 'admin-1',
          commercialTermsApprovedAt: new Date('2026-01-01T00:00:00.000Z'),
          responses: { commercialState: 'proposal_ready' },
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
      expect.objectContaining({
        metadata: expect.objectContaining({
          commercialTermsSnapshot: expect.objectContaining({
            verifiedMemberCount: 250,
            verifiedPilotAmount: '12000.00',
            commercialTermsApprovedBy: 'admin-1',
          }),
          commercialTermsFingerprint: 'test-fingerprint',
        }),
      }),
    );
  });

  it('round 26: revalidates the approved subscription plan is still active AT ACTIVATION TIME and refuses (creating nothing) when it is not', async () => {
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
          commercialTermsApprovedBy: 'admin-1',
          commercialTermsApprovedAt: new Date('2026-01-01T00:00:00.000Z'),
          responses: { commercialState: 'invoice_issued' },
        },
      ],
      [{ id: 'billing-account-1' }], // billing account lookup — found
      [{ id: 'contract-1', status: 'active', metadata: { counterpartAcceptance: { verificationDetail: { status: 'provider_verified' } } } }], // the contract's stored acceptance (F06 final hardening: read from the contract, verified)
      [{ id: 'plan-x', isActive: false }], // plan revalidation — no longer active
    );

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
      method: 'POST',
      body: JSON.stringify({ targetState: 'subscription_active', allowSkip: true }),
      headers: { 'content-type': 'application/json' },
    }), { params: { id: 'app-1' } });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toMatch(/no longer active/);
    expect(mockDb.insert).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
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
          commercialTermsApprovedBy: 'admin-1',
          commercialTermsApprovedAt: new Date('2026-01-01T00:00:00.000Z'),
          responses: { commercialState: 'invoice_issued' },
        },
      ],
      [{ id: 'billing-account-1' }], // billing account lookup — found
      [{ id: 'contract-1', status: 'active', metadata: { counterpartAcceptance: { verificationDetail: { status: 'provider_verified' } } } }], // the contract's stored acceptance (F06 final hardening: read from the contract, verified)
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

  describe('F06 A4: truthful outcomes - an effect that was not performed is never recorded as done', () => {
    const row = {
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
      commercialTermsApprovedBy: 'admin-1',
      commercialTermsApprovedAt: new Date('2026-01-01T00:00:00.000Z'),
      responses: { commercialState: 'contract_sent' },
    };
    const acceptance = {
      acceptedByName: 'Pat Counterpart',
      acceptedByRole: 'President',
      channel: 'countersigned_document',
      evidenceReference: 'doc-123',
    };
    const post = async (body: Record<string, unknown>) => {
      const { POST } = await loadRoute();
      return POST(new NextRequest('http://localhost/api/pilot/apply/app-1/commercial-transition', {
        method: 'POST',
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
      }), { params: { id: 'app-1' } });
    };
    const updatedWith = () => mockDb.update.mock.results.map((r) => (r.value as { set: ReturnType<typeof vi.fn> }).set);

    // An acceptance policy that someone with authority has approved to accept an administrator's recorded statement. The shipped policy is
    // unapproved and refuses it; these tests exercise what the route does once the institution has decided otherwise.
    const approvedOperatorPolicy = async () => {
      const { COUNTERPART_ACCEPTANCE_POLICY } = await import('@/lib/pilot/counterpart-acceptance');
      COUNTERPART_ACCEPTANCE_POLICY.activationRequires = 'operator_recorded';
      COUNTERPART_ACCEPTANCE_POLICY.approvedBy = 'test-approver';
    };
    afterEach(async () => {
      const { COUNTERPART_ACCEPTANCE_POLICY, clearAcceptanceVerifiers } = await import('@/lib/pilot/counterpart-acceptance');
      COUNTERPART_ACCEPTANCE_POLICY.activationRequires = 'provider_verified';
      COUNTERPART_ACCEPTANCE_POLICY.approvedBy = null;
      clearAcceptanceVerifiers();
    });

    it.each(['contract_sent', 'invoice_issued'])('refuses %s when the organization has no billing account and creates nothing', async (targetState) => {
      m.queueSelect([{ id: 'app-1' }], [row], []);

      const response = await post({ targetState, allowSkip: true });
      const payload = await response.json();

      expect(response.status).toBe(409);
      expect(payload.error).toMatch(/no billing account/);
      expect(mockDb.insert).not.toHaveBeenCalled();
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('requires counterpart acceptance evidence for contract_signed before touching the database', async () => {
      const response = await post({ targetState: 'contract_signed' });

      expect(response.status).toBe(400);
      expect(m.withSystemContext).not.toHaveBeenCalled();
    });

    it('refuses contract_signed when there is no contract to accept', async () => {
      m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], []);

      const response = await post({ targetState: 'contract_signed', counterpartAcceptance: acceptance });

      expect(response.status).toBe(409);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('refuses contract_signed for a contract that is expired or still a draft', async () => {
      m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], [{ id: 'c-1', status: 'expired', metadata: {} }]);

      const response = await post({ targetState: 'contract_signed', counterpartAcceptance: acceptance });

      expect(response.status).toBe(409);
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    it('records who accepted for the other party, how, and who recorded it when the contract is accepted (under an approved operator-recorded policy)', async () => {
      await approvedOperatorPolicy();
      m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], [{ id: 'c-1', status: 'pending_approval', metadata: { source: 'x' } }]);

      const response = await post({ targetState: 'contract_signed', counterpartAcceptance: acceptance });

      expect(response.status).toBe(200);
      const contractUpdate = updatedWith()[0];
      expect(contractUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'active',
          signedBy: 'Pat Counterpart',
          metadata: expect.objectContaining({
            source: 'x',
            counterpartAcceptance: expect.objectContaining({
              channel: 'countersigned_document',
              evidenceReference: 'doc-123',
              recordedBy: 'platform-admin-1',
              verification: 'recorded_by_platform_operator',
            }),
          }),
        }),
      );
      expect(m.persistAtomicAudit).toHaveBeenCalledWith(
        mockDb,
        expect.objectContaining({
          details: expect.objectContaining({ counterpartAcceptanceChannel: 'countersigned_document' }),
        }),
      );
      expect(JSON.stringify(m.persistAtomicAudit.mock.calls[0])).not.toContain('Pat Counterpart');
    });

    it('does not overwrite the acceptance record when the transition is replayed on an accepted contract', async () => {
      m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], [{ id: 'c-1', status: 'active', metadata: {} }]);

      const response = await post({ targetState: 'contract_signed', counterpartAcceptance: acceptance });

      expect(response.status).toBe(200);
      expect(updatedWith().some((s) => s.mock.calls.some((c) => (c[0] as { status?: string }).status === 'active'))).toBe(false);
    });

    it('refuses to issue an invoice when no accepted contract exists', async () => {
      m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], []);

      const response = await post({ targetState: 'invoice_issued', allowSkip: true });
      const payload = await response.json();

      expect(response.status).toBe(409);
      expect(payload.error).toMatch(/accepted contract/);
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('issues the invoice when an accepted contract with verified acceptance exists', async () => {
      m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], [{ id: 'c-1', status: 'active', metadata: { counterpartAcceptance: { verificationDetail: { status: 'provider_verified' } } } }]);

      const response = await post({ targetState: 'invoice_issued', allowSkip: true });

      expect(response.status).toBe(200);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it.each(['approved', 'pilot_active', 'pilot_complete'])('does not write a %s status from the state name alone when commercial terms were never approved', async (targetState) => {
      m.queueSelect([{ id: 'app-1' }], [{ ...row, commercialTermsApprovedBy: null, commercialTermsApprovedAt: null }]);

      const response = await post({ targetState, allowSkip: true });

      expect(response.status).toBe(409);
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(m.persistAtomicAudit).not.toHaveBeenCalled();
    });

    const verifiedContract = { id: 'c-1', status: 'active', metadata: { counterpartAcceptance: { verificationDetail: { status: 'provider_verified' } } } };
    const legacyUnverifiedContract = { id: 'c-1', status: 'active', metadata: { counterpartAcceptance: { verification: 'recorded_by_platform_operator' } } };

    // F06 R5 / final hardening: the evidence level of the counterpart's acceptance is a stored fact that every downstream effect carries, and
    // the unapproved policy does not let an administrator's statement stand in for verification.
    describe('counterpart acceptance evidence', () => {
      const acceptanceModule = () => import('@/lib/pilot/counterpart-acceptance');

      it('ships fail-closed: the policy is unapproved and requires verification, and "operator_recorded" alone is not honoured without an approver', async () => {
        const { COUNTERPART_ACCEPTANCE_POLICY, acceptanceMaySupport } = await acceptanceModule();
        expect(COUNTERPART_ACCEPTANCE_POLICY).toMatchObject({ approvedBy: null, activationRequires: 'provider_verified' });
        COUNTERPART_ACCEPTANCE_POLICY.activationRequires = 'operator_recorded';
        expect(acceptanceMaySupport('x', 'operator_recorded_unverified').allowed).toBe(false);
      });

      it('refuses to activate a contract on an administrator\'s statement by default, keeps the claim as a claim, and records the refusal', async () => {
        const { COUNTERPART_ACCEPTANCE_POLICY } = await acceptanceModule();
        m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], [{ id: 'c-1', status: 'pending_approval', metadata: {} }]);

        const response = await post({ targetState: 'contract_signed', counterpartAcceptance: acceptance });
        const payload = await response.json();

        expect(response.status).toBe(409);
        expect(payload.blockedOperation).toEqual({
          operation: 'pilot.commercial.contract_signed',
          requires: 'provider_verified_acceptance',
          policyVersion: COUNTERPART_ACCEPTANCE_POLICY.version,
          policyApprovedBy: null,
          evidence: 'operator_recorded_unverified',
        });
        expect(payload.denialRecorded).toBe(true);
        expect(mockDb.update).not.toHaveBeenCalled();
        expect(mockDb.insert).not.toHaveBeenCalled();
        expect(m.persistAtomicAudit).not.toHaveBeenCalled();
        // The refusal, and the claim as evidence that it was made, are written on their own after the rollback.
        expect(m.recordDenial).toHaveBeenCalledWith(
          expect.objectContaining({ organizationId: TEST_ORG_ID, applicationId: 'app-1', targetState: 'contract_signed', contractId: 'c-1', claim: acceptance }),
          'platform-admin-1',
        );
      });

      it('still refuses, and says the refusal could not be recorded, when the denial record fails', async () => {
        m.recordDenial.mockResolvedValueOnce(false);
        m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], [{ id: 'c-1', status: 'pending_approval', metadata: {} }]);

        const response = await post({ targetState: 'contract_signed', counterpartAcceptance: acceptance });

        expect(response.status).toBe(409);
        expect((await response.json()).denialRecorded).toBe(false);
        expect(mockDb.update).not.toHaveBeenCalled();
      });

      it('stores the claimed channel as a claim and the evidence level as unverified, with the policy that applied and its approval state (under an approved operator-recorded policy)', async () => {
        await approvedOperatorPolicy();
        m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], [{ id: 'c-1', status: 'pending_approval', metadata: {} }]);

        const response = await post({ targetState: 'contract_signed', counterpartAcceptance: { ...acceptance, channel: 'e_signature_provider' } });
        const payload = await response.json();

        expect(response.status).toBe(200);
        expect(payload.data.monetization.acceptanceEvidence).toBe('operator_recorded_unverified');
        expect(updatedWith()[0]).toHaveBeenCalledWith(expect.objectContaining({
          metadata: expect.objectContaining({
            counterpartAcceptance: expect.objectContaining({
              channel: 'e_signature_provider',
              verification: 'recorded_by_platform_operator',
              verificationDetail: { status: 'operator_recorded_unverified', reason: 'no_verifier_registered_for_channel' },
              policyApprovedBy: 'test-approver',
            }),
          }),
        }));
      });

      it('activates the contract as provider-verified when a registered verifier confirms the reference, before the transaction opens', async () => {
        const { registerAcceptanceVerifier } = await acceptanceModule();
        const verify = vi.fn(async () => ({ verified: true, providerReference: 'env-42' }));
        registerAcceptanceVerifier('e_signature_provider', { provider: 'test-provider', verify });
        m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], [{ id: 'c-1', status: 'pending_approval', metadata: {} }]);

        const response = await post({ targetState: 'contract_signed', counterpartAcceptance: { ...acceptance, channel: 'e_signature_provider' } });

        expect(response.status).toBe(200);
        expect(verify).toHaveBeenCalledTimes(1);
        expect(updatedWith()[0]).toHaveBeenCalledWith(expect.objectContaining({
          metadata: expect.objectContaining({
            counterpartAcceptance: expect.objectContaining({ verification: 'provider_verified', verificationDetail: expect.objectContaining({ status: 'provider_verified', provider: 'test-provider', providerReference: 'env-42' }) }),
          }),
        }));
      });

      it.each([
        ['throws', async () => { throw new Error('provider down'); }],
        ['declines', async () => ({ verified: false })],
      ])('leaves the acceptance unverified, not failed, when the verifier %s, and so refuses by default', async (_name, verify) => {
        const { registerAcceptanceVerifier } = await acceptanceModule();
        registerAcceptanceVerifier('e_signature_provider', { provider: 'down', verify });
        m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], [{ id: 'c-1', status: 'pending_approval', metadata: {} }]);

        const response = await post({ targetState: 'contract_signed', counterpartAcceptance: { ...acceptance, channel: 'e_signature_provider' } });

        expect(response.status).toBe(409);
        expect((await response.json()).blockedOperation).toMatchObject({ evidence: 'operator_recorded_unverified' });
        expect(mockDb.update).not.toHaveBeenCalled();
      });

      it('refuses an invoice on a contract whose acceptance is unverified, naming the standing, and issues it on a verified one', async () => {
        m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], [legacyUnverifiedContract]);
        const refused = await post({ targetState: 'invoice_issued', allowSkip: true });
        const payload = await refused.json();
        expect(refused.status).toBe(409);
        expect(payload.blockedOperation).toMatchObject({ operation: 'pilot.commercial.invoice_issued', evidence: 'operator_recorded_unverified' });
        expect(payload.acceptanceStanding.standing).toBe('activated_on_unverified_acceptance');
        expect(mockDb.insert).not.toHaveBeenCalled();
        expect(m.recordDenial).toHaveBeenCalledWith(expect.objectContaining({ targetState: 'invoice_issued', contractId: 'c-1' }), 'platform-admin-1');

        vi.clearAllMocks();
        m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], [verifiedContract]);
        const issued = await post({ targetState: 'invoice_issued', allowSkip: true });
        expect(issued.status).toBe(200);
        expect(mockDb.insert.mock.results.some((r) => JSON.stringify((r.value as { values: ReturnType<typeof vi.fn> }).values.mock.calls).includes('"acceptanceEvidence":"provider_verified"'))).toBe(true);
      });

      it('stamps the invoice as operator-recorded when an approved policy accepts it, and refuses it once the policy is unapproved again', async () => {
        await approvedOperatorPolicy();
        m.queueSelect([{ id: 'app-1' }], [row], [{ id: 'billing-account-1' }], [legacyUnverifiedContract]);
        const issued = await post({ targetState: 'invoice_issued', allowSkip: true });
        expect(issued.status).toBe(200);
        expect(mockDb.insert.mock.results.some((r) => JSON.stringify((r.value as { values: ReturnType<typeof vi.fn> }).values.mock.calls).includes('"acceptanceEvidence":"operator_recorded_unverified"'))).toBe(true);
      });
    });

    // Final hardening: the states after the contract is signed rest on the acceptance too. None of them used to look for it.
    describe('states that rest on the counterpart\'s acceptance', () => {
      const stateRow = { ...row, responses: { commercialState: 'invoice_issued' } };

      it.each(['pilot_active', 'pilot_complete', 'subscription_offered'])('refuses %s when there is no contract at all, and writes no status', async (targetState) => {
        m.queueSelect([{ id: 'app-1' }], [stateRow], [{ id: 'billing-account-1' }], []);

        const response = await post({ targetState, allowSkip: true });
        const payload = await response.json();

        expect(response.status).toBe(409);
        expect(payload.blockedOperation).toMatchObject({ operation: `pilot.commercial.${targetState}`, evidence: 'none' });
        expect(payload.acceptanceStanding.standing).toBe('no_acceptance');
        expect(mockDb.update).not.toHaveBeenCalled();
        expect(m.persistAtomicAudit).not.toHaveBeenCalled();
        expect(m.recordDenial).toHaveBeenCalledWith(expect.objectContaining({ targetState, contractId: null }), 'platform-admin-1');
      });

      it('refuses to advance the pilot on a contract that was activated under the earlier permissive default, and leaves that contract as it is', async () => {
        m.queueSelect([{ id: 'app-1' }], [stateRow], [{ id: 'billing-account-1' }], [legacyUnverifiedContract]);

        const response = await post({ targetState: 'pilot_active' });
        const payload = await response.json();

        expect(response.status).toBe(409);
        expect(payload.acceptanceStanding.standing).toBe('activated_on_unverified_acceptance');
        expect(mockDb.update).not.toHaveBeenCalled();
      });

      it('refuses a contract that only has an acceptance claim recorded on it', async () => {
        m.queueSelect([{ id: 'app-1' }], [stateRow], [{ id: 'billing-account-1' }], [{ id: 'c-1', status: 'pending_approval', metadata: { acceptanceClaims: [{ standing: 'unverified_claim' }] } }]);

        const response = await post({ targetState: 'pilot_active' });

        expect(response.status).toBe(409);
        expect((await response.json()).acceptanceStanding).toMatchObject({ standing: 'awaiting_verified_acceptance', claimsRecorded: 1 });
      });

      it('lets the pilot run on a provider-verified acceptance', async () => {
        m.queueSelect([{ id: 'app-1' }], [stateRow], [{ id: 'billing-account-1' }], [verifiedContract]);

        const response = await post({ targetState: 'pilot_active' });

        expect(response.status).toBe(200);
        expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
      });

      it('does not refuse a move back to an earlier state, which is not an advance', async () => {
        m.normalizeCommercialState.mockReturnValueOnce('pilot_complete');
        m.queueSelect([{ id: 'app-1' }], [{ ...stateRow, responses: { commercialState: 'pilot_complete' } }], [{ id: 'billing-account-1' }]);

        const response = await post({ targetState: 'pilot_active' });

        expect(response.status).toBe(200);
      });

      it('reads the subscription\'s acceptance from the contract, not from the pilot\'s own responses record', async () => {
        const forged = { ...stateRow, responses: { commercialState: 'invoice_issued', commercialMonetization: { acceptanceEvidence: 'provider_verified' } } };
        m.queueSelect([{ id: 'app-1' }], [forged], [{ id: 'billing-account-1' }], [legacyUnverifiedContract]);

        const response = await post({ targetState: 'subscription_active', allowSkip: true });

        expect(response.status).toBe(409);
        expect((await response.json()).blockedOperation).toMatchObject({ operation: 'pilot.commercial.subscription_active', evidence: 'operator_recorded_unverified' });
        expect(mockDb.insert).not.toHaveBeenCalled();
      });
    });
  });
});