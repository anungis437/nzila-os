import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  requestLocationConsent: vi.fn(),
  hasValidConsent: vi.fn(),
  revokeLocationConsent: vi.fn(),
  eraseLocationData: vi.fn(),
  persistAtomicAudit: vi.fn(),
  standardErrorResponse: vi.fn(),
  standardSuccessResponse: vi.fn(),
  tx: { marker: 'tx' },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(m.tx)),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/services/geofence-privacy-service', () => {
  class LocationConsentConflictError extends Error {}
  class LocationConsentNotFoundError extends Error {}
  return {
    LocationConsentConflictError,
    LocationConsentNotFoundError,
    GeofencePrivacyService: {
      requestLocationConsent: m.requestLocationConsent,
      hasValidConsent: m.hasValidConsent,
      revokeLocationConsent: m.revokeLocationConsent,
      eraseLocationData: m.eraseLocationData,
    },
  };
});
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', VALIDATION_ERROR: 'VALIDATION_ERROR' },
  standardErrorResponse: m.standardErrorResponse,
  standardSuccessResponse: m.standardSuccessResponse,
}));

async function loadRoute() {
  return import('../location/consent/route');
}

describe('location/consent route (PR #752 round 17 — self-service consent IDOR fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => handler);
    m.getCurrentUser.mockResolvedValue({ id: 'caller-own-id' });
    m.getOrganizationIdForUser.mockResolvedValue('org-1');
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.requestLocationConsent.mockResolvedValue({ id: 'consent_1' });
    m.hasValidConsent.mockResolvedValue(true);
    m.revokeLocationConsent.mockResolvedValue({ consentId: 'consent_1' });
    m.eraseLocationData.mockResolvedValue({ total: 0, trackingRecordsDeleted: 0, eventRecordsDeleted: 0 });
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: code === 'AUTH_REQUIRED' ? 401 : 400 }));
    m.standardSuccessResponse.mockImplementation((data: unknown) => new Response(JSON.stringify(data), { status: 200 }));
  });

  // DEF-0B8-JUR-LOCATION-CONSENT-TEXT-AND-PURPOSE-ARE-CLIENT-SUPPLIED-AND-UNVALIDATED
  it('POST refuses a body whose allowance flag is not a boolean or whose text is empty, recording no consent', async () => {
    const { POST } = await loadRoute();
    const base = { purpose: 'strike', purposeDescription: 'desc', consentText: 'I agree' };
    for (const extra of [{ allowedDuringStrike: 'false' }, { allowedDuringEvents: 1 }, { consentText: '' }]) {
      const response = await POST(new NextRequest('http://localhost/api/location/consent', { method: 'POST', body: JSON.stringify({ ...base, ...extra }) }));
      expect(response.status).toBe(400);
    }
    const response = await POST(new NextRequest('http://localhost/api/location/consent', { method: 'POST', body: 'not json' }));
    expect(response.status).toBe(400);
    expect(m.requestLocationConsent).not.toHaveBeenCalled();
  });

  it('POST grants consent for the authenticated caller, ignoring a client-supplied userId in the body', async () => {
    const { POST } = await loadRoute();

    await POST(new NextRequest('http://localhost/api/location/consent', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'attacker-supplied-victim-id',
        purpose: 'strike line tracking',
        purposeDescription: 'desc',
        consentText: 'I agree',
      }),
    }));

    expect(m.requestLocationConsent).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'caller-own-id' }),
      m.tx,
    );
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ organizationId: 'org-1', userId: 'caller-own-id', action: 'location.consent.grant', resourceId: 'consent_1' }),
    );
  });

  it('POST fails the grant when its audit cannot be written, so no consent is left behind', async () => {
    const { POST } = await loadRoute();
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await POST(new NextRequest('http://localhost/api/location/consent', {
      method: 'POST',
      body: JSON.stringify({ purpose: 'p', purposeDescription: 'd', consentText: 'I agree' }),
    }));

    expect(response.status).toBe(500);
  });

  it('POST answers 409 when the member already has an active consent', async () => {
    const { POST } = await loadRoute();
    const { LocationConsentConflictError } = await import('@/services/geofence-privacy-service');
    m.requestLocationConsent.mockRejectedValueOnce(new LocationConsentConflictError('User already has active location consent'));

    const response = await POST(new NextRequest('http://localhost/api/location/consent', {
      method: 'POST',
      body: JSON.stringify({ purpose: 'p', purposeDescription: 'd', consentText: 'I agree' }),
    }));

    expect(response.status).toBe(409);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('POST returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/location/consent', { method: 'POST', body: '{}' }));
    expect(response.status).toBe(401);
    expect(m.requestLocationConsent).not.toHaveBeenCalled();
  });

  it('GET checks consent status only for the authenticated caller, ignoring a client-supplied ?userId=', async () => {
    const { GET } = await loadRoute();

    await GET(new NextRequest('http://localhost/api/location/consent?userId=attacker-supplied-victim-id&context=strike'));

    expect(m.hasValidConsent).toHaveBeenCalledWith('caller-own-id', 'strike');
  });

  it('DELETE revokes consent only for the authenticated caller, ignoring a client-supplied ?userId=', async () => {
    const { DELETE } = await loadRoute();

    await DELETE(new NextRequest('http://localhost/api/location/consent?userId=attacker-supplied-victim-id&reason=done'));

    expect(m.revokeLocationConsent).toHaveBeenCalledWith('caller-own-id', 'done', m.tx);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ userId: 'caller-own-id', action: 'location.consent.revoke', resourceId: 'consent_1' }),
    );
  });

  it('DELETE still erases the member\'s location data when there is no active consent to revoke, and audits the erasure', async () => {
    const { DELETE } = await loadRoute();
    const { LocationConsentNotFoundError } = await import('@/services/geofence-privacy-service');
    m.revokeLocationConsent.mockRejectedValueOnce(new LocationConsentNotFoundError());
    m.eraseLocationData.mockResolvedValueOnce({ total: 3, trackingRecordsDeleted: 2, eventRecordsDeleted: 1 });

    const response = await DELETE(new NextRequest('http://localhost/api/location/consent?reason=gdpr'));

    expect(response.status).toBe(200);
    expect(m.eraseLocationData).toHaveBeenCalledWith('caller-own-id', m.tx);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({
      userId: 'caller-own-id', action: 'location.data.erase',
      details: expect.objectContaining({ trackingRecordsDeleted: 2, eventRecordsDeleted: 1 }),
    }));
    expect((await response.json()).message).toContain('No active location consent');
  });

  it('DELETE answers 404 and writes no audit when there is no consent to revoke', async () => {
    const { DELETE } = await loadRoute();
    const { LocationConsentNotFoundError } = await import('@/services/geofence-privacy-service');
    m.revokeLocationConsent.mockRejectedValueOnce(new LocationConsentNotFoundError());

    const response = await DELETE(new NextRequest('http://localhost/api/location/consent'));

    expect(response.status).toBe(404);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });
});
