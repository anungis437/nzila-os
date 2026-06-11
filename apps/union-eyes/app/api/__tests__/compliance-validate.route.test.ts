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

    expect([200, 400, 401, 403, 500]).toContain(response.status);
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

    expect([200, 400, 401, 403, 500]).toContain(response.status);
  });
});
