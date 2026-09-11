import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  requestLocationConsent: vi.fn(),
  hasValidConsent: vi.fn(),
  revokeLocationConsent: vi.fn(),
  standardErrorResponse: vi.fn(),
  standardSuccessResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser }));
vi.mock('@/services/geofence-privacy-service', () => ({
  GeofencePrivacyService: {
    requestLocationConsent: m.requestLocationConsent,
    hasValidConsent: m.hasValidConsent,
    revokeLocationConsent: m.revokeLocationConsent,
  },
}));
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
    m.requestLocationConsent.mockResolvedValue({ id: 'consent_1' });
    m.hasValidConsent.mockResolvedValue(true);
    m.revokeLocationConsent.mockResolvedValue(undefined);
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: code === 'AUTH_REQUIRED' ? 401 : 400 }));
    m.standardSuccessResponse.mockImplementation((data: unknown) => new Response(JSON.stringify(data), { status: 200 }));
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
    );
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

    expect(m.revokeLocationConsent).toHaveBeenCalledWith('caller-own-id', 'done');
  });
});
