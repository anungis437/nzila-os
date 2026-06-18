import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  sendEmail: vi.fn(),
  isValidEmail: vi.fn(),
  fireAndForgetEvent: vi.fn(),
  hashIp: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn() },
  db: { select: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rateLimit }));
vi.mock('@/lib/email-service', () => ({ sendEmail: m.sendEmail, isValidEmail: m.isValidEmail }));
vi.mock('@/lib/icra/observability', () => ({ fireAndForgetEvent: m.fireAndForgetEvent, hashIp: m.hashIp }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: m.eq };
});
vi.mock('@/db/schema/icra-schema', () => ({ icraAssessments: { id: 'id' } }));

async function loadRoute() {
  return import('../icra/email-results/route');
}

describe('icra/email-results route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rateLimit.mockReturnValue({ success: true });
    m.isValidEmail.mockReturnValue(true);
    m.hashIp.mockReturnValue('ip_hash_1');
    m.sendEmail.mockResolvedValue({ success: true });
    m.eq.mockReturnValue('eq');

    const limit = vi.fn(async () => [{ id: 'a1' }]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    m.db.select.mockReturnValue({ from });
  });

  it('returns 429 when rate-limited', async () => {
    const { POST } = await loadRoute();
    m.rateLimit.mockReturnValueOnce({ success: false });

    const response = await POST(new NextRequest('http://localhost/api/icra/email-results', { method: 'POST' }));
    expect(response.status).toBe(429);
  });

  it('returns 400 for invalid request body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/email-results', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{bad-json',
    }));

    expect(response.status).toBe(400);
  });

  it('returns 400 for invalid email', async () => {
    const { POST } = await loadRoute();
    m.isValidEmail.mockReturnValueOnce(false);

    const response = await POST(new NextRequest('http://localhost/api/icra/email-results', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assessmentId: 'a1', email: 'bad' }),
    }));

    expect(response.status).toBe(400);
  });

  it('returns ok=true when assessment does not exist', async () => {
    const { POST } = await loadRoute();
    const limit = vi.fn(async () => []);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    m.db.select.mockReturnValueOnce({ from });

    const response = await POST(new NextRequest('http://localhost/api/icra/email-results', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assessmentId: 'missing', email: 'a@example.com' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
  });

  it('returns 502 when email delivery fails', async () => {
    const { POST } = await loadRoute();
    m.sendEmail.mockResolvedValueOnce({ success: false, error: 'provider-down' });

    const response = await POST(new NextRequest('http://localhost/api/icra/email-results', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ assessmentId: 'a1', email: 'a@example.com' }),
    }));

    expect(response.status).toBe(502);
  });

  it('returns ok=true when email is sent', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/email-results', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' },
      body: JSON.stringify({ assessmentId: 'a1', email: 'a@example.com', locale: 'en-CA' }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(m.fireAndForgetEvent).toHaveBeenCalled();
  });
});
