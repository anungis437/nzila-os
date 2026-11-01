import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  publishPost: vi.fn(),
  deletePost: vi.fn(),
  removeFromPlatform: vi.fn(),
  updates: [] as Array<Record<string, unknown>>,
  persistAtomicAudit: vi.fn(),
  cancelRedemption: vi.fn(),
  accounts: [] as Array<{ id: string; platform: string }>,
  drafts: [] as Array<Record<string, unknown>>,
  withRLSContext: vi.fn(),
  selected: [] as unknown[],
  order: [] as string[],
}));

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
vi.mock('@/db', () => ({
  db: {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => m.selected }) }), where: async () => m.accounts }) }),
  },
}));
vi.mock('@/db/schema/social-media-schema', () => ({
  socialPosts: { id: 'id', accountId: 'accountId', organizationId: 'organizationId' },
  socialCampaigns: { id: 'id', organizationId: 'organizationId' },
  socialAccounts: { id: 'id', organizationId: 'organizationId' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => 'eq'), and: vi.fn(), ilike: vi.fn(), desc: vi.fn(), count: vi.fn(), inArray: vi.fn() }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/services/rewards/redemption-service', () => ({
  cancelRedemption: m.cancelRedemption,
  listUserRedemptions: vi.fn(),
}));
vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (_role: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    (req: NextRequest, ctx: unknown = { userId: 'u1', organizationId: 'org_1' }) => handler(req, ctx),
}));

const ctx = { userId: 'steward_1', organizationId: 'org_1' };

describe('social-media/posts — external effects are audited around the operation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.order.length = 0;
    m.selected = [{ id: 'post_1', orgId: 'org_1' }];
    m.accounts = [{ id: '11111111-1111-4111-8111-111111111111', platform: 'twitter' }];
    m.drafts.length = 0;
    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
      fn({ update: () => ({ set: (v: Record<string, unknown>) => ({ where: async () => { m.updates.push(v); m.order.push('local-update'); } }) }), insert: () => ({ values: (row: Record<string, unknown>) => { m.drafts.push(row); return { returning: async () => [{ id: `draft_${m.drafts.length}`, accountId: row.accountId }] }; } }) }));
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

  // DEF-0B11-SOC-POST-PUBLISHES-AT-ONCE-TO-EVERY-ACTIVE-ACCOUNT-OF-THE-SELECTED-PLATFORMS-AT-STEWARD-FLOOR-WITH-NO-APPROVAL-OR-CLASSIFICATION-CHECK
  it('saves a draft for each named account and publishes nothing, auditing the draft without the post text', async () => {
    const { POST } = await import('../social-media/posts/route');
    const response = await POST(publish(), ctx as never);

    expect(response.status).toBe(202);
    expect((await response.json()).status).toBe('pending_approval');
    expect(m.publishPost).not.toHaveBeenCalled();
    expect(m.drafts).toHaveLength(1);
    expect(m.drafts[0]).toMatchObject({ status: 'draft', accountId: ACCOUNT, createdBy: 'steward_1' });
    expect(m.order).toEqual(['social.post.draft']);
    expect(JSON.stringify(m.persistAtomicAudit.mock.calls)).not.toContain('Vote Yes');
  });

  it('refuses an account that is not an active account of the organization on a selected platform', async () => {
    const { POST } = await import('../social-media/posts/route');
    m.accounts = [];
    expect((await POST(publish(), ctx as never)).status).toBe(400);
    m.accounts = [{ id: ACCOUNT, platform: 'facebook' }];
    expect((await POST(publish(), ctx as never)).status).toBe(400);
    expect(m.drafts).toHaveLength(0);
  });

  it('requires the post to name its accounts', async () => {
    const { POST } = await import('../social-media/posts/route');
    expect((await POST(publish({ account_ids: undefined }), ctx as never)).status).toBe(400);
  });

  it('writes no draft when the draft audit cannot be written', async () => {
    const { POST } = await import('../social-media/posts/route');
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));
    expect((await POST(publish(), ctx as never)).status).toBe(500);
    expect(m.publishPost).not.toHaveBeenCalled();
  });

  it('audits a post deletion around the platform call and the local state change in its own transaction, and does not delete another organization\u2019s post', async () => {
    const { DELETE } = await import('../social-media/posts/route');
    const response = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=post_1', { method: 'DELETE' }), ctx as never);

    expect(response.status).toBe(200);
    expect(m.order).toEqual(['social.post.delete.requested', 'delete', 'social.post.delete.completed', 'local-update', 'social.post.deleted']);
    expect(m.updates[0]).toMatchObject({ status: 'deleted' });

    m.order.length = 0;
    m.removeFromPlatform.mockClear();
    // The lookup names the caller organization, so another organization's post is simply not found.
    m.selected = [];
    const refused = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=post_2', { method: 'DELETE' }), ctx as never);
    expect(refused.status).toBe(404);
    expect(m.removeFromPlatform).not.toHaveBeenCalled();
  });

  it('F06 A3: a platform failure leaves the row published, says so, and writes no deleted record', async () => {
    const { DELETE } = await import('../social-media/posts/route');
    m.removeFromPlatform.mockRejectedValueOnce(new Error('platform down'));

    const response = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=post_1', { method: 'DELETE' }), ctx as never);
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

    const first = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=post_1', { method: 'DELETE' }), ctx as never);
    expect(first.status).toBe(502);
    expect((await first.json()).code).toBe('LOCAL_STATE_PENDING');

    m.removeFromPlatform.mockResolvedValueOnce({ alreadyRemoved: true });
    const repeat = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=post_1', { method: 'DELETE' }), ctx as never);
    expect(repeat.status).toBe(200);
    expect(m.persistAtomicAudit).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'social.post.deleted', details: { alreadyRemovedOnPlatform: true } }),
    );
  });
});

