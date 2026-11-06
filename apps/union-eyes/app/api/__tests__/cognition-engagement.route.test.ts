import { beforeEach, describe, expect, it, vi } from 'vitest';

// DEF-0B5-COGNITION-ENGAGEMENT-NEVER-COMPUTED: nothing computes member-engagement snapshots, so the route no longer lists an empty
// file-backed store as a 200; it answers 501 with the reason, and never reads the store.

const m = vi.hoisted(() => ({ hasMinRole: vi.fn(), listEngagementSnapshots: vi.fn() }));

vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: (handler: (request: unknown, context: unknown) => Promise<Response>) =>
    (request: unknown) => handler(request, { organizationId: 'org-1', userId: 'user-1' }),
}));
vi.mock('@nzila/ue-cognition', () => ({ listEngagementSnapshots: m.listEngagementSnapshots }));

describe('GET /api/cognition/engagement', () => {
  beforeEach(() => {
    m.hasMinRole.mockReset();
    m.listEngagementSnapshots.mockReset().mockReturnValue([]);
  });

  it('answers 501 with the reason instead of an empty 200 list', async () => {
    m.hasMinRole.mockResolvedValue(true);
    const { GET } = await import('../cognition/engagement/route');
    const response = await (GET as unknown as (request: unknown) => Promise<Response>)({});
    expect(response.status).toBe(501);
    const body = await response.json();
    expect(body.error.code).toBe('NOT_IMPLEMENTED');
    expect(body.error.message).toMatch(/no scheduled, organization-scoped engagement scorer exists/);
    expect(body).not.toHaveProperty('members');
    expect(m.listEngagementSnapshots).not.toHaveBeenCalled();
  });

  it('still refuses a caller below steward', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const { GET } = await import('../cognition/engagement/route');
    const response = await (GET as unknown as (request: unknown) => Promise<Response>)({});
    expect(response.status).toBe(403);
  });
});
