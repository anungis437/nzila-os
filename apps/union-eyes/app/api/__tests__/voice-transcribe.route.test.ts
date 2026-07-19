import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  withRoleAuth: vi.fn(),
  isSupportedLanguage: vi.fn(),
  transcribeAudioWithLanguage: vi.fn(),
}));

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
  },
  standardErrorResponse: (code: string, message: string) =>
    new Response(JSON.stringify({ code, message }), {
      status: code === 'INTERNAL_ERROR' ? 500 : 400,
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
  });

  it('returns internal error when transcription throws', async () => {
    const { POST } = await loadRoute();
    m.transcribeAudioWithLanguage.mockRejectedValueOnce(new Error('speech service down'));
    const file = new File([new Uint8Array([1, 2, 3])], 'ok.wav', { type: 'audio/wav' });

    const response = await POST(makeFormRequest(file, 'en-CA'));
    expect(response.status).toBe(500);
  });
});
