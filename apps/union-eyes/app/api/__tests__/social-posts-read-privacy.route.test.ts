import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  roleRequested: '',
  tenant: null as unknown,
  filters: [] as Array<{ column: unknown; value: unknown }>,
  selectedFields: [] as string[],
  selectOutsideTenant: vi.fn(),
  txCalls: 0,
  row: {
    id: 'post-1', organizationId: 'org-a', accountId: 'account-1', status: 'draft',
    content: 'Not yet approved', createdBy: 'private-officer',
    postMetadata: { approval: { state: 'pending', reason: 'private reason' } },
    errorMessage: 'private provider response', platformPostId: 'private-platform-id',
    retryCount: 2,
  } as Record<string, unknown>,
}));
const column = new Proxy({}, { get: (_target, key) => String(key) });
vi.mock('@/db/schema/social-media-schema', () => ({
  socialPosts: column, socialAccounts: column, socialCampaigns: column,
}));
vi.mock('@/db', () => ({ db: { select: (...args: unknown[]) => m.selectOutsideTenant(...args) } }));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: async () => ({ allowed: true }),
  RATE_LIMITS: { SOCIAL_MEDIA_API: {}, SOCIAL_MEDIA_POST: {} },
}));
vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (role: string, handler: (request: NextRequest, context: unknown) => Promise<Response>) =>
    (request: NextRequest, context: { role: string; organizationId: string; userId: string }) => {
      m.roleRequested = role;
      if (context.role === 'member' && role === 'officer') return Promise.resolve(new Response('Forbidden', { status: 403 }));
      return handler(request, context);
    },
}));
vi.mock('@/lib/social-media/social-media-service', () => ({
  createSocialMediaService: vi.fn(), postTypeFor: vi.fn(),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: vi.fn(), operationAuditResponse: vi.fn(),
}));
vi.mock('drizzle-orm', () => ({
  eq: (column: unknown, value: unknown) => { m.filters.push({ column, value }); return { column, value }; },
  and: (...values: unknown[]) => values,
  ilike: (column: unknown, value: unknown) => ({ column, value }),
  desc: (column: unknown) => column,
  count: () => 'count',
  inArray: vi.fn(),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (context: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    m.tenant = context;
    const tx = {
      select: (fields: Record<string, unknown>) => {
        m.txCalls += 1;
        if ('total' in fields) {
          return { from: () => ({ where: async () => [{ total: 1 }] }) };
        }
        m.selectedFields = Object.keys(fields);
        return { from: () => ({ where: () => ({ orderBy: () => ({
          limit: () => ({ offset: async () => [Object.fromEntries(
            Object.keys(fields).map((key) => [key, m.row[key] ?? null]),
          )] }),
        }) }) }) };
      },
    };
    return fn(tx);
  },
}));

const ctx = (role = 'officer') => ({ role, userId: 'officer-a', organizationId: 'org-a' });
const request = (query = '') => new NextRequest(`http://localhost/api/social-media/posts${query}`);

describe('social post workbench read privacy and tenant authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.filters.length = 0;
    m.selectedFields.length = 0;
    m.tenant = null;
    m.txCalls = 0;
    m.roleRequested = '';
  });

  it('refuses member access to unpublished officer work', async () => {
    const { GET } = await import('../social-media/posts/route');
    const response = await GET(request(), ctx('member') as never);
    expect(response.status).toBe(403);
    expect(m.roleRequested).toBe('officer');
    expect(m.tenant).toBeNull();
  });

  it('binds both reads to tenant context and excludes approval, actor and provider details', async () => {
    const { GET } = await import('../social-media/posts/route');
    const response = await GET(request('?limit=10&offset=0'), ctx() as never);
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(m.tenant).toEqual({ organizationId: 'org-a', userId: 'officer-a' });
    expect(m.filters).toContainEqual({ column: 'organizationId', value: 'org-a' });
    expect(m.txCalls).toBe(2);
    expect(m.selectOutsideTenant).not.toHaveBeenCalled();
    const payload = await response.json();
    expect(payload.posts[0]).toMatchObject({ id: 'post-1', content: 'Not yet approved' });
    expect(JSON.stringify(payload)).not.toMatch(/private-officer|private reason|private provider|private-platform-id|postMetadata|retryCount/);
    for (const field of ['createdBy', 'postMetadata', 'errorMessage', 'platformPostId', 'retryCount']) {
      expect(m.selectedFields).not.toContain(field);
    }
  });

  it('refuses malformed status, campaign id and oversized search before querying', async () => {
    const { GET } = await import('../social-media/posts/route');
    for (const query of ['?status=arbitrary', '?campaign_id=other-tenant', `?search=${'x'.repeat(201)}`]) {
      const response = await GET(request(query), ctx() as never);
      expect(response.status).toBe(400);
    }
    expect(m.txCalls).toBe(0);
  });
});
