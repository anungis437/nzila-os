import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({ evaluateFeatures: vi.fn() }));

vi.mock('@/lib/api-auth-guard', () => ({
  withApiAuth: (handler: (req: NextRequest, ctx: Record<string, unknown>) => Promise<Response>) =>
    (req: NextRequest) => handler(req, { userId: 'user-1', organizationId: 'org-1' }),
}));
vi.mock('@/lib/services/feature-flags', () => ({
  evaluateFeatures: m.evaluateFeatures,
  LRO_FEATURES: { A: 'lro-a' },
  AI_FEATURES: { B: 'ai-b' },
}));

async function get(query: string) {
  const { GET } = await import('../feature-flags/route');
  return GET(new NextRequest(`http://localhost/api/feature-flags${query}`));
}

describe('feature-flags route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.evaluateFeatures.mockResolvedValue({ 'lro-a': true });
  });

  // DEF-0B8-FED-FLAGS-ANY-SIGNED-IN-USER-CAN-PROBE-ANY-FLAG-NAME
  it('refuses a flag name the application does not define, without evaluating it', async () => {
    const response = await get('?flag=unreleased-secret-feature');
    expect(response.status).toBe(404);
    expect(m.evaluateFeatures).not.toHaveBeenCalled();
  });

  it('answers a defined flag', async () => {
    const response = await get('?flag=lro-a');
    expect(response.status).toBe(200);
    expect((await response.json()).enabled).toBe(true);
  });

  it('answers pilot-mode without a flag-store lookup', async () => {
    const response = await get('?flag=pilot-mode');
    expect(response.status).toBe(200);
    expect(m.evaluateFeatures).not.toHaveBeenCalled();
  });
});
