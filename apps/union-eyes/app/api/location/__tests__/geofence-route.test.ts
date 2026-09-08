import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  createGeofence: vi.fn(),
  checkGeofenceEntry: vi.fn(),
  standardErrorResponse: vi.fn(),
  standardSuccessResponse: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth, getCurrentUser: m.getCurrentUser }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@/services/geofence-privacy-service', () => ({
  GeofencePrivacyService: {
    createGeofence: m.createGeofence,
    checkGeofenceEntry: m.checkGeofenceEntry,
  },
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', VALIDATION_ERROR: 'VALIDATION_ERROR' },
  standardErrorResponse: m.standardErrorResponse,
  standardSuccessResponse: m.standardSuccessResponse,
}));

async function loadRoute() {
  return import('../geofence/route');
}

describe('location/geofence route (round 52 — tenant/identity IDOR fix)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => handler);
    m.getCurrentUser.mockResolvedValue({ id: 'caller-own-id' });
    m.getOrganizationIdForUser.mockResolvedValue('caller-org');
    m.createGeofence.mockResolvedValue({ id: 'g1' });
    m.checkGeofenceEntry.mockResolvedValue({ inside: true, distance: 1 });
    m.standardErrorResponse.mockImplementation((code: string, message: string) =>
      new Response(JSON.stringify({ code, message }), { status: code === 'AUTH_REQUIRED' ? 401 : 400 }));
    m.standardSuccessResponse.mockImplementation((data: unknown) => new Response(JSON.stringify(data), { status: 200 }));
  });

  it('POST creates a geofence scoped to the caller\'s own org, ignoring a client-supplied unionLocalId', async () => {
    const { POST } = await loadRoute();

    await POST(new NextRequest('http://localhost/api/location/geofence', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Strike Line',
        geofenceType: 'strike_line',
        centerLatitude: 45.5,
        centerLongitude: -73.6,
        radiusMeters: 50,
        unionLocalId: 'attacker-supplied-other-org',
      }),
    }));

    expect(m.createGeofence).toHaveBeenCalledWith(
      expect.not.objectContaining({ unionLocalId: expect.anything() }),
      'caller-org',
    );
  });

  it('POST returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);

    const response = await POST(new NextRequest('http://localhost/api/location/geofence', {
      method: 'POST',
      body: JSON.stringify({ name: 'Hall', geofenceType: 'union_hall', centerLatitude: 45.5, centerLongitude: -73.6, radiusMeters: 50 }),
    }));

    expect(response.status).toBe(401);
    expect(m.createGeofence).not.toHaveBeenCalled();
  });

  it('GET checks entry for the authenticated caller, ignoring a client-supplied userId query param', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest(
      'http://localhost/api/location/geofence?userId=attacker-supplied-victim-id&geofenceId=g1&latitude=45.5&longitude=-73.6',
    ));

    expect(m.checkGeofenceEntry).toHaveBeenCalledWith('caller-own-id', 45.5, -73.6, 'g1', 'caller-org');
    const json = await response.json();
    expect(json.userId).toBe('caller-own-id');
  });

  it('GET returns 401 when unauthenticated', async () => {
    const { GET } = await loadRoute();
    m.getCurrentUser.mockResolvedValueOnce(null);

    const response = await GET(new NextRequest(
      'http://localhost/api/location/geofence?geofenceId=g1&latitude=45.5&longitude=-73.6',
    ));

    expect(response.status).toBe(401);
    expect(m.checkGeofenceEntry).not.toHaveBeenCalled();
  });
});
