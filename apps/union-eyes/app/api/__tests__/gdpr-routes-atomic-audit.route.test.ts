import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  createDataAccessRequest: vi.fn(),
  updateRequestStatus: vi.fn(),
  notifyDataAccessRequest: vi.fn(),
  saveCookieConsent: vi.fn(),
  getReportQueue: vi.fn(),
  queueAdd: vi.fn(),
  persistAtomicAudit: vi.fn(),
  guardPublicIntake: vi.fn(),
  orgRows: [] as unknown[],
  tx: {} as Record<string, unknown>,
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withApiAuth: (handler: unknown) => handler,
  getCurrentUser: m.getCurrentUser,
}));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (t: unknown) => Promise<unknown>) => fn(m.tx)),
  withSystemContext: vi.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(m.tx)),
}));
vi.mock('@/lib/public-intake/guard', () => ({ guardPublicIntake: m.guardPublicIntake }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/gdpr/consent-manager', () => {
  class CookieConsentOwnershipError extends Error {}
  return {
    CookieConsentOwnershipError,
    CookieConsentManager: { saveCookieConsent: m.saveCookieConsent, getCookieConsent: vi.fn() },
    GdprRequestManager: {
      createDataAccessRequest: m.createDataAccessRequest,
      updateRequestStatus: m.updateRequestStatus,
      notifyDataAccessRequest: m.notifyDataAccessRequest,
      getUserRequests: vi.fn(),
    },
  };
});
vi.mock('@/lib/job-queue', () => ({ getReportQueue: m.getReportQueue }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/db/schema', () => ({ organizations: { id: 'id' } }));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => 'eq') }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', VALIDATION_ERROR: 'VALIDATION_ERROR', INTERNAL_ERROR: 'INTERNAL_ERROR', MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD', RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND' },
  standardErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ code, message }), { status: code === 'AUTH_REQUIRED' ? 401 : code === 'INTERNAL_ERROR' ? 500 : 400 }),
  standardSuccessResponse: (data: unknown) => new Response(JSON.stringify(data), { status: 200 }),
}));

const ORG = '11111111-1111-4111-8111-111111111111';
const OTHER_ORG = '22222222-2222-4222-8222-222222222222';
const CONSENT_ID = '33333333-3333-4333-8333-333333333333';

