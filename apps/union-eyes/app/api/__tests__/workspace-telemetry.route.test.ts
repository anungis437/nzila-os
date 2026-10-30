import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// DEF-0B12-PLT-WORKSPACE-TELEMETRY-LOGS-UNBOUNDED-CLIENT-STRINGS-AND-HAS-NO-LIMIT
const m = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
}));
vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (_role: string, handler: (req: NextRequest) => Promise<Response>) => handler,
}));
vi.mock('@/lib/logger', () => ({ logger: { info: m.info, error: m.error } }));

const request = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost/api/workspace/telemetry', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

describe('POST /api/workspace/telemetry privacy and size bounds', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records only canonical event, tab, route and server timestamp', async () => {
    const { POST } = await import('../workspace/telemetry/route');
    const response = await POST(request({
      event: 'tab.view',
      payload: {
        workspace: 'forged',
        tab: 'members',
        route: '/dashboard/members',
        timestamp: '1990-01-01T00:00:00.000Z',
        userId: 'private-user-id',
        caseId: 'private-case-id',
      },
    }));
    expect(response.status).toBe(200);
    expect(m.info).toHaveBeenCalledWith('[workspace/telemetry] event', expect.objectContaining({
      event: 'tab.view', workspace: 'union-eyes', tab: 'members',
      route: '/dashboard/members', timestamp: expect.any(String),
    }));
    const recorded = m.info.mock.calls[0][1] as Record<string, unknown>;
    expect(recorded).not.toHaveProperty('userId');
    expect(recorded).not.toHaveProperty('caseId');
    expect(recorded.timestamp).not.toBe('1990-01-01T00:00:00.000Z');
  });

  it('drops an arbitrary long tab string and a dynamic route', async () => {
    const { POST } = await import('../workspace/telemetry/route');
    const response = await POST(request({
      event: 'tab.view',
      payload: { tab: 'private-'.repeat(150), route: '/dashboard/cases/private-case-id' },
    }));
    expect(response.status).toBe(200);
    const recorded = m.info.mock.calls[0][1] as Record<string, unknown>;
    expect(recorded).not.toHaveProperty('tab');
    expect(recorded).not.toHaveProperty('route');
  });

  it('rejects an oversized body even without a Content-Length header', async () => {
    const { POST } = await import('../workspace/telemetry/route');
    const payload = JSON.stringify({ event: 'tab.view', payload: { extra: 'x'.repeat(3000) } });
    const response = await POST(new NextRequest('http://localhost/api/workspace/telemetry', {
      method: 'POST', body: new ReadableStream({
        start(controller) { controller.enqueue(new TextEncoder().encode(payload)); controller.close(); },
      }), duplex: 'half', headers: { 'content-type': 'application/json' },
    } as RequestInit));
    expect(response.status).toBe(413);
    expect(m.info).not.toHaveBeenCalled();
  });

  it('rejects malformed JSON and derived-only client events', async () => {
    const { POST } = await import('../workspace/telemetry/route');
    const malformed = await POST(new NextRequest('http://localhost/api/workspace/telemetry', {
      method: 'POST', body: '{bad json', headers: { 'content-type': 'application/json' },
    }));
    expect(malformed.status).toBe(400);
    const derived = await POST(request({ event: 'absorbed_by_workspace', payload: {} }));
    expect(derived.status).toBe(400);
    expect(m.info).not.toHaveBeenCalled();
  });
});
