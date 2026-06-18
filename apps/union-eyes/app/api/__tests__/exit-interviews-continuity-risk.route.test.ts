import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  detectContinuityRisks: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { forbidden: (msg: string) => Object.assign(new Error(msg), { status: 403 }) } }));
vi.mock('@/lib/api-auth-guard', () => ({ ROLE_HIERARCHY: { member: 1, officer: 2 }, normalizeRole: (role: string) => role }));
vi.mock('@/lib/knowledge-transfer/continuity-risk/risk-detector', () => ({ detectContinuityRisks: m.detectContinuityRisks }));

async function loadRoute() {
  return import('../exit-interviews/continuity-risk/route');
}

describe('exit-interviews/continuity-risk route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.detectContinuityRisks.mockResolvedValue({ score: 0.2, signals: [] });
  });

  it('returns a continuity risk report', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1', user: { role: 'officer' } });

    expect(result).toEqual({ data: { score: 0.2, signals: [] } });
  });
});