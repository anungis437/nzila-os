/**
 * withApi() — Unit Tests
 *
 * Tests the unified API route wrapper:
 *   - generateTraceId() PURE fn
 *   - Auth required / public / cron modes
 *   - Body & query Zod validation
 *   - Role checks (minRole, roles list)
 *   - Error handling (ApiError, unknown)
 *   - Response envelope (success, 204, NextResponse passthrough)
 *
 * Tier 2 — Core Business Logic
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetCurrentUser, mockCheckRateLimit, mockRequireEntitlement } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockCheckRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  mockRequireEntitlement: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return {
    ...actual,
    getCurrentUser: mockGetCurrentUser,
  };
});

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockCheckRateLimit,
  createRateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: mockRequireEntitlement,
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { withApi } from '../with-api';
import { ApiError } from '../errors';
import { ErrorCode } from '../standardized-responses';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(
  url = 'http://localhost:3000/api/test',
  options?: RequestInit,
) {
  return new NextRequest(new URL(url), options);
}

const fakeUser = {
  id: 'usr-1',
  email: 'test@example.com',
  role: 'steward',
  organizationId: 'org-1',
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('withApi()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(fakeUser);
  });

  // ── Trace-ID ──────────────────────────────────────────────────────────

  it('returns X-Trace-ID header on every response', async () => {
    const handler = withApi({}, async () => ({ ok: true }));
    const res = await handler(makeRequest());
    expect(res.headers.get('X-Trace-ID')).toBeTruthy();
  });

  // ── Success envelope ──────────────────────────────────────────────────

  it('wraps handler return in success envelope', async () => {
    const handler = withApi({}, async () => ({ greeting: 'hello' }));
    const res = await handler(makeRequest());
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ greeting: 'hello' });
    expect(json.timestamp).toBeTruthy();
    expect(res.status).toBe(200);
  });

  it('returns 204 for void handler', async () => {
    const handler = withApi({}, async () => undefined);
    const res = await handler(makeRequest());
    expect(res.status).toBe(204);
  });

  it('passes through NextResponse directly', async () => {
    const custom = NextResponse.json({ custom: true }, { status: 201 });
    const handler = withApi({}, async () => custom);
    const res = await handler(makeRequest());
    expect(res.status).toBe(201);
    // Trace-ID injected even on passthrough
    expect(res.headers.get('X-Trace-ID')).toBeTruthy();
  });

  it('respects successStatus override', async () => {
    const handler = withApi({ successStatus: 201 }, async () => ({ id: 'new' }));
    const res = await handler(makeRequest());
    expect(res.status).toBe(201);
  });

  // ── Auth required (default) ───────────────────────────────────────────

  it('returns 401 when auth required and user not found', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const handler = withApi({}, async () => ({}));
    const res = await handler(makeRequest());
    expect(res.status).toBe(401);
  });

  // ── Public route ──────────────────────────────────────────────────────

  it('allows unauthenticated access when auth.required=false', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const handler = withApi({ auth: { required: false } }, async (ctx) => ({
      userId: ctx.userId,
    }));
    const res = await handler(makeRequest());
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.userId).toBeNull();
  });

  // ── Cron route ────────────────────────────────────────────────────────

  it('accepts valid cron secret', async () => {
    const prev = process.env.CRON_SECRET_KEY;
    process.env.CRON_SECRET_KEY = 'secret123';
    const handler = withApi({ auth: { cron: true } }, async () => ({ ran: true }));
    const req = makeRequest('http://localhost:3000/api/cron', {
      headers: { 'x-cron-secret': 'secret123' },
    });
    const res = await handler(req);
    const json = await res.json();
    expect(json.success).toBe(true);
    process.env.CRON_SECRET_KEY = prev;
  });

  it('rejects invalid cron secret', async () => {
    const prev = process.env.CRON_SECRET_KEY;
    process.env.CRON_SECRET_KEY = 'secret123';
    const handler = withApi({ auth: { cron: true } }, async () => ({ ran: true }));
    const req = makeRequest('http://localhost:3000/api/cron', {
      headers: { 'x-cron-secret': 'WRONG' },
    });
    const res = await handler(req);
    expect(res.status).toBe(401);
    process.env.CRON_SECRET_KEY = prev;
  });

  // ── Body validation ───────────────────────────────────────────────────

  it('parses valid body through Zod schema', async () => {
    const schema = z.object({ name: z.string() });
    const handler = withApi({ body: schema }, async (ctx) => ({
      received: ctx.body.name,
    }));
    const req = makeRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    const json = await res.json();
    expect(json.data.received).toBe('Alice');
  });

  it('rejects invalid body with 400', async () => {
    const schema = z.object({ name: z.string(), age: z.number() });
    const handler = withApi({ body: schema }, async () => ({}));
    const req = makeRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: JSON.stringify({ name: 123 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  it('rejects non-JSON body', async () => {
    const schema = z.object({ name: z.string() });
    const handler = withApi({ body: schema }, async () => ({}));
    const req = makeRequest('http://localhost:3000/api/test', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
  });

  // ── Query validation ──────────────────────────────────────────────────

  it('parses query params through Zod schema', async () => {
    const schema = z.object({ page: z.string() });
    const handler = withApi({ query: schema }, async (ctx) => ({
      page: ctx.query.page,
    }));
    const req = makeRequest('http://localhost:3000/api/test?page=2');
    const res = await handler(req);
    const json = await res.json();
    expect(json.data.page).toBe('2');
  });

  // ── ApiError handling ─────────────────────────────────────────────────

  it('catches ApiError and returns structured error', async () => {
    const handler = withApi({}, async () => {
      throw new ApiError(ErrorCode.NOT_FOUND, 'Widget not found', { id: '123' });
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.code).toBe('NOT_FOUND');
  });

  // ── Unknown error → 500 ───────────────────────────────────────────────

  it('catches unexpected errors as 500', async () => {
    const handler = withApi({}, async () => {
      throw new Error('boom');
    });
    const res = await handler(makeRequest());
    expect(res.status).toBe(500);
  });

  // ── Cache control ─────────────────────────────────────────────────────

  it('sets Cache-Control: private, no-store', async () => {
    const handler = withApi({}, async () => ({ ok: true }));
    const res = await handler(makeRequest());
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
  });

  // ── Context fields ────────────────────────────────────────────────────

  it('provides user, userId, organizationId in context', async () => {
    const handler = withApi({}, async (ctx) => ({
      userId: ctx.userId,
      orgId: ctx.organizationId,
      hasRequest: !!ctx.request,
      hasTraceId: !!ctx.traceId,
    }));
    const res = await handler(makeRequest());
    const json = await res.json();
    expect(json.data.userId).toBe('usr-1');
    expect(json.data.orgId).toBe('org-1');
    expect(json.data.hasRequest).toBe(true);
    expect(json.data.hasTraceId).toBe(true);
  });
});
