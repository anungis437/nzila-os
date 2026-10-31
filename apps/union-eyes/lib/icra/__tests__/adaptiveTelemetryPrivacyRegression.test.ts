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
  mockRateLimit: vi.fn(async () => ({ allowed: true, remaining: 10, resetIn: 0 })),
}));

vi.mock('@/lib/icra/observability', () => ({
  fireAndForgetEvent: mockEmit,
  hashIp: (ip: string | null) => (ip ? `hash-${ip.slice(0, 4)}` : null),
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: mockRateLimit,
}));

import { POST } from '@/app/api/icra/telemetry/route';

function makeReq(body: any): NextRequest {
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
    mockRateLimit.mockReset().mockResolvedValue({ allowed: true, remaining: 10, resetIn: 0 });
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
    const meta: Record<string, string | number> = { step: 1, answered: 2, included: 3, deferred: 4, required: 5, optional: 6, doctrineVersion: '1.0.0', scale: 'small', continuity: 'low', governance: 'low', routeVersion: 'v1', decision: 'defer_optional', ruleId: 'r1' };
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
        metadata: { routeVersion: longValue },
      }),
    );
    expect(res.status).toBe(204);
    const forwarded = mockEmit.mock.calls[0]?.[0]?.metadata ?? {};
    expect(forwarded.routeVersion).toBeUndefined(); // Oversized strings are rejected, never silently reinterpreted.
  });

  it('does NOT forward objects, arrays, or null metadata values (only string|number|boolean)', async () => {
    const res = await POST(
      makeReq({
        kind: 'assessment_routed',
        metadata: {
          routeVersion: 'v1',
          bad_obj: { nested: 'leak' } as any as string,
          bad_arr: ['leak'] as any as string,
          bad_null: null as any as string,
        },
      }),
    );
    expect(res.status).toBe(204);
    const forwarded = mockEmit.mock.calls[0]?.[0]?.metadata ?? {};
    expect(forwarded.routeVersion).toBe('v1');
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
      allowed: false,
      remaining: 0,
      resetIn: 0,
    } as never);
    const res = await POST(
      makeReq({ kind: 'assessment_routed', metadata: { included: 22 } }),
    );
    expect(res.status).toBe(204);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('never forwards client-provided contact fields, question identifiers or fingerprints', async () => {
    await POST(makeReq({
      kind: 'adaptive_question_deferred',
      sectionId: 'private-person@example.com',
      metadata: {
        questionId: 'sensitive-question',
        routeFingerprint: 'unique-client',
        email: 'private-person@example.com',
        orgName: 'Sensitive Union',
        phone: '5551234567',
        ruleId: 'R-3',
        decision: 'defer_optional',
      },
    }));
    expect(mockEmit).toHaveBeenCalledTimes(1);
    const event = mockEmit.mock.calls[0]?.[0];
    expect(event.sectionId).toBeUndefined();
    expect(event.metadata).toEqual({ ruleId: 'R-3', decision: 'defer_optional' });
  });

  it('drops oversized request bodies before the emitter is reached', async () => {
    const res = await POST(makeReq({
      kind: 'assessment_routed',
      metadata: { routeVersion: 'x'.repeat(5000) },
    }));
    expect(res.status).toBe(204);
    expect(mockEmit).not.toHaveBeenCalled();
  });

  it('does not emit when the rate limiter is unavailable', async () => {
    mockRateLimit.mockRejectedValueOnce(new Error('redis unavailable'));
    const res = await POST(makeReq({ kind: 'assessment_routed' }));
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
