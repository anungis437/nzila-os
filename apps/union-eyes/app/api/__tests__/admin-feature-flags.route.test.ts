import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withAdminAuth: vi.fn(),
  withSystemAdminAuth: vi.fn(),
  getAllFeatureFlags: vi.fn(),
  toggleFeatureFlag: vi.fn(),
  logApiAuditEvent: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withAdminAuth: m.withAdminAuth, withSystemAdminAuth: m.withSystemAdminAuth }));
vi.mock('@/lib/feature-flags', () => ({
  getAllFeatureFlags: m.getAllFeatureFlags,
  toggleFeatureFlag: m.toggleFeatureFlag,
}));
vi.mock('@/lib/middleware/api-security', () => ({ logApiAuditEvent: m.logApiAuditEvent }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', FORBIDDEN: 'FORBIDDEN' },
  standardErrorResponse: (code: string, message: string, details?: unknown) =>
    new Response(JSON.stringify({ code, message, details }), { status: code === 'FORBIDDEN' ? 403 : 400 }),
}));

async function loadRoute() {
  return import('../admin/feature-flags/route');
}

describe('admin/feature-flags route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules(); // PATCH/GET bind their guard at module-import time — a fresh import is needed per test to observe per-test mock implementations.
    m.withAdminAuth.mockImplementation(
      (handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, context),
    );
    m.withSystemAdminAuth.mockImplementation(
      (handler: (request: NextRequest, context: any) => Promise<Response>) =>
        (request: NextRequest, context: any = { userId: 'u1', organizationId: 'org_1' }) => handler(request, context),
    );
    m.getAllFeatureFlags.mockResolvedValue({ featureA: true, featureB: false });
    m.toggleFeatureFlag.mockResolvedValue(undefined);
  });

  it('GET returns feature flags', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/admin/feature-flags'), {
      userId: 'u1', organizationId: 'org_1',
    } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.featureA).toBe(true);
    expect(m.logApiAuditEvent).toHaveBeenCalled();
  });

  it('PATCH returns validation error for invalid JSON', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(new NextRequest('http://localhost/api/admin/feature-flags', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: 'not-json',
    }), { userId: 'u1', organizationId: 'org_1' } as any);

    expect(response.status).toBe(400);
  });

  it('PATCH returns validation error for invalid body', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(new NextRequest('http://localhost/api/admin/feature-flags', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '', enabled: 'yes' }),
    }), { userId: 'u1', organizationId: 'org_1' } as any);

    expect(response.status).toBe(400);
  });

  it('PATCH ignores extra orgId fields due to schema and still toggles', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(new NextRequest('http://localhost/api/admin/feature-flags', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'featureA', enabled: false, organizationId: 'org_2' }),
    }), { userId: 'u1', organizationId: 'org_1' } as any);

    expect(response.status).toBe(200);
    expect(m.toggleFeatureFlag).toHaveBeenCalledWith('featureA', false);
  });

  it('PATCH toggles feature flag and returns success', async () => {
    const { PATCH } = await loadRoute();
    const response = await PATCH(new NextRequest('http://localhost/api/admin/feature-flags', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'featureA', enabled: false }),
    }), { userId: 'u1', organizationId: 'org_1' } as any);

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(m.toggleFeatureFlag).toHaveBeenCalledWith('featureA', false);
  });

  it('PATCH is gated by withSystemAdminAuth, not the ordinary per-org withAdminAuth (round 51: feature_flags is platform-wide, an org admin must not flip it)', async () => {
    await loadRoute();
    expect(m.withSystemAdminAuth).toHaveBeenCalled();
    expect(m.withAdminAuth).toHaveBeenCalledTimes(1); // GET only
  });

  it('PATCH is rejected when withSystemAdminAuth denies (ordinary org admin, not a platform admin)', async () => {
    m.withSystemAdminAuth.mockImplementation(
      () => () => new Response(JSON.stringify({ error: 'Forbidden: System administrator privileges required' }), { status: 403 }),
    );
    const { PATCH } = await loadRoute();
    const response = await PATCH(new NextRequest('http://localhost/api/admin/feature-flags', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'featureA', enabled: false }),
    }), { userId: 'u1', organizationId: 'org_1' } as any);

    expect(response.status).toBe(403);
    expect(m.toggleFeatureFlag).not.toHaveBeenCalled();
  });

  it('PATCH rethrows toggle errors', async () => {
    const { PATCH } = await loadRoute();
    m.toggleFeatureFlag.mockRejectedValueOnce(new Error('toggle failed'));

    await expect(PATCH(new NextRequest('http://localhost/api/admin/feature-flags', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'featureA', enabled: false }),
    }), { userId: 'u1', organizationId: 'org_1' } as any)).rejects.toThrow('toggle failed');
  });
});
