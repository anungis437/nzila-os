import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  filters: [] as Array<{ column: unknown; value: unknown }>,
  selectedFields: [] as string[],
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
vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/db/schema/social-media-schema', () => ({
  socialPosts: column, socialAccounts: column, socialCampaigns: column,
}));
// The ambient `db` is the request's tenant transaction: the route declares `rlsOrgContext`, and the wrapper opens it around the handler.
vi.mock('@/db', () => ({
  db: {
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
  },
}));
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: async () => ({ allowed: true }),
  RATE_LIMITS: { SOCIAL_MEDIA_API: {}, SOCIAL_MEDIA_POST: {} },
}));
vi.mock('@/lib/social-media/social-media-service', () => ({
  createSocialMediaService: vi.fn(), postTypeFor: vi.fn(),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: vi.fn(), operationAuditResponse: vi.fn(),
}));
vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: (column: unknown, value: unknown) => { m.filters.push({ column, value }); return { column, value }; },
  and: (...values: unknown[]) => values,
  ilike: (column: unknown, value: unknown) => ({ column, value }),
  desc: (column: unknown) => column,
  count: () => 'count',
  inArray: vi.fn(),
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: vi.fn() }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

const request = (query = '') => new NextRequest(`http://localhost/api/social-media/posts${query}`);

describe('social post workbench read privacy and tenant authority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.userId = 'officer-a';
    caller.organizationId = 'org-a';
    caller.role = 'officer';
    m.filters.length = 0;
    m.selectedFields.length = 0;
    m.txCalls = 0;
  });

  it('refuses member access to unpublished officer work', async () => {
    caller.role = 'member';
    const { GET } = await import('../social-media/posts/route');
    const response = await GET(request());
    expect(response.status).toBe(403);
    const list = declared.find((entry) => entry.openapi?.summary === 'List the social media posts of the organization');
    expect(list?.auth).toEqual({ minRole: 'officer' });
    expect(m.txCalls).toBe(0);
  });

  it('binds both reads to the organization\u2019s tenant transaction and excludes approval, actor and provider details', async () => {
    const { GET } = await import('../social-media/posts/route');
    const response = await GET(request('?limit=10&offset=0'));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    // The wrapper opens the caller organization's tenant transaction around the handler, and both reads go through it, filtered to the organization.
    const list = declared.find((entry) => entry.openapi?.summary === 'List the social media posts of the organization');
    expect(list?.rlsOrgContext).toBe(true);
    expect(m.filters).toContainEqual({ column: 'organizationId', value: 'org-a' });
    expect(m.txCalls).toBe(2);
    const payload = await response.json();
    expect(payload.posts[0]).toMatchObject({ id: 'post-1', content: 'Not yet approved' });
    expect(JSON.stringify(payload)).not.toMatch(/private-officer|private reason|private provider|private-platform-id|postMetadata|retryCount/);
    for (const field of ['createdBy', 'postMetadata', 'errorMessage', 'platformPostId', 'retryCount']) {
      expect(m.selectedFields).not.toContain(field);
    }
  });

  it('refuses a caller with no active organization before anything is read', async () => {
    caller.organizationId = null;
    const { GET } = await import('../social-media/posts/route');

    expect((await GET(request())).status).toBe(403);
    expect(m.txCalls).toBe(0);
  });

  it('refuses malformed status, campaign id and oversized search before querying', async () => {
    const { GET } = await import('../social-media/posts/route');
    for (const query of ['?status=arbitrary', '?campaign_id=other-tenant', `?search=${'x'.repeat(201)}`]) {
      const response = await GET(request(query));
      expect(response.status).toBe(400);
    }
    expect(m.txCalls).toBe(0);
  });
});
