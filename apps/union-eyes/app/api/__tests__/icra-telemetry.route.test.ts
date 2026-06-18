import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  fireAndForgetEvent: vi.fn(),
  hashIp: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rateLimit }));
vi.mock('@/lib/icra/observability', () => ({ fireAndForgetEvent: m.fireAndForgetEvent, hashIp: m.hashIp }));

async function loadRoute() {
  return import('../icra/telemetry/route');
}

describe('icra/telemetry route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rateLimit.mockReturnValue({ success: true });
    m.hashIp.mockReturnValue('ip_hash_1');
  });

  it('returns 204 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.rateLimit.mockReturnValueOnce({ success: false });

    const response = await POST(new NextRequest('http://localhost/api/icra/telemetry', { method: 'POST' }));
    expect(response.status).toBe(204);
  });

  it('returns 204 for invalid json body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad-json',
    }));

    expect(response.status).toBe(204);
  });

  it('returns 204 for unsupported event kind', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind: 'unsupported_kind' }),
    }));

    expect(response.status).toBe(204);
    expect(m.fireAndForgetEvent).not.toHaveBeenCalled();
  });

  it('returns 204 and emits telemetry event for allowed kind', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/telemetry', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
      body: JSON.stringify({
        kind: 'section_advanced',
        sectionId: 'governance',
        metadata: { step: 2, source: 'ui', extra: true },
      }),
    }));

    expect(response.status).toBe(204);
    expect(m.fireAndForgetEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'section_advanced',
        sectionId: 'governance',
        ipHash: 'ip_hash_1',
      }),
    );
  });
});
