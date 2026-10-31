import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({ withApiAuth: vi.fn() }));
vi.mock('@/lib/api-auth-guard', () => ({ withApiAuth: m.withApiAuth }));

async function loadRoute() { return import('../jurisdiction-rules/route'); }

describe('jurisdiction rules: legal deadline domain separation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApiAuth.mockImplementation((handler: (request: NextRequest) => Promise<Response>) => handler);
  });

  it('never serves a workers-compensation period as an arbitration deadline', async () => {
    const { GET } = await loadRoute();
    // A category the register does not hold is now refused outright instead of answering success with an empty list.
    const response = await GET(new NextRequest('http://localhost/api/jurisdiction-rules?jurisdiction=CA-ON&category=arbitration_deadline'));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toMatchObject({ success: false, code: 'INVALID_CATEGORY' });
    expect(body.data).toBeUndefined();
  });

  it('refuses an unknown or inherited jurisdiction code instead of answering success with no rules', async () => {
    const { GET } = await loadRoute();
    for (const code of ['CA-XX', 'constructor', '__proto__', 'toString']) {
      const response = await GET(new NextRequest(`http://localhost/api/jurisdiction-rules?jurisdiction=${code}`));
      expect(response.status, code).toBe(400);
      expect(await response.json()).toMatchObject({ success: false, code: 'INVALID_JURISDICTION' });
    }
  });

  it('preserves board reference without asserting an unqualified filing period', async () => {
    const { GET } = await loadRoute();
    const response = await GET(new NextRequest('http://localhost/api/jurisdiction-rules?jurisdiction=CA-ON&category=workers_compensation_board_reference'));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      ruleCategory: 'workers_compensation_board_reference',
      parameters: { boardAcronym: 'WSIB', verificationRequired: true },
    });
    expect(body.data[0].parameters).not.toHaveProperty('deadline_days');
  });
});