const post = (path: string, body: unknown) =>
  new NextRequest(`http://localhost/api/gdpr/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('gdpr/data-export POST', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getCurrentUser.mockResolvedValue({ id: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue(ORG);
    m.createDataAccessRequest.mockResolvedValue({ id: 'req1' });
    m.updateRequestStatus.mockResolvedValue({ id: 'req1' });
    m.notifyDataAccessRequest.mockResolvedValue(undefined);
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.queueAdd.mockResolvedValue(undefined);
    m.getReportQueue.mockReturnValue({ add: m.queueAdd });
  });

  it('files the request for the caller\u2019s own data: request, status and audit on one transaction, then the notification and the queue', async () => {
    const { POST } = await import('../gdpr/data-export/route');
    const response = await POST(post('data-export', { organizationId: ORG }), { organizationId: ORG });

    expect(response.status).toBe(200);
    expect(m.createDataAccessRequest).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1', organizationId: ORG }), m.tx);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ organizationId: ORG, userId: 'u1', action: 'gdpr.data_export.request', resourceId: 'req1' }),
    );
    expect(m.notifyDataAccessRequest).toHaveBeenCalled();
    expect(m.queueAdd).toHaveBeenCalledWith('gdpr-export', expect.objectContaining({ userId: 'u1', organizationId: ORG }), expect.anything());
  });

  it('refuses a request for an organization other than the caller\u2019s active one', async () => {
    const { POST } = await import('../gdpr/data-export/route');
    const response = await POST(post('data-export', { organizationId: OTHER_ORG }), { organizationId: ORG });

    expect(response.status).toBe(403);
    expect(m.createDataAccessRequest).not.toHaveBeenCalled();
  });

  it('resolves the active organization itself when the context carries none, rather than trusting the body', async () => {
    const { POST } = await import('../gdpr/data-export/route');
    const response = await POST(post('data-export', { organizationId: OTHER_ORG }), {});

    expect(response.status).toBe(403);
    expect(m.getOrganizationIdForUser).toHaveBeenCalledWith('u1');
  });

  it('files nothing and queues nothing when the audit cannot be written', async () => {
    const { POST } = await import('../gdpr/data-export/route');
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await POST(post('data-export', { organizationId: ORG }), { organizationId: ORG });

    expect(response.status).toBe(500);
    expect(m.queueAdd).not.toHaveBeenCalled();
    expect(m.notifyDataAccessRequest).not.toHaveBeenCalled();
  });

  it('rejects the request, with its own audit record, when the export service is unavailable', async () => {
    const { POST } = await import('../gdpr/data-export/route');
    m.getReportQueue.mockReturnValue(null);

    const response = await POST(post('data-export', { organizationId: ORG }), { organizationId: ORG });

    expect(response.status).toBe(500);
    expect(m.updateRequestStatus).toHaveBeenCalledWith('req1', ORG, 'rejected', expect.anything(), m.tx);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ action: 'gdpr.data_export.reject' }));
  });

  it('rejects the request, with its own audit record, when the job cannot be queued', async () => {
    const { POST } = await import('../gdpr/data-export/route');
    m.queueAdd.mockRejectedValueOnce(new Error('redis down'));

    const response = await POST(post('data-export', { organizationId: ORG }), { organizationId: ORG });

    expect(response.status).toBe(500);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ action: 'gdpr.data_export.reject' }));
  });
});

describe('gdpr/cookie-consent POST (public)', () => {
  const body = { consentId: CONSENT_ID, organizationId: ORG, analytics: true };

  beforeEach(() => {
    vi.clearAllMocks();
    m.getCurrentUser.mockResolvedValue(null);
    m.guardPublicIntake.mockImplementation(async (request: Request) => ({ ok: true, json: await request.json() }));
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.saveCookieConsent.mockResolvedValue({ id: 'cc1', functional: false, analytics: true, marketing: false });
    const rows = () => m.orgRows;
    m.tx.select = () => ({ from: () => ({ where: () => ({ limit: async () => rows() }) }) });
    m.orgRows = [{ id: ORG }];
  });

  it('saves the preference and audits it on the same transaction, attributing an anonymous visitor to the system actor', async () => {
    const { POST } = await import('../gdpr/cookie-consent/route');
    const response = await POST(post('cookie-consent', body));

    expect(response.status).toBe(200);
    expect(m.saveCookieConsent).toHaveBeenCalledWith(expect.objectContaining({ organizationId: ORG, consentId: CONSENT_ID, analytics: true }), m.tx);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ organizationId: ORG, userId: 'system:cookie-consent', action: 'gdpr.cookie_consent.save', resourceId: 'cc1' }),
    );
  });

  it('is bounded per client before it reads or writes anything', async () => {
    const { POST } = await import('../gdpr/cookie-consent/route');
    m.guardPublicIntake.mockResolvedValueOnce({ ok: false, response: new Response('{}', { status: 429 }) });

    const response = await POST(post('cookie-consent', body));

    expect(response.status).toBe(429);
    expect(m.guardPublicIntake).toHaveBeenCalledWith(expect.anything(), { bucket: 'write' });
    expect(m.saveCookieConsent).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('attributes the change to a signed-in member', async () => {
    const { POST } = await import('../gdpr/cookie-consent/route');
    m.getCurrentUser.mockResolvedValue({ id: 'member_1' });
    await POST(post('cookie-consent', body));

    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.tx, expect.objectContaining({ userId: 'member_1' }));
  });

  it('writes nothing for an organization that does not exist (a visitor cannot seed another tenant\u2019s audit chain)', async () => {
    const { POST } = await import('../gdpr/cookie-consent/route');
    m.orgRows = [];
    const response = await POST(post('cookie-consent', body));

    expect(response.status).toBe(400);
    expect(m.saveCookieConsent).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('answers 403 when the record belongs to another member or organization, writing no audit', async () => {
    const { POST } = await import('../gdpr/cookie-consent/route');
    const { CookieConsentOwnershipError } = await import('@/lib/gdpr/consent-manager');
    m.saveCookieConsent.mockRejectedValueOnce(new CookieConsentOwnershipError());

    const response = await POST(post('cookie-consent', body));

    expect(response.status).toBe(403);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('fails the save when its audit cannot be written', async () => {
    const { POST } = await import('../gdpr/cookie-consent/route');
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await POST(post('cookie-consent', body));

    expect(response.status).toBe(500);
  });
});
