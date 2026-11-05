import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withApiConfig: undefined as unknown,
  withSystemContext: vi.fn(),
  deleteExpiredLocationData: vi.fn(),
  expireLapsedConsents: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (config: unknown, handler: () => Promise<unknown>) => {
    m.withApiConfig = config;
    return async (_request: NextRequest) => {
      try {
        return new Response(JSON.stringify(await handler()), { status: 200 });
      } catch (error) {
        return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500 });
      }
    };
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/services/geofence-privacy-service', () => ({
  GeofencePrivacyService: { deleteExpiredLocationData: m.deleteExpiredLocationData, expireLapsedConsents: m.expireLapsedConsents },
}));

describe('cron/location-retention route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withSystemContext.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({ tx: true }));
  });

  it('is cron-authenticated and sweeps every member in one system-role transaction', async () => {
    m.deleteExpiredLocationData.mockResolvedValue({ trackingRecordsDeleted: 3, eventRecordsDeleted: 2 });
    m.expireLapsedConsents.mockResolvedValue({ consentsExpired: 1, consentsTruncated: false });
    const { GET, POST } = await import('../cron/location-retention/route') as { GET?: unknown; POST: (request: NextRequest) => Promise<Response> };
    expect((m.withApiConfig as { auth: unknown }).auth).toEqual({ cron: true });

    // A scheduler posts; a GET can never run the sweep (no GET export).
    expect(GET).toBeUndefined();
    for (const handler of [POST]) {
      const response = await handler(new NextRequest('http://localhost/api/cron/location-retention'));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ trackingRecordsDeleted: 3, eventRecordsDeleted: 2, consentsExpired: 1, consentsTruncated: false });
    // The lapse of expired consents is recorded in the same system transaction as the deletion.
    expect(m.expireLapsedConsents).toHaveBeenCalledWith({ tx: true });
    }
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    expect(m.deleteExpiredLocationData).toHaveBeenCalledWith({ tx: true });
  });

  it('reports failure instead of success when the deletion evidence cannot be written', async () => {
    m.deleteExpiredLocationData.mockRejectedValue(new Error('deletion log write failed'));
    const { POST } = await import('../cron/location-retention/route');
    const response = await POST(new NextRequest('http://localhost/api/cron/location-retention'));
    expect(response.status).toBe(500);
    expect((await response.json()).error).toContain('deletion log write failed');
  });
});
