import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => {
  const state = {
    publishPost: vi.fn(),
    deletePost: vi.fn(),
    removeFromPlatform: vi.fn(),
    updates: [] as Array<Record<string, unknown>>,
    persistAtomicAudit: vi.fn(),
    accounts: [] as Array<{ id: string; platform: string }>,
    drafts: [] as Array<Record<string, unknown>>,
    withRLSContext: vi.fn(),
    selected: [] as unknown[],
    order: [] as string[],
    // The ambient handle inside the request's tenant transaction (`rlsOrgContext`): the reads of the accounts and the draft inserts go through it.
    db: {} as Record<string, unknown>,
  };
  state.db = {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => state.selected }) }), where: async () => state.accounts }) }),
    insert: () => ({ values: (row: Record<string, unknown>) => { state.drafts.push(row); return { returning: async () => [{ id: `draft_${state.drafts.length}`, accountId: row.accountId }] }; } }),
  };
  return state;
});

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, resetIn: 0 })),
  RATE_LIMITS: { SOCIAL_MEDIA_POST: {}, SOCIAL_MEDIA_API: {} },
}));
vi.mock('@/lib/social-media/social-media-service', () => ({
  createSocialMediaService: () => ({ publishPost: m.publishPost, deletePost: m.deletePost, removeFromPlatform: m.removeFromPlatform }),
  postTypeFor: () => 'text',
  AllPlatformsFailedError: class extends Error {
    results: unknown[] = [];
  },
}));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema/social-media-schema', () => ({
  socialPosts: { id: 'id', accountId: 'accountId', organizationId: 'organizationId' },
  socialCampaigns: { id: 'id', organizationId: 'organizationId' },
  socialAccounts: { id: 'id', organizationId: 'organizationId' },
}));
vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: vi.fn(() => 'eq'), and: vi.fn(), ilike: vi.fn(), desc: vi.fn(), count: vi.fn(), inArray: vi.fn(),
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

