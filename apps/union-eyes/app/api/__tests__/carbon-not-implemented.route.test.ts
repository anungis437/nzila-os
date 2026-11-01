import { describe, expect, it, vi } from 'vitest';

// DEF-0B4-CARBON-FABRICATED-MEASUREMENTS-RETURNED-200: the carbon routes returned invented emissions, renewable
// percentages and a certification verdict as a successful measurement. They answer 501 and return no figure.

vi.mock('@/lib/api/framework', async () => {
  const { ApiError } = await vi.importActual<typeof import('@/lib/api/errors')>('@/lib/api/errors');
  return {
    ApiError,
    withApi: (_cfg: unknown, handler: (c: unknown) => Promise<unknown>) => async () => {
      try {
        return await handler({});
      } catch (error) {
        const status = (error as { code?: string }).code === 'NOT_IMPLEMENTED' ? 501 : 500;
        return { status, body: { error: (error as Error).message, code: (error as { code?: string }).code } };
      }
    },
  };
});

const ROUTES: Array<[string, string, string]> = [
  ['dashboard', 'GET', '../carbon/dashboard/route'],
  ['infrastructure', 'GET', '../carbon/infrastructure/route'],
  ['validate', 'POST', '../carbon/validate/route'],
];

describe.each(ROUTES)('carbon/%s', (_name, method, path) => {
  it(`answers 501 to ${method} and returns no measurement, recommendation or certification outcome`, async () => {
    const mod = (await import(path)) as Record<string, () => Promise<{ status: number; body: Record<string, unknown> }>>;
    const result = await mod[method]();
    expect(result.status).toBe(501);
    const serialized = JSON.stringify(result.body);
    for (const fabricated of ['totalEmissions', 'renewablePercentage', 'certificationEligible', 'validationScore', 'recommendations', '1245.67']) {
      expect(serialized).not.toContain(fabricated);
    }
    expect(serialized).toContain('not implemented');
  });

  it('exports no other method that could answer 200', async () => {
    const mod = (await import(path)) as Record<string, unknown>;
    const exported = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].filter((m) => typeof mod[m] === 'function');
    expect(exported).toEqual([method]);
  });
});
