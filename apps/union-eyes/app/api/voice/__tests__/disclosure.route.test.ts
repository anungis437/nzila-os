import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (_role: string, handler: () => Promise<Response>) => handler,
}));

describe('GET /api/voice/disclosure', () => {
  beforeEach(() => {
    process.env.UE_VOICE_DISCLOSURE_NOTICE_VERSION = 'v2';
    process.env.UE_VOICE_DISCLOSURE_NOTICE_EN_CA = 'English disclosure';
    process.env.UE_VOICE_DISCLOSURE_NOTICE_FR_CA = 'Avis français';
    process.env.UE_VOICE_DISCLOSURE_APPROVAL_REFERENCE = 'test-only-reference';
  });

  it('returns the current bilingual notice without exposing approval evidence', async () => {
    const { GET } = await import('../disclosure/route');
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({ version: 'v2', enCA: 'English disclosure', frCA: 'Avis français' });
    expect(JSON.stringify(body)).not.toContain('test-only-reference');
  });

  it('fails closed if institutional configuration is incomplete', async () => {
    delete process.env.UE_VOICE_DISCLOSURE_APPROVAL_REFERENCE;
    const { GET } = await import('../disclosure/route');
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
