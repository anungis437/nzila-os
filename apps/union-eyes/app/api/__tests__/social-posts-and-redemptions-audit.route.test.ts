import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  publishPost: vi.fn(),
  deletePost: vi.fn(),
  persistAtomicAudit: vi.fn(),
  cancelRedemption: vi.fn(),
  selected: [] as unknown[],
  order: [] as string[],
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, resetIn: 0 })),
  RATE_LIMITS: { SOCIAL_MEDIA_POST: {}, SOCIAL_MEDIA_API: {} },
}));
vi.mock('@/lib/social-media/social-media-service', () => ({
  createSocialMediaService: () => ({ publishPost: m.publishPost, deletePost: m.deletePost }),
}));
vi.mock('@/db', () => ({
  db: {
    select: () => ({ from: () => ({ leftJoin: () => ({ where: () => ({ limit: async () => m.selected }) }) }) }),
  },
}));
vi.mock('@/db/schema/social-media-schema', () => ({
  socialPosts: { id: 'id', accountId: 'accountId' },
  socialAccounts: { id: 'id', organizationId: 'organizationId' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => 'eq'), and: vi.fn(), ilike: vi.fn(), desc: vi.fn(), count: vi.fn() }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: vi.fn(async (_ctx: unknown, fn: (t: unknown) => Promise<unknown>) => fn({})),
}));
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
    m.persistAtomicAudit.mockImplementation(async (_tx: unknown, entry: { action: string }) => {
      m.order.push(entry.action);
    });
    m.publishPost.mockImplementation(async () => {
      m.order.push('publish');
      return [{ success: true, platform: 'twitter' }];
    });
    m.deletePost.mockImplementation(async () => {
      m.order.push('delete');
    });
  });

  const publish = () =>
    new NextRequest('http://localhost/api/social-media/posts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ platforms: ['twitter'], content: 'Vote Yes on the ratification' }),
    });

  it('records the intent before publishing and the outcome after, without the post text', async () => {
    const { POST } = await import('../social-media/posts/route');
    const response = await POST(publish(), ctx as never);

    expect(response.status).toBe(200);
    expect(m.order).toEqual(['social.post.publish.requested', 'publish', 'social.post.publish.completed']);
    expect(JSON.stringify(m.persistAtomicAudit.mock.calls)).not.toContain('Vote Yes');
  });

  it('does not publish when the intent cannot be recorded', async () => {
    const { POST } = await import('../social-media/posts/route');
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit unavailable'));

    const response = await POST(publish(), ctx as never);

    expect(response.status).toBe(409);
    expect(m.publishPost).not.toHaveBeenCalled();
  });

  it('audits a post deletion around the platform call, and does not delete another organization\u2019s post', async () => {
    const { DELETE } = await import('../social-media/posts/route');
    const response = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=post_1', { method: 'DELETE' }), ctx as never);

    expect(response.status).toBe(200);
    expect(m.order).toEqual(['social.post.delete.requested', 'delete', 'social.post.delete.completed']);

    m.order.length = 0;
    m.deletePost.mockClear();
    m.selected = [{ id: 'post_2', orgId: 'org_other' }];
    const refused = await DELETE(new NextRequest('http://localhost/api/social-media/posts?id=post_2', { method: 'DELETE' }), ctx as never);
    expect(refused.status).toBe(403);
    expect(m.deletePost).not.toHaveBeenCalled();
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
