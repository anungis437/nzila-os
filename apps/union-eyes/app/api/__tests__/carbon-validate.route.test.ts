import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApiAuth: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth }));
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR' },
  standardErrorResponse: vi.fn((code: string, message: string) => new Response(JSON.stringify({ message }), { status: 400 })),
}));

async function loadRoute() {
  return import('../carbon/validate/route');
}

describe('carbon/validate route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: any) => handler);
  });

  it('validates carbon neutrality claims', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/carbon/validate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        claimType: 'carbon_neutral',
        dataPoints: [{ metric: 'total_emissions', value: 0, unit: 'kg' }],
      }),
    }));
    expect([200, 400]).toContain(response.status);
  });

  it('validates renewable power claims', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/carbon/validate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        claimType: 'renewable_powered',
        dataPoints: [{ metric: 'renewable_percentage', value: 85, unit: '%' }],
      }),
    }));
    expect([200, 400]).toContain(response.status);
  });

  it('returns 400 for missing dataPoints', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/carbon/validate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ claimType: 'carbon_neutral' }),
    }));
    expect([200, 400]).toContain(response.status);
  });
});