describe('rewards/redemptions POST (cancel)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.cancelRedemption.mockResolvedValue({ redemption: { id: 'r1' }, newBalance: 10 });
  });

  const cancel = (id = '11111111-1111-4111-8111-111111111111') =>
    new NextRequest('http://localhost/api/rewards/redemptions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ redemptionId: id, reason: 'changed my mind' }),
    });

  it('cancels only on behalf of the owning member (the caller), in the caller\u2019s organization', async () => {
    const { POST } = await import('../rewards/redemptions/route');
    await POST(cancel(), { userId: 'member_1', organizationId: 'org_1' } as never);

    expect(m.cancelRedemption).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', 'org_1', 'member_cancelled: changed my mind', { userId: 'member_1', mustOwn: true });
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org_1' }, expect.any(Function));
  });

  it('returns a cancellation receipt without provider payload or checkout identifiers', async () => {
    m.cancelRedemption.mockResolvedValueOnce({
      redemption: { id: 'r1', status: 'cancelled', creditsSpent: 12,
        providerCheckoutId: 'private-checkout', providerOrderId: 'private-order',
        providerPayloadJson: { customer: { email: 'private@example.test' } } },
      newBalance: 42,
    });
    const { POST } = await import('../rewards/redemptions/route');
    const response = await POST(cancel(), { userId: 'member_1', organizationId: 'org_1' } as never);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(/private-checkout|private-order|private@example/);
    expect(body.data?.redemption).toMatchObject({ id: 'r1', status: 'cancelled', creditsSpent: 12 });
    expect(body.data?.newBalance).toBe(42);
  });

  it('does not cancel when tenant binding fails', async () => {
    m.withRLSContext.mockRejectedValueOnce(new Error('tenant binding refused'));
    const { POST } = await import('../rewards/redemptions/route');
    const response = await POST(cancel(), { userId: 'member_1', organizationId: 'org_1' } as never);
    expect(response.status).toBe(500);
    expect(m.cancelRedemption).not.toHaveBeenCalled();
  });
  it('rejects an initiation body on the cancel path instead of discarding it', async () => {
    const { POST } = await import('../rewards/redemptions/route');
    const request = new NextRequest('http://localhost/api/rewards/redemptions?id=r1', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ programId: '11111111-1111-4111-8111-111111111111', creditsToSpend: 10 }),
    });

    const response = await POST(request, { userId: 'member_1', organizationId: 'org_1' } as never);

    expect(response.status).toBe(400);
    expect(m.cancelRedemption).not.toHaveBeenCalled();
  });

  it('answers 404 when the redemption is someone else\u2019s', async () => {
    const { POST } = await import('../rewards/redemptions/route');
    m.cancelRedemption.mockRejectedValueOnce(new Error('Redemption not found'));

    const response = await POST(cancel('22222222-2222-4222-8222-222222222222'), { userId: 'member_1', organizationId: 'org_1' } as never);

    expect(response.status).toBe(404);
  });
});
