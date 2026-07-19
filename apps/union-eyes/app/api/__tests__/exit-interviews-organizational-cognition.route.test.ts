import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  runFullInstitutionalCognition: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/organizational-operating-intelligence', () => ({ runFullInstitutionalCognition: m.runFullInstitutionalCognition }));

async function loadRoute() {
  return import('../exit-interviews/organizational-cognition/route');
}

describe('exit-interviews/organizational-cognition route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.runFullInstitutionalCognition.mockResolvedValue({
      organizationId: 'org_1',
      startedAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-01T00:00:01.000Z',
      envelopes: [{ provenance: { engine: 'e1' } }],
      failures: [],
    });
  });

  it('returns cognition envelopes keyed by engine', async () => {
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1' });

    expect(result.data.organizationId).toBe('org_1');
    expect(result.data.byEngine.e1).toEqual({ provenance: { engine: 'e1' } });
  });
});