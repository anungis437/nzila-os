import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  trackLocation: vi.fn(),
  standardErrorResponse: vi.fn(),
  standardSuccessResponse: vi.fn(),
  tx: { marker: 'tx' },
  persistAtomicAudit: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: vi.fn(async () => 'org-1') }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_context: unknown, operation: (tx: unknown) => Promise<unknown>) => operation(m.tx),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));
vi.mock('@/services/geofence-privacy-service', () => ({
  GeofencePrivacyService: {
    trackLocation: m.trackLocation,
  },
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', VALIDATION_ERROR: 'VALIDATION_ERROR' },
  standardErrorResponse: m.standardErrorResponse,
  standardSuccessResponse: m.standardSuccessResponse,
}));

async function loadRoute() {
  return import('../location/track/route');
}
const SCOPE_ID = '11111111-1111-4111-8111-111111111111';
const trackingBody = (overrides: Record<string, unknown> = {}) => ({
  latitude: 45.5,
  longitude: -73.6,
  purpose: 'strike',
  scopeKind: 'strike',
  scopeId: SCOPE_ID,
  ...overrides,
});

describe('location/track route (PR #752 round 49 — self-service location-tracking IDOR fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => handler);
    m.getCurrentUser.mockResolvedValue({ id: 'caller-own-id' });
    m.trackLocation.mockResolvedValue({ id: 'location_1' });
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: code === 'AUTH_REQUIRED' ? 401 : 400 }));
    m.standardSuccessResponse.mockImplementation((data: unknown) => new Response(JSON.stringify(data), { status: 200 }));
  });

  it('POST tracks location for the authenticated caller using the verified scope', async () => {
    const { POST } = await loadRoute();

    await POST(new NextRequest('http://localhost/api/location/track', {
      method: 'POST',
      body: JSON.stringify(trackingBody()),
    }));

    expect(m.trackLocation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'caller-own-id' }),
      m.tx,
    );
    const callArg = m.trackLocation.mock.calls[0][0];
    expect(callArg).toMatchObject({ scopeKind: 'strike', scopeId: SCOPE_ID });
    // DEF-0B6-SYS-LOCATION-DELETION-LOG-FABRICATES-DATES-AND-HAS-NO-ORGANIZATION: the point carries the caller's server-resolved
    // organization, so its retention deletion is logged against that organization.
    expect(callArg.organizationId).toBe('org-1');
  });

  // DEF-0B8-JUR-LOCATION-TRACK-WRITES-ARE-UNAUDITED-AND-REFUSALS-ANSWER-500
  it('POST audits the recorded point on the same transaction without the coordinates', async () => {
    const { POST } = await loadRoute();

    await POST(new NextRequest('http://localhost/api/location/track', {
      method: 'POST',
      body: JSON.stringify(trackingBody()),
    }));

    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
    const [tx, record] = m.persistAtomicAudit.mock.calls[0]!;
    expect(tx).toBe(m.tx);
    expect(record).toMatchObject({ organizationId: 'org-1', userId: 'caller-own-id', action: 'location.track.record', resourceId: 'location_1' });
    expect(JSON.stringify(record)).not.toContain('45.5');
  });

  it('POST answers 403, not 500, for a member who has not opted in', async () => {
    const { POST } = await loadRoute();
    m.trackLocation.mockRejectedValueOnce(new Error('Location tracking requires explicit opt-in consent'));

    const response = await POST(new NextRequest('http://localhost/api/location/track', {
      method: 'POST',
      body: JSON.stringify(trackingBody()),
    }));

    expect(response.status).toBe(403);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST answers 503 while tracking is disabled, and 500 without internal text for any other failure', async () => {
    const { POST } = await loadRoute();
    const request = () => new NextRequest('http://localhost/api/location/track', {
      method: 'POST',
      body: JSON.stringify(trackingBody()),
    });
    m.trackLocation.mockRejectedValueOnce(new Error('Location tracking is globally disabled'));
    expect((await POST(request())).status).toBe(503);

    m.trackLocation.mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.0.5:5432'));
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('ECONNREFUSED');
  });

  it('POST returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/location/track', {
      method: 'POST',
      body: JSON.stringify(trackingBody()),
    }));

    expect(response.status).toBe(401);
    expect(m.trackLocation).not.toHaveBeenCalled();
  });

  it('POST refuses unapproved location purposes before calling the service', async () => {
    const { POST } = await loadRoute();
    for (const purpose of ['meeting', 'organizing']) {
      const response = await POST(new NextRequest('http://localhost/api/location/track', {
        method: 'POST', body: JSON.stringify(trackingBody({ purpose })),
      }));
      expect(response.status).toBe(400);
    }
    expect(m.trackLocation).not.toHaveBeenCalled();
  });

  it('POST refuses unverified strike and event associations without storing a point', async () => {
    const { POST } = await loadRoute();
    for (const [purpose, link] of [
      ['strike', { strikeId: '11111111-1111-4111-8111-111111111111' }],
      ['event', { eventId: '22222222-2222-4222-8222-222222222222' }],
    ] as const) {
      const response = await POST(new NextRequest('http://localhost/api/location/track', {
        method: 'POST',
        body: JSON.stringify({ latitude: 45.5, longitude: -73.6, purpose, ...link }),
      }));
      expect(response.status).toBe(400);
    }
    expect(m.trackLocation).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST returns validation error for invalid coordinates', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/location/track', {
      method: 'POST',
      body: JSON.stringify(trackingBody({ latitude: 999 })),
    }));

    expect(response.status).toBe(400);
    expect(m.trackLocation).not.toHaveBeenCalled();
  });
});
