import { describe, expect, it, vi } from 'vitest';

const { withApi } = vi.hoisted(() => ({
  withApi: vi.fn((config: unknown, handler: unknown) => ({ config, handler })),
}));

vi.mock('@/lib/api/framework', () => ({ withApi }));

import { cognitionRoute } from '../cognition-route';

describe('lib/api/cognition-route', () => {
  it('configures auth + entitlement and splits the envelope payload', async () => {
    const engine = vi.fn(async (orgId: string) => ({
      payload: { score: 1, org: orgId },
      reasoning: 'because',
      governance: 'ok',
    }));

    const route = cognitionRoute(engine) as unknown as {
      config: { auth: { required: boolean; minRole: string }; entitlement: string };
      handler: (ctx: { organizationId: string }) => Promise<unknown>;
    };

    expect(withApi).toHaveBeenCalledTimes(1);
    expect(route.config.auth).toEqual({ required: true, minRole: 'officer' });
    expect(route.config.entitlement).toBe('union_knowledge_suite');

    const result = await route.handler({ organizationId: 'org-9' });
    expect(engine).toHaveBeenCalledWith('org-9');
    expect(result).toEqual({
      data: { score: 1, org: 'org-9' },
      explainability: { reasoning: 'because', governance: 'ok' },
    });
  });
});
