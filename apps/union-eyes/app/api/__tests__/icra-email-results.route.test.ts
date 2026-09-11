import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { createHash } from 'crypto';

const TOKEN = 'test-capability-token';
const TOKEN_HASH = createHash('sha256').update(TOKEN, 'utf8').digest('hex');
const FUTURE = new Date(Date.now() + 60_000);

const m = vi.hoisted(() => ({
  rateLimit: vi.fn(),
  sendEmail: vi.fn(),
  isValidEmail: vi.fn(),
  fireAndForgetEvent: vi.fn(),
  hashIp: vi.fn(),
  logger: { warn: vi.fn(), error: vi.fn() },
  db: { select: vi.fn(), update: vi.fn() },
  eq: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rateLimit }));
vi.mock('@/lib/email-service', () => ({ sendEmail: m.sendEmail, isValidEmail: m.isValidEmail }));
vi.mock('@/lib/icra/observability', () => ({ fireAndForgetEvent: m.fireAndForgetEvent, hashIp: m.hashIp }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: (fn: (tx: any) => Promise<unknown>) => fn(m.db) }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, eq: m.eq };
});
vi.mock('@/db/schema/icra-schema', () => ({ icraAssessments: { id: 'id' } }));

function req(bodyObj: Record<string, unknown>, authorized = true) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': '127.0.0.1' };
  if (authorized) headers.authorization = `Bearer ${TOKEN}`;
  return new NextRequest('http://localhost/api/icra/email-results', {
    method: 'POST',
    headers,
    body: JSON.stringify(bodyObj),
  });
}

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

    const limit = vi.fn(async () => [
      { id: 'a1', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: FUTURE },
    ]);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    m.db.select.mockReturnValue({ from });
    m.db.update.mockReturnValue({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) });
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

    const response = await POST(req({ assessmentId: 'a1', email: 'bad' }));

    expect(response.status).toBe(400);
  });

  it('denies (UUID + arbitrary email, no capability presented) — assessmentId alone is never sufficient', async () => {
    const { POST } = await loadRoute();
    const response = await POST(req({ assessmentId: 'a1', email: 'attacker@example.com' }, false));

    expect(response.status).toBe(401);
    expect(m.sendEmail).not.toHaveBeenCalled();
    expect(m.db.update).not.toHaveBeenCalled();
  });

  it('denies when the presented capability is wrong for this assessment', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new NextRequest('http://localhost/api/icra/email-results', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer wrong-token' },
      body: JSON.stringify({ assessmentId: 'a1', email: 'a@example.com' }),
    }));

    expect(response.status).toBe(401);
    expect(m.sendEmail).not.toHaveBeenCalled();
  });

  it('denies when the presented capability is expired', async () => {
    const limit = vi.fn(async () => [
      { id: 'a1', capabilityTokenHash: TOKEN_HASH, capabilityTokenExpiresAt: new Date(Date.now() - 1000) },
    ]);
    m.db.select.mockReturnValue({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit })) })) });
    const { POST } = await loadRoute();

    const response = await POST(req({ assessmentId: 'a1', email: 'a@example.com' }));

    expect(response.status).toBe(410);
    expect(m.sendEmail).not.toHaveBeenCalled();
  });

  it('returns 404 when assessment does not exist (capability check reports not_found)', async () => {
    const { POST } = await loadRoute();
    const limit = vi.fn(async () => []);
    const where = vi.fn(() => ({ limit }));
    const from = vi.fn(() => ({ where }));
    m.db.select.mockReturnValueOnce({ from });

    const response = await POST(req({ assessmentId: 'missing', email: 'a@example.com' }));

    expect(response.status).toBe(404);
    expect(m.sendEmail).not.toHaveBeenCalled();
  });

  it('returns 502 when email delivery fails', async () => {
    const { POST } = await loadRoute();
    m.sendEmail.mockResolvedValueOnce({ success: false, error: 'provider-down' });

    const response = await POST(req({ assessmentId: 'a1', email: 'a@example.com' }));

    expect(response.status).toBe(502);
  });

  it('sends when a valid capability is presented, embedding the SAME (non-rotated) token in the URL fragment', async () => {
    const { POST } = await loadRoute();
    const response = await POST(req({ assessmentId: 'a1', email: 'a@example.com', locale: 'en-CA' }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({ ok: true });
    expect(m.fireAndForgetEvent).toHaveBeenCalled();
    // Must NEVER rotate the capability — no DB write of any kind.
    expect(m.db.update).not.toHaveBeenCalled();
    const emailArgs = m.sendEmail.mock.calls[0][0];
    expect(emailArgs.html).toContain(`#cap=${encodeURIComponent(TOKEN)}`);
    expect(emailArgs.html).not.toContain('?cap=');
  });

  it('does not affect the persisted capability hash when email delivery fails', async () => {
    const { POST } = await loadRoute();
    m.sendEmail.mockResolvedValueOnce({ success: false, error: 'provider-down' });

    await POST(req({ assessmentId: 'a1', email: 'a@example.com' }));

    expect(m.db.update).not.toHaveBeenCalled();
  });
});