describe('social-media/posts — external effects are audited around the operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.userId = 'steward_1';
    caller.organizationId = 'org_1';
    caller.role = 'officer';
    m.order.length = 0;
    m.selected = [{ id: 'post_1', orgId: 'org_1' }];
    m.accounts = [{ id: '11111111-1111-4111-8111-111111111111', platform: 'twitter' }];
    m.drafts.length = 0;
    // The tenant transaction of the deletion's own steps: the lookup and the local state change.
    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => m.selected }) }) }) }),
        update: () => ({ set: (v: Record<string, unknown>) => ({ where: async () => { m.updates.push(v); m.order.push('local-update'); } }) }),
        insert: () => ({ values: (row: Record<string, unknown>) => { m.drafts.push(row); return { returning: async () => [{ id: `draft_${m.drafts.length}`, accountId: row.accountId }] }; } }),
      }));
    m.persistAtomicAudit.mockImplementation(async (_tx: unknown, entry: { action: string }) => {
      m.order.push(entry.action);
    });
    m.publishPost.mockImplementation(async () => {
      m.order.push('publish');
      return [{ success: true, platform: 'twitter' }];
    });
    m.updates.length = 0;
    m.removeFromPlatform.mockImplementation(async () => {
      m.order.push('delete');
      return { alreadyRemoved: false };
    });
  });

  const ACCOUNT = '11111111-1111-4111-8111-111111111111';
  const publish = (extra: Record<string, unknown> = {}) =>
    new NextRequest('http://localhost/api/social-media/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platforms: ['twitter'], content: 'Vote Yes on the ratification', account_ids: [ACCOUNT], ...extra }),
    });

  it('declares what it asks of the wrapper: an officer for the draft, in the organization\'s tenant transaction, and a steward for the deletion, which runs its own transactions around the platform call', async () => {
    await import('../social-media/posts/route');
    const draft = declared.find((entry) => entry.openapi?.summary === 'Save a social media post as a draft awaiting approval');
    const removal = declared.find((entry) => entry.openapi?.summary === 'Delete a social media post from its platform and mark it deleted');

    expect(draft?.auth).toEqual({ minRole: 'officer' });
    expect(draft?.rlsOrgContext).toBe(true);
    expect(removal?.auth).toEqual({ minRole: 'steward' });
    expect(removal?.rlsOrgContext).toBeUndefined();
  });

  // DEF-0B11-SOC-POST-PUBLISHES-AT-ONCE-TO-EVERY-ACTIVE-ACCOUNT-OF-THE-SELECTED-PLATFORMS-AT-STEWARD-FLOOR-WITH-NO-APPROVAL-OR-CLASSIFICATION-CHECK
  it('saves a draft for each named account and publishes nothing, auditing the draft without the post text', async () => {
    const { POST } = await import('../social-media/posts/route');
    const response = await POST(publish());

    expect(response.status).toBe(202);
    expect((await response.json()).status).toBe('pending_approval');
    expect(m.publishPost).not.toHaveBeenCalled();
    expect(m.drafts).toHaveLength(1);
    expect(m.drafts[0]).toMatchObject({ status: 'draft', accountId: ACCOUNT, createdBy: 'steward_1', organizationId: 'org_1' });
    expect(m.order).toEqual(['social.post.draft']);
    // The draft and its audit record are written through the same handle: the request's tenant transaction.
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(m.db, expect.objectContaining({ action: 'social.post.draft', organizationId: 'org_1', userId: 'steward_1' }));
    expect(JSON.stringify(m.persistAtomicAudit.mock.calls)).not.toContain('Vote Yes');
  });

  it('refuses a steward the draft, which takes an officer, before anything is read or written', async () => {
    caller.role = 'steward';
    const { POST } = await import('../social-media/posts/route');

    expect((await POST(publish())).status).toBe(403);
    expect(m.drafts).toHaveLength(0);
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('refuses an account that is not an active account of the organization on a selected platform', async () => {
    const { POST } = await import('../social-media/posts/route');
    m.accounts = [];
    expect((await POST(publish())).status).toBe(400);
    m.accounts = [{ id: ACCOUNT, platform: 'facebook' }];
    expect((await POST(publish())).status).toBe(400);
    expect(m.drafts).toHaveLength(0);
  });

  it('requires the post to name its accounts', async () => {
    const { POST } = await import('../social-media/posts/route');
    expect((await POST(publish({ account_ids: undefined }))).status).toBe(400);
  });

  it('writes no draft when the draft audit cannot be written', async () => {
    const { POST } = await import('../social-media/posts/route');
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    expect((await POST(publish())).status).toBe(500);
    expect(m.publishPost).not.toHaveBeenCalled();
  });

  it('audits a post deletion around the platform call and the local state change in its own transaction, and does not delete another organization\u2019s post', async () => {
    const { DELETE } = await import('../social-media/posts/route');
    const response = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=11111111-1111-4111-8111-1111111111aa', { method: 'DELETE' }));

    expect(response.status).toBe(200);
    expect(m.order).toEqual(['social.post.delete.requested', 'delete', 'social.post.delete.completed', 'local-update', 'social.post.deleted']);
    expect(m.updates[0]).toMatchObject({ status: 'deleted' });

    m.order.length = 0;
    m.removeFromPlatform.mockClear();
    // The lookup names the caller organization, so another organization's post is simply not found.
    m.selected = [];
    const refused = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=11111111-1111-4111-8111-1111111111bb', { method: 'DELETE' }));
    expect(refused.status).toBe(404);
    expect(m.removeFromPlatform).not.toHaveBeenCalled();
  });

  it('refuses a member the deletion before anything is looked up, audited or removed', async () => {
    caller.role = 'member';
    const { DELETE } = await import('../social-media/posts/route');

    const response = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=11111111-1111-4111-8111-1111111111aa', { method: 'DELETE' }));

    expect(response.status).toBe(403);
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.removeFromPlatform).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('answers 400, and looks nothing up, for a post id that is not a valid id', async () => {
    const { DELETE } = await import('../social-media/posts/route');

    const response = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=post_1', { method: 'DELETE' }));

    expect(response.status).toBe(400);
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(m.removeFromPlatform).not.toHaveBeenCalled();
  });

  it('F06 A3: a platform failure leaves the row published, says so, and writes no deleted record', async () => {
    const { DELETE } = await import('../social-media/posts/route');
    m.removeFromPlatform.mockRejectedValueOnce(new Error('platform down'));

    const response = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=11111111-1111-4111-8111-1111111111aa', { method: 'DELETE' }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toMatchObject({ code: 'PLATFORM_REMOVAL_FAILED', retryable: true });
    expect(m.updates).toHaveLength(0);
    expect(m.order).toEqual(['social.post.delete.requested', 'social.post.delete.failed']);
  });

  it('F06 A3: a local failure after the platform removal is reported as pending, never as deleted, and a repeat completes it', async () => {
    const { DELETE } = await import('../social-media/posts/route');
    m.persistAtomicAudit.mockImplementationOnce(async (_tx: unknown, entry: { action: string }) => { m.order.push(entry.action); });
    m.persistAtomicAudit.mockImplementationOnce(async (_tx: unknown, entry: { action: string }) => { m.order.push(entry.action); });
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'));

    const first = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=11111111-1111-4111-8111-1111111111aa', { method: 'DELETE' }));
    expect(first.status).toBe(502);
    expect((await first.json()).code).toBe('LOCAL_STATE_PENDING');

    m.removeFromPlatform.mockResolvedValueOnce({ alreadyRemoved: true });
    const repeat = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=11111111-1111-4111-8111-1111111111aa', { method: 'DELETE' }));
    expect(repeat.status).toBe(200);
    expect(m.persistAtomicAudit).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'social.post.deleted', details: { alreadyRemovedOnPlatform: true } }),
    );
  });
});
