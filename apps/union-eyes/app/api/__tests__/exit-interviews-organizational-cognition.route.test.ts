import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  runFullInstitutionalCognition: vi.fn(),
  checkRateLimit: vi.fn(),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi }));
vi.mock('@/lib/organizational-operating-intelligence', () => ({ runFullInstitutionalCognition: m.runFullInstitutionalCognition }));
// The aggregate guard is real; only the shared limiter backend is mocked (disclosed: the guard was added after this test was written).
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: m.checkRateLimit }));

import { clearAggregateMemo } from '@/lib/organizational-operating-intelligence/aggregate-guard';

async function loadRoute() {
  return import('../exit-interviews/organizational-cognition/route');
}

describe('exit-interviews/organizational-cognition route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearAggregateMemo();
    m.checkRateLimit.mockResolvedValue({ allowed: true, resetIn: 60 });
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
    expect(result.data.complete).toBe(true);
  });

  it('reports a failed engine by code only and never carries the exception text', async () => {
    m.runFullInstitutionalCognition.mockResolvedValue({
      organizationId: 'org_1', startedAt: 'a', completedAt: 'b',
      envelopes: [{ provenance: { engine: 'e1' } }],
      failures: [
        { engineId: 'e2', domain: 'governance', error: 'connect ECONNREFUSED 10.0.0.5:5432 password authentication failed' },
        { engineId: 'e3', domain: 'resilience', error: 'Systems dynamics analysis is not implemented: it is not computed from records.' },
      ],
    });
    const { GET } = await loadRoute();
    const result = await GET({ organizationId: 'org_1' });
    expect(result.data.complete).toBe(false);
    expect(result.data.failures).toEqual([
      { engineId: 'e2', domain: 'governance', code: 'ENGINE_FAILED' },
      { engineId: 'e3', domain: 'resilience', code: 'NOT_IMPLEMENTED' },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/ECONNREFUSED|password/);
  });

  it('answers 503 when every engine failed instead of a success with an empty result', async () => {
    m.runFullInstitutionalCognition.mockResolvedValue({
      organizationId: 'org_1', startedAt: 'a', completedAt: 'b', envelopes: [],
      failures: [{ engineId: 'e2', domain: 'governance', error: 'boom' }],
    });
    const { GET } = await loadRoute();
    await expect(GET({ organizationId: 'org_1' })).rejects.toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('limits a run per organization and reuses a clean result for a short time, never across organizations', async () => {
    const { GET } = await loadRoute();
    await GET({ organizationId: 'org_1' });
    await GET({ organizationId: 'org_1' });
    expect(m.runFullInstitutionalCognition).toHaveBeenCalledTimes(1);
    await GET({ organizationId: 'org_2' });
    expect(m.runFullInstitutionalCognition).toHaveBeenCalledTimes(2);
    expect(m.checkRateLimit).toHaveBeenCalledWith('org:org_1', expect.objectContaining({ identifier: 'cognition-aggregate' }));
    m.checkRateLimit.mockResolvedValue({ allowed: false, resetIn: 30 });
    await expect(GET({ organizationId: 'org_1' })).rejects.toMatchObject({ code: 'RATE_LIMIT_EXCEEDED' });
  });

  it('does not reuse a result that contained a failure', async () => {
    m.runFullInstitutionalCognition.mockResolvedValue({
      organizationId: 'org_1', startedAt: 'a', completedAt: 'b',
      envelopes: [{ provenance: { engine: 'e1' } }],
      failures: [{ engineId: 'e2', domain: 'governance', error: 'boom' }],
    });
    const { GET } = await loadRoute();
    await GET({ organizationId: 'org_1' });
    await GET({ organizationId: 'org_1' });
    expect(m.runFullInstitutionalCognition).toHaveBeenCalledTimes(2);
  });
});