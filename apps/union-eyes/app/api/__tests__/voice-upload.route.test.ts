import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  checkEntitlement: vi.fn(),
  audit: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/api-auth-guard', () => ({ withRoleAuth: m.withRoleAuth }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: m.checkRateLimit,
  RATE_LIMITS: { AI_COMPLETION: { requests: 20, window: 60000 } },
  createRateLimitHeaders: () => ({ 'x-ratelimit-limit': '20' }),
}));
vi.mock('@/lib/services/entitlements', () => ({
  checkEntitlement: m.checkEntitlement,
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_context: unknown, cb: (tx: unknown) => Promise<unknown>) => cb({}),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR' },
  standardErrorResponse: (_code: string, message: string) =>
    new Response(JSON.stringify({ message }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    }),
}));

async function loadRoute() {
  return import('../voice/upload/route');
}

function buildRequest(file?: File, language?: string, consent: 'valid' | 'missing' | 'stale' = 'valid') {
  const form = new FormData();
  if (file) form.append('file', file);
  if (language) form.append('language', language);
  if (consent !== 'missing') {
    form.append('disclosureNoticeVersion', consent === 'stale' ? 'old' : 'v1');
    form.append('disclosureAcknowledged', 'true');
    form.append('participantPermissionConfirmed', 'true');
  }
  return new NextRequest('http://localhost/api/voice/upload', {
    method: 'POST',
    body: form,
  });
}

describe('voice/upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation(
      (_role: string, handler: (req: NextRequest, ctx: any) => Promise<Response>) =>
        (req: NextRequest, ctx: any = { userId: 'u1', organizationId: 'org1' }) => handler(req, ctx),
    );
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: null });
    m.checkEntitlement.mockResolvedValue({ allowed: true });
    m.audit.mockResolvedValue(undefined);
    process.env.UE_VOICE_DISCLOSURE_NOTICE_VERSION = 'v1';
    process.env.UE_VOICE_DISCLOSURE_NOTICE_EN_CA = 'External transcription notice';
    process.env.UE_VOICE_DISCLOSURE_NOTICE_FR_CA = 'Avis de transcription externe';
    process.env.UE_VOICE_DISCLOSURE_APPROVAL_REFERENCE = 'institutional-review-pending-fixture';
    process.env.AZURE_OPENAI_WHISPER_ENDPOINT = 'https://example.openai.azure.com';
    process.env.AZURE_OPENAI_WHISPER_API_KEY = 'key1';
    process.env.AZURE_OPENAI_WHISPER_DEPLOYMENT = 'whisper';
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        text: 'transcribed text',
        language: 'en',
        duration: 10,
        segments: [{ start: 0, end: 1, text: 'hi' }],
      }),
    })));
  });

  it('returns 429 when AI rate limit is exceeded', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 60 });

    const response = await POST(buildRequest());
    expect(response.status).toBe(429);
  });

  it('returns 403 when entitlement is missing', async () => {
    const { POST } = await loadRoute();
    m.checkEntitlement.mockResolvedValueOnce({ allowed: false, reason: 'Upgrade required', upgradeUrl: '/upgrade' });

    const response = await POST(buildRequest());
    expect(response.status).toBe(403);
  });

  it('returns 400 when file is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(buildRequest());

    expect(response.status).toBe(400);
  });

  it('returns 400 for unsupported mime type', async () => {
    const { POST } = await loadRoute();
    const file = new File(['bad'], 'voice.txt', { type: 'text/plain' });

    const response = await POST(buildRequest(file));
    expect(response.status).toBe(400);
  });

  it('returns 400 for file larger than 25MB', async () => {
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array(25 * 1024 * 1024 + 1)], 'large.wav', { type: 'audio/wav' });

    const response = await POST(buildRequest(file));
    expect(response.status).toBe(400);
  });

  it('returns 503 when whisper endpoint config is missing', async () => {
    const { POST } = await loadRoute();
    delete process.env.AZURE_OPENAI_WHISPER_ENDPOINT;
    delete process.env.AZURE_OPENAI_ENDPOINT;
    const file = new File([new Uint8Array([1, 2, 3])], 'ok.wav', { type: 'audio/wav' });

    const response = await POST(buildRequest(file));
    expect(response.status).toBe(503);
  });

  it('returns 502 when whisper API responds with error', async () => {
    const { POST } = await loadRoute();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false,
      status: 404,
      text: async () => 'deployment missing',
    })));
    const file = new File([new Uint8Array([1, 2, 3])], 'ok.wav', { type: 'audio/wav' });

    const response = await POST(buildRequest(file));
    expect(response.status).toBe(502);
  });

  it('returns transcript metadata on success', async () => {
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array([1, 2, 3])], 'ok.wav', { type: 'audio/wav' });

    const response = await POST(buildRequest(file, 'fr'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      transcript: 'transcribed text',
      language: 'en',
      file_name: 'ok.wav',
    });
  });

  it('propagates error when entitlement check throws before handler try/catch', async () => {
    const { POST } = await loadRoute();
    m.checkEntitlement.mockRejectedValueOnce(new Error('entitlement service down'));

    const file = new File([new Uint8Array([1, 2, 3])], 'ok.wav', { type: 'audio/wav' });
    await expect(POST(buildRequest(file))).rejects.toThrow('entitlement service down');
  });
  it('refuses missing, stale and unconfigured disclosure before any external call', async () => {
    const { POST } = await loadRoute();
    const file = new File(['voice'], 'ok.wav', { type: 'audio/wav' });
    const send = vi.mocked(fetch);
    expect((await POST(buildRequest(file, undefined, 'missing'))).status).toBe(400);
    expect((await POST(buildRequest(file, undefined, 'stale'))).status).toBe(409);
    delete process.env.UE_VOICE_DISCLOSURE_APPROVAL_REFERENCE;
    expect((await POST(buildRequest(file))).status).toBe(503);
    expect(send).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('refuses external transmission when the disclosure audit cannot persist', async () => {
    const { POST } = await loadRoute();
    m.audit.mockRejectedValueOnce(new Error('audit storage unavailable'));
    const response = await POST(buildRequest(new File(['voice'], 'ok.wav', { type: 'audio/wav' })));
    expect(response.status).toBe(500);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('audits version and approval reference before transmitting any audio', async () => {
    const { POST } = await loadRoute();
    const order: string[] = [];
    m.audit.mockImplementation(async (_tx: unknown, event: any) => {
      expect(event.details).toMatchObject({
        noticeVersion: 'v1',
        approvalReference: 'institutional-review-pending-fixture',
        participantPermissionAsserted: true,
      });
      order.push('audit');
    });
    vi.stubGlobal('fetch', vi.fn(async () => {
      order.push('external');
      return { ok: true, status: 200, json: async () => ({ text: 'hello' }) };
    }));
    const response = await POST(buildRequest(new File(['voice'], 'ok.wav', { type: 'audio/wav' })));
    expect(response.status).toBe(200);
    expect(order).toEqual(['audit', 'external']);
  });

});
