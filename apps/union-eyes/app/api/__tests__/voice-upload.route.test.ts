import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  checkRateLimit: vi.fn(),
  checkEntitlement: vi.fn(),
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

function buildRequest(file?: File, language?: string) {
  const form = new FormData();
  if (file) form.append('file', file);
  if (language) form.append('language', language);
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
});
