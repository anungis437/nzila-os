import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  requireApiAuth: vi.fn(),
  recordConsent: vi.fn(),
  hasValidConsent: vi.fn(),
  revokeConsent: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ requireApiAuth: m.requireApiAuth }));
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
    m.recordConsent.mockResolvedValue({ id: 'c1' });
    m.hasValidConsent.mockResolvedValue(true);
    m.revokeConsent.mockResolvedValue(undefined);
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
    expect(m.recordConsent).toHaveBeenCalled();
  });

  it('GET returns 400 for missing query fields', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/privacy/consent'));
    expect(response.status).toBe(400);
  });

  it('GET returns consent lookup result', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/privacy/consent?province=QC&consentType=marketing'));
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.hasConsent).toBe(true);
  });

  it('DELETE revokes consent', async () => {
    const { DELETE } = await loadRoute();
    const response = await DELETE(new NextRequest('http://localhost/api/privacy/consent', {
      method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ province: 'QC', consentType: 'marketing' }),
    }));

    expect(response.status).toBe(200);
    expect(m.revokeConsent).toHaveBeenCalledWith('u1', 'QC', 'marketing');
  });
});
