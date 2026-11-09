import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/with-api', () => ({ withApi: (_config: unknown, handler: (ctx: unknown) => unknown) => handler }));
vi.mock('@/lib/canadian-labour-standards/rule-resolver', () => ({ resolveStatutoryRules: vi.fn(async () => ({ status: 'unknown', reason: 'No reviewed effective rule set', rules: [] })) }));

const request = new Request('http://localhost/api/labour-standards/ON');

describe('GET /api/labour-standards/[jurisdiction]', () => {
  it('publishes no minimum wage rather than a placeholder zero rate, and says why', async () => {
    const { GET } = await import('../labour-standards/[jurisdiction]/route');
    const profile = await (GET as any)({ params: { jurisdiction: 'ON' }, request });
    expect(profile.code).toBe('ON');
    expect(profile.minimumWage).toBeNull();
    expect(profile.minimumWageStatus).toBe('not_published');
    expect(JSON.stringify(profile)).not.toContain('"hourly":0');
  });

  it('answers every jurisdiction the same way, and still refuses an unknown one', async () => {
    const { GET } = await import('../labour-standards/[jurisdiction]/route');
    expect((await (GET as any)({ params: { jurisdiction: 'federal' }, request })).minimumWage).toBeNull();
    await expect((GET as any)({ params: { jurisdiction: 'ZZ' }, request })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});
