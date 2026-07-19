import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  cognitionRegistry: { all: vi.fn() },
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@nzila/organizational-cognition-core', () => ({
  cognitionRegistry: m.cognitionRegistry,
  COGNITION_DOMAINS: ['ops', 'compliance'],
  INSTITUTIONAL_CONCEPTS: ['a', 'b', 'c'],
  INSTITUTIONAL_ONTOLOGY_VERSION: '1.0.0',
  COGNITION_CONTRACT_VERSION: '2.0.0',
}));

async function loadRoute() {
  return import('../cognition/health/route');
}

describe('cognition/health route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: () => Promise<unknown>) =>
      () => handler());
    m.cognitionRegistry.all.mockReturnValue([
      { domains: ['ops', 'compliance'] },
      { domains: ['ops'] },
    ]);
  });

  it('returns a healthy cognition payload', async () => {
    const { GET } = await loadRoute();
    const result = await GET();

    expect(result.data.status).toBe('ok');
    expect(result.data.domainCount).toBe(2);
    expect(result.data.engineCount).toBe(2);
    expect(result.data.missingDomains).toEqual([]);
  });
});