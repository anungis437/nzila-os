import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  trackLocation: vi.fn(),
  standardErrorResponse: vi.fn(),
  standardSuccessResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser }));
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

  it('POST tracks location for the authenticated caller, ignoring a client-supplied userId in the body', async () => {
    const { POST } = await loadRoute();

    await POST(new NextRequest('http://localhost/api/location/track', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'attacker-supplied-victim-id',
        latitude: 45.5,
        longitude: -73.6,
        purpose: 'strike',
      }),
    }));

    expect(m.trackLocation).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'caller-own-id' }),
    );
    const callArg = m.trackLocation.mock.calls[0][0];
    expect(callArg.userId).not.toBe('attacker-supplied-victim-id');
  });

  it('POST returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/location/track', {
      method: 'POST',
      body: JSON.stringify({ latitude: 45.5, longitude: -73.6, purpose: 'strike' }),
    }));

    expect(response.status).toBe(401);
    expect(m.trackLocation).not.toHaveBeenCalled();
  });

  it('POST returns validation error for invalid coordinates', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/location/track', {
      method: 'POST',
      body: JSON.stringify({ latitude: 999, longitude: -73.6, purpose: 'strike' }),
    }));

    expect(response.status).toBe(400);
    expect(m.trackLocation).not.toHaveBeenCalled();
  });
});
