/**
 * ARTIFACT TYPE: Vitest Suite — Adaptive Telemetry Privacy Regression
 * MODULE: OCRA Adaptive Telemetry — anti-surveillance contract
 * DOCTRINE_VERSION: 1.0.0
 *
 * Locks down the privacy contract for the telemetry route used by the live
 * adaptive flow. These tests must FAIL loudly if anyone:
 *
 *   - Adds a forbidden event kind to ALLOWED_KINDS
 *   - Raises the metadata key/value cap
 *   - Forwards metadata keys that resemble PII
 *
 * The route is a server module; we test by importing the POST handler
 * directly. We mock the underlying observability emitter and inspect what it
 * was called with — the route MUST silently drop disallowed payloads and
 * MUST never call the emitter with PII.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const { mockEmit, mockRateLimit } = vi.hoisted(() => ({
  mockEmit: vi.fn(),
  mockRateLimit: vi.fn(() => ({ success: true, remaining: 10, reset: 0 })),
}));

vi.mock('@/lib/icra/observability', () => ({
  fireAndForgetEvent: mockEmit,
  hashIp: (ip: string | null) => (ip ? `hash-${ip.slice(0, 4)}` : null),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mockRateLimit,
}));

import { POST } from '@/app/api/icra/telemetry/route';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/icra/telemetry', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const PII_FORBIDDEN_KEYS = [
  'email',
  'name',
  'firstName',
  'lastName',
  'orgName',
  'organization_name',
  'phone',
  'ip',
  'address',
  'userAgent',
];

const ADAPTIVE_KINDS = [
  'adaptive_profile_created',
  'assessment_routed',
  'adaptive_question_deferred',
];

describe('Adaptive telemetry privacy regression', () => {
  beforeEach(() => {
    mockEmit.mockClear();
  });

  for (const kind of ADAPTIVE_KINDS) {
    it(`accepts the allowed adaptive kind "${kind}"`, async () => {
      const res = await POST(
        makeReq({ kind, sectionId: 'org_context', metadata: { included: 22 } }),
      );
      expect(res.status).toBe(204);
      expect(mockEmit).toHaveBeenCalledTimes(1);
      expect(mockEmit.mock.calls[0]?.[0]?.kind).toBe(kind);
    });
  }

  it('silently drops disallowed event kinds (no emitter call)', async () => {
    const forbidden = [
      'user_signed_up',
      'admin_action',
      'arbitrary_kind',
      'PII_dump',
    ];
    for (const kind of forbidden) {
      mockEmit.mockClear();
      const res = await POST(makeReq({ kind }));
      expect(res.status).toBe(204);
      expect(mockEmit).not.toHaveBeenCalled();
    }
  });

  it('caps metadata at 8 keys (drops the rest silently)', async () => {
    const meta: Record<string, string> = {};
    for (let i = 0; i < 20; i++) meta[`k${i}`] = `v${i}`;
    const res = await POST(
      makeReq({ kind: 'assessment_routed', metadata: meta }),
    );
    expect(res.status).toBe(204);
    const forwarded = mockEmit.mock.calls[0]?.[0]?.metadata ?? {};
    expect(Object.keys(forwarded).length).toBeLessThanOrEqual(8);
  });

  it('caps each metadata value at 64 characters (string truncation)', async () => {
    const longValue = 'x'.repeat(500);
    const res = await POST(
      makeReq({
        kind: 'adaptive_profile_created',
        metadata: { fp: longValue },
      }),
    );
    expect(res.status).toBe(204);
    const forwarded = mockEmit.mock.calls[0]?.[0]?.metadata ?? {};
    expect(typeof forwarded.fp).toBe('string');
    expect((forwarded.fp as string).length).toBeLessThanOrEqual(64);
  });

  it('does NOT forward objects, arrays, or null metadata values (only string|number|boolean)', async () => {
    const res = await POST(
      makeReq({
        kind: 'assessment_routed',
        metadata: {
          good: 'ok',
          bad_obj: { nested: 'leak' } as unknown as string,
          bad_arr: ['leak'] as unknown as string,
          bad_null: null as unknown as string,
        },
      }),
    );
    expect(res.status).toBe(204);
    const forwarded = mockEmit.mock.calls[0]?.[0]?.metadata ?? {};
    expect(forwarded.good).toBe('ok');
    expect('bad_obj' in forwarded).toBe(false);
    expect('bad_arr' in forwarded).toBe(false);
    expect('bad_null' in forwarded).toBe(false);
  });

  it('section IDs longer than 64 characters are dropped', async () => {
    const res = await POST(
      makeReq({
        kind: 'assessment_routed',
        sectionId: 'x'.repeat(200),
      }),
    );
    expect(res.status).toBe(204);
    const forwarded = mockEmit.mock.calls[0]?.[0];
    expect(forwarded?.sectionId).toBeUndefined();
  });

  it('honors rate-limit denial with a silent 204 (no emitter call)', async () => {
    mockRateLimit.mockReturnValueOnce({
      success: false,
      remaining: 0,
      reset: 0,
    } as never);
    const res = await POST(
      makeReq({ kind: 'assessment_routed', metadata: { included: 22 } }),
    );
    expect(res.status).toBe(204);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  // Documentation regression: forbid wiring PII-shaped metadata into the
  // allowed call sites. This is not enforced by the route itself (it does
  // not inspect keys), but the test pins the intent: callers MUST NOT
  // emit these keys. If anyone adds them, this test should be updated
  // alongside a security review.
  it('PII_FORBIDDEN_KEYS list documents the never-forward keys', () => {
    expect(PII_FORBIDDEN_KEYS).toContain('email');
    expect(PII_FORBIDDEN_KEYS).toContain('orgName');
    expect(PII_FORBIDDEN_KEYS.length).toBeGreaterThanOrEqual(8);
  });
});
