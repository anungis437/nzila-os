import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  requireApiAuth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  recordConsent: vi.fn(),
  hasValidConsent: vi.fn(),
  revokeConsent: vi.fn(),
  persistAtomicAudit: vi.fn(),
  logError: vi.fn(),
  tx: { marker: 'tx' },
}));

vi.mock('@/lib/api-auth-guard', () => ({ requireApiAuth: m.requireApiAuth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@/lib/logger', () => ({ logger: { error: m.logError, warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(m.tx)),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/services/provincial-privacy-service', () => ({
  ProvincialPrivacyService: {
    recordConsent: m.recordConsent,
    hasValidConsent: m.hasValidConsent,
    revokeConsent: m.revokeConsent,
  },
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', VALIDATION_ERROR: 'VALIDATION_ERROR' },
  standardErrorResponse: (code: string, message: string, details?: unknown) =>
    new Response(JSON.stringify({ code, message, details }), { status: code === 'AUTH_REQUIRED' ? 401 : 400 }),
}));

async function loadRoute() {
  return import('../privacy/consent/route');
}

describe('privacy/consent route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.requireApiAuth.mockResolvedValue({ userId: 'u1' });
    m.getOrganizationIdForUser.mockResolvedValue('org-1');
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.recordConsent.mockResolvedValue({ id: 'c1' });
    m.hasValidConsent.mockResolvedValue(true);
    m.revokeConsent.mockResolvedValue([{ id: 'c1' }]);
  });

  it('POST returns 401 when unauthenticated', async () => {
    const { POST } = await loadRoute();
    m.requireApiAuth.mockResolvedValueOnce({ userId: null });

    const response = await POST(new NextRequest('http://localhost/api/privacy/consent', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
    }));
    expect(response.status).toBe(401);
  });

  it('POST validates Quebec consent language', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/privacy/consent', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        province: 'QC', consentType: 'marketing', consentGiven: true, consentText: 'long enough consent text', consentLanguage: 'en',
      }),
    }));

    expect(response.status).toBe(400);
  });

  it('POST records consent successfully', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/privacy/consent', {
      method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'vitest' }, body: JSON.stringify({
        province: 'ON', consentType: 'marketing', consentGiven: true, consentText: 'long enough consent text', consentLanguage: 'en',
      }),
    }));

    expect(response.status).toBe(200);
    expect(m.recordConsent).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }), m.tx);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ organizationId: 'org-1', userId: 'u1', action: 'privacy.consent.record', resourceId: 'c1' }),
    );
  });

  it('POST fails the recording when its audit cannot be written', async () => {
    const { POST } = await loadRoute();
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await POST(new NextRequest('http://localhost/api/privacy/consent', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
        province: 'ON', consentType: 'marketing', consentGiven: true, consentText: 'long enough consent text', consentLanguage: 'en',
      }),
    }));

    expect(response.status).toBe(500);
  });

  it('GET returns 400 for missing query fields', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/privacy/consent'));
    expect(response.status).toBe(400);
    expect(m.hasValidConsent).not.toHaveBeenCalled();
  });

  it('GET returns 400, before any read, for a province that is not a province', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/privacy/consent?province=ZZZ&consentType=marketing'));
    expect(response.status).toBe(400);
    expect(m.hasValidConsent).not.toHaveBeenCalled();
  });

  it('GET returns consent lookup result, read in the caller\'s tenant transaction', async () => {
    const { GET } = await loadRoute();
    const { withRLSContext } = await import('@/lib/db/with-rls-context');
    const response = await GET(new NextRequest('http://localhost/api/privacy/consent?province=QC&consentType=marketing'));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.hasConsent).toBe(true);
    expect(withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
    expect(m.hasValidConsent).toHaveBeenCalledWith('u1', 'QC', 'marketing', m.tx);
  });

  it('GET answers 500, not a negative consent, when the read fails', async () => {
    const { GET } = await loadRoute();
    m.hasValidConsent.mockRejectedValueOnce(new Error('connection reset'));
    const response = await GET(new NextRequest('http://localhost/api/privacy/consent?province=QC&consentType=marketing'));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to check consent' });
    expect(m.logError).toHaveBeenCalled();
  });

  it('POST and DELETE answer 400 for a body that is not JSON, and 413 for one over the limit', async () => {
    const { POST, DELETE } = await loadRoute();
    const request = (method: string, body: string) =>
      new NextRequest('http://localhost/api/privacy/consent', { method, headers: { 'content-type': 'application/json' }, body });
    expect((await POST(request('POST', 'not-json'))).status).toBe(400);
    expect((await DELETE(request('DELETE', 'not-json'))).status).toBe(400);
    expect((await POST(request('POST', JSON.stringify({ padding: 'x'.repeat(20_000) })))).status).toBe(413);
    expect(m.recordConsent).not.toHaveBeenCalled();
    expect(m.revokeConsent).not.toHaveBeenCalled();
  });

  it('DELETE answers 400 for a province that is not a province or a missing consent type, and revokes nothing', async () => {
    const { DELETE } = await loadRoute();
    for (const body of [{ province: 'ZZZ', consentType: 'marketing' }, { province: 'QC' }, { consentType: 'marketing' }, {}]) {
      const response = await DELETE(new NextRequest('http://localhost/api/privacy/consent', {
        method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
      }));
      expect(response.status).toBe(400);
    }
    expect(m.revokeConsent).not.toHaveBeenCalled();
  });

  it('DELETE revokes consent', async () => {
    const { DELETE } = await loadRoute();
    const response = await DELETE(new NextRequest('http://localhost/api/privacy/consent', {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ province: 'QC', consentType: 'marketing' }),
    }));

    expect(response.status).toBe(200);
    expect(m.revokeConsent).toHaveBeenCalledWith('u1', 'QC', 'marketing', m.tx);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      m.tx,
      expect.objectContaining({ userId: 'u1', action: 'privacy.consent.revoke', resourceId: 'c1' }),
    );
  });

  it('DELETE answers 404 and writes no audit when there is no active consent to revoke', async () => {
    const { DELETE } = await loadRoute();
    m.revokeConsent.mockResolvedValueOnce([]);

    const response = await DELETE(new NextRequest('http://localhost/api/privacy/consent', {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ province: 'QC', consentType: 'marketing' }),
    }));

    expect(response.status).toBe(404);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });
});
