import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  isSupportedLanguage: vi.fn(),
  transcribeAudioWithLanguage: vi.fn(),
  checkRateLimit: vi.fn(),
  audit: vi.fn(),
}));
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.checkRateLimit, RATE_LIMITS: { AI_COMPLETION: {} } }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_c: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({}) }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: m.withRoleAuth,
}));
vi.mock('@/lib/azure-speech', () => ({
  isSupportedLanguage: m.isSupportedLanguage,
  transcribeAudioWithLanguage: m.transcribeAudioWithLanguage,
}));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    FORBIDDEN: 'FORBIDDEN',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  },
  standardErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ code, message }), {
      status: code === 'INTERNAL_ERROR' ? 500 : code === 'RATE_LIMIT_EXCEEDED' ? 429 : 400,
      headers: { 'content-type': 'application/json' },
    }),
}));

async function loadRoute() {
  return import('../voice/transcribe/route');
}

function makeFormRequest(file?: File, language?: string) {
  const form = new FormData();
  if (file) form.append('audio', file);
  if (language) form.append('language', language);
  return new NextRequest('http://localhost/api/voice/transcribe', {
    method: 'POST',
    body: form,
  });
}

describe('voice/transcribe route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withRoleAuth.mockImplementation(
      (_role: string, handler: (req: NextRequest, ctx: any) => Promise<Response>) =>
        (req: NextRequest, ctx: any = { userId: 'u1', organizationId: 'org1' }) => handler(req, ctx),
    );
    m.isSupportedLanguage.mockReturnValue(true);
    m.transcribeAudioWithLanguage.mockResolvedValue('hello world');
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 60 });
    m.audit.mockResolvedValue(undefined);
  });

  it('returns validation error when audio file is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(makeFormRequest(undefined, 'en-CA'));

    expect(response.status).toBe(400);
  });

  it('returns validation error for unsupported mime type', async () => {
    const { POST } = await loadRoute();
    const file = new File(['abc'], 'audio.txt', { type: 'text/plain' });

    const response = await POST(makeFormRequest(file, 'en-CA'));
    expect(response.status).toBe(400);
  });

  it('returns validation error when file is larger than 25MB', async () => {
    const { POST } = await loadRoute();
    const largeBuffer = new Uint8Array(25 * 1024 * 1024 + 1);
    const file = new File([largeBuffer], 'large.wav', { type: 'audio/wav' });

    const response = await POST(makeFormRequest(file, 'en-CA'));
    expect(response.status).toBe(400);
  });

  it('falls back to en-CA when language is unsupported', async () => {
    const { POST } = await loadRoute();
    m.isSupportedLanguage.mockReturnValueOnce(false);
    const file = new File([new Uint8Array([1, 2, 3])], 'ok.wav', { type: 'audio/wav' });

    const response = await POST(makeFormRequest(file, 'xx-YY'));

    expect(response.status).toBe(200);
    expect(m.transcribeAudioWithLanguage).toHaveBeenCalledWith(expect.any(Buffer), 'en-CA');
  });

  it('returns validation error when transcription is empty', async () => {
    const { POST } = await loadRoute();
    m.transcribeAudioWithLanguage.mockResolvedValueOnce('   ');
    const file = new File([new Uint8Array([1, 2, 3])], 'ok.wav', { type: 'audio/wav' });

    const response = await POST(makeFormRequest(file, 'en-CA'));
    expect(response.status).toBe(400);
  });

  it('returns transcript payload on success', async () => {
    const { POST } = await loadRoute();
    const file = new File([new Uint8Array([1, 2, 3])], 'ok.wav', { type: 'audio/wav' });

    const response = await POST(makeFormRequest(file, 'fr-CA'));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      text: 'hello world',
      language: 'fr-CA',
      success: true,
    });
    // DEF-0B12-PLT-VOICE-TRANSCRIBE-RETURNS-THE-FILE-SIZE-IN-BYTES-AS-THE-DURATION
    // Neither bytes nor a guessed duration may be reported as a measured audio duration.
    expect(payload).not.toHaveProperty('duration');
    expect(payload).not.toHaveProperty('durationSeconds');
  });

  it('returns internal error when transcription throws', async () => {
    const { POST } = await loadRoute();
    m.transcribeAudioWithLanguage.mockRejectedValueOnce(new Error('speech service down'));
    const file = new File([new Uint8Array([1, 2, 3])], 'ok.wav', { type: 'audio/wav' });

    const response = await POST(makeFormRequest(file, 'en-CA'));
    expect(response.status).toBe(500);
  });

  // DEF-0B12-PLT-VOICE-TRANSCRIBE-HAS-NO-RATE-LIMIT-ENTITLEMENT-OR-AUDIT
  it('is rate limited and records the disclosure before the audio is sent', async () => {
    const { POST } = await loadRoute();
    m.checkRateLimit.mockResolvedValueOnce({ allowed: false, resetIn: 30 });
    const limited = await POST(makeFormRequest(new File(['x'], 'a.wav', { type: 'audio/wav' }), 'en-CA'));
    expect(limited.status).toBe(429);
    expect(m.transcribeAudioWithLanguage).not.toHaveBeenCalled();

    const order: string[] = [];
    m.audit.mockImplementation(async () => { order.push('audit'); });
    m.transcribeAudioWithLanguage.mockImplementation(async () => { order.push('transcribe'); return 'text'; });
    const ok = await POST(makeFormRequest(new File(['x'], 'a.wav', { type: 'audio/wav' }), 'en-CA'));
    expect(ok.status).toBe(200);
    expect(order).toEqual(['audit', 'transcribe']);
  });

  it('does not send the audio when the audit cannot be written', async () => {
    const { POST } = await loadRoute();
    m.audit.mockRejectedValueOnce(new Error('audit down'));
    const response = await POST(makeFormRequest(new File(['x'], 'a.wav', { type: 'audio/wav' }), 'en-CA'));
    expect(response.status).toBe(500);
    expect(m.transcribeAudioWithLanguage).not.toHaveBeenCalled();
  });
});
