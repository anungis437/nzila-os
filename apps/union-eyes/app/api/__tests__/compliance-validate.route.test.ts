import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
  getCurrentUser: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({
  withApiAuth: m.withApiAuth,
  getCurrentUser: m.getCurrentUser,
}));

async function loadRoute() {
  return import('../compliance/validate/route');
}

describe('compliance/validate route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.withApiAuth.mockImplementation((handler: any) => (request: Request) => handler(request));
    m.getCurrentUser.mockResolvedValue({ id: 'u1', organizationId: 'org_1' });

    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ data: [{ ruleName: 'Arbitration Deadline', legalReference: 'Rule X', parameters: { deadline_days: 30 } }] }),
    })));
  });

  it('returns auth required when user has no organization context', async () => {
    m.getCurrentUser.mockResolvedValueOnce(null);

    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/compliance/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(401);
  });

  it('evaluates compliance checks for provided data', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/compliance/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jurisdiction: 'CA-FED',
        checksToPerform: ['arbitration_deadline', 'strike_vote', 'certification'],
        data: {
          grievanceDate: '2026-01-01',
          arbitrationDate: '2026-01-15',
          totalMembers: 100,
          votesCase: 75,
          signedCards: 55,
          bargainingUnit: 100,
        },
      }),
    }));

    expect(response.status).toBe(200);
    const body = await response.json();
    const arbitration = body.checks?.find((check: { ruleCategory: string }) => check.ruleCategory === 'arbitration_deadline');
    expect(arbitration).toMatchObject({ status: 'info', severity: 'medium' });
    expect(arbitration.message).toContain('No validated arbitration deadline');
    expect(arbitration.message).not.toMatch(/within 30.day|deadline exceeded|compliant/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // DEF-0B6-CMP-VALIDATE-ATTESTS-FROM-CALLER-DATA / DEF-0B6-CMP-VALIDATE-LITERAL-THRESHOLDS-AND-SWALLOWED-LOOKUP
  it('states no verdict for typed turnout or card figures: it reports the arithmetic and that the rule is not verified', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/compliance/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jurisdiction: 'CA-ON', data: { totalMembers: 100, votesCase: 10, signedCards: 90, bargainingUnit: 100 } }),
    }));
    expect(response.status).toBe(200);
    const { checks } = await response.json();
    expect(checks.map((c: { status: string }) => c.status)).toEqual(['info', 'info']);
    expect(JSON.stringify(checks)).not.toMatch(/compliant|violation|Quorum met|Automatic certification/i);
    expect(checks[0].message).toContain('10.0%');
    expect(checks[1].message).toContain('90.0%');
  });

  it.each([
    { totalMembers: 100, votesCase: 101 },
    { totalMembers: 0, votesCase: 0 },
    { bargainingUnit: 10, signedCards: 11 },
    { bargainingUnit: 0, signedCards: 0 },
    { totalMembers: -1, votesCase: 0 },
    { totalMembers: 1.5, votesCase: 1 },
    { totalMembers: 'Infinity', votesCase: 1 },
    { totalMembers: '9007199254740993', votesCase: 1 },
  ])('rejects impossible or unsafe counts: %j', async (data) => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/compliance/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jurisdiction: 'CA-ON', data }),
    }));
    expect(response.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('accepts canonical decimal count strings and reports only unverified arithmetic', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/compliance/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        data: { totalMembers: '100', votesCase: '25', bargainingUnit: '200', signedCards: '50' },
      }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.checks).toHaveLength(2);
    expect(body.checks.map((check: { status: string }) => check.status)).toEqual(['info', 'info']);
    expect(body.checks[0].message).toContain('25.0%');
    expect(body.checks[1].message).toContain('25.0%');
  });

  it.each(['01', '+1', '1.0', '1e2', ' 1', '1 ', '1x', '-1'])(
    'rejects noncanonical numeric string %s',
    async (votesCase) => {
      const { POST } = await loadRoute();
      const response = await POST(new Request('http://localhost/api/compliance/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: { totalMembers: '100', votesCase } }),
      }));
      expect(response.status).toBe(400);
    },
  );

  it('accepts zero numerator with positive population without asserting compliance', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/compliance/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: { totalMembers: 10, votesCase: 0, bargainingUnit: 10, signedCards: 0 } }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.checks).toHaveLength(2);
    expect(body.checks.map((check: { status: string }) => check.status)).toEqual(['info', 'info']);
    expect(body.checks.every((check: { message: string }) => check.message.includes('0.0%'))).toBe(true);
  });

  it.each(['2026-02-30', '2025-02-29', '2026-13-01', '2026-00-10', '2026-01-00', '2026-1-1', 'tomorrow', '2026-01-01T12:00:00Z'])(
    'rejects impossible or noncanonical arbitration calendar date %s',
    async (arbitrationDate) => {
      const { POST } = await loadRoute();
      const response = await POST(new Request('http://localhost/api/compliance/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ data: { grievanceDate: '2026-01-01', arbitrationDate } }),
      }));
      expect(response.status).toBe(400);
      expect(globalThis.fetch).not.toHaveBeenCalled();
    },
  );

  it('accepts a real leap-day date without inventing a legal deadline', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/compliance/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data: { grievanceDate: '2024-02-29', arbitrationDate: '2024-03-01' } }),
    }));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.checks).toHaveLength(1);
    expect(body.checks[0]).toMatchObject({ ruleCategory: 'arbitration_deadline', status: 'info' });
    expect(body.checks[0].message).toContain('No validated arbitration deadline');
  });

  it('returns 400 for invalid JSON body', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/compliance/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{invalid json',
    }));

    expect(response.status).toBe(400);
  });

  it.each(['null', '', '{invalid json'])('rejects malformed or null JSON without a false empty-check success: %j', async (raw) => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/compliance/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw,
    }));
    expect(response.status).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns 401 when user context missing', async () => {
    m.getCurrentUser.mockResolvedValueOnce({ id: 'u1', organizationId: null });
    const { POST } = await loadRoute();

    const response = await POST(new Request('http://localhost/api/compliance/validate', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    }));

    expect(response.status).toBe(401);
  });
});
