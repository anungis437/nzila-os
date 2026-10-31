import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// DEF-0B11-SOC-POST-PUBLISHES-AT-ONCE-TO-EVERY-ACTIVE-ACCOUNT-OF-THE-SELECTED-PLATFORMS-AT-STEWARD-FLOOR-WITH-NO-APPROVAL-OR-CLASSIFICATION-CHECK
const m = vi.hoisted(() => ({
  publishPost: vi.fn(),
  persistAtomicAudit: vi.fn(),
  draft: [] as Array<Record<string, unknown>>,
  claim: [] as Array<{ id: string }>,
  updates: [] as Array<Record<string, unknown>>,
  order: [] as string[],
}));

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn(async () => ({ allowed: true, remaining: 9, resetIn: 0 })),
  RATE_LIMITS: { SOCIAL_MEDIA_POST: {} },
}));
vi.mock('@/lib/social-media/social-media-service', () => ({
  createSocialMediaService: () => ({ publishPost: m.publishPost }),
  AllPlatformsFailedError: class extends Error {
    constructor(readonly results: Array<{ error?: string }>) {
      super('none accepted');
    }
  },
}));
vi.mock('@/db', () => ({
  db: {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => m.draft }) }) }) }),
    update: () => ({ set: (row: Record<string, unknown>) => { m.updates.push(row); return { where: async () => undefined }; } }),
  },
}));
vi.mock('@/db/schema/social-media-schema', () => ({
  socialPosts: { id: 'id', organizationId: 'organizationId', status: 'status', postMetadata: 'postMetadata', accountId: 'accountId' },
  socialAccounts: { id: 'id', platform: 'platform' },
}));
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), and: vi.fn(), sql: Object.assign(vi.fn(() => 'sql'), { raw: vi.fn() }) }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({ update: () => ({ set: (row: Record<string, unknown>) => { m.updates.push(row); return { where: () => ({ returning: async () => m.claim }) }; } }) }),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: async (_op: unknown, fn: () => Promise<unknown>) => fn(),
  operationAuditResponse: () => null,
}));
vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (_role: string, handler: (req: NextRequest, ctx: unknown) => Promise<Response>) =>
    (req: NextRequest, ctx: unknown) => handler(req, ctx),
}));

const POST_ID = '22222222-2222-4222-8222-222222222222';
const reviewer = { userId: 'officer_b', organizationId: 'org_1' };
const call = (body: unknown, ctx: unknown = reviewer) =>
  import('../social-media/posts/review/route').then(({ POST }) =>
    POST(new NextRequest('http://localhost/api/social-media/posts/review', { method: 'POST', body: JSON.stringify(body) }), ctx as never));

const pendingDraft = (over: Record<string, unknown> = {}) => ({
  id: POST_ID, accountId: 'acct_1', campaignId: null, content: 'Ratify', mediaUrls: [], linkUrl: null, hashtags: [], scheduledFor: null,
  status: 'draft', createdBy: 'officer_a', platform: 'twitter', postMetadata: { approval: { state: 'pending' } }, ...over,
});

describe('social-media/posts/review — a second officer decides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.updates.length = 0;
    m.order.length = 0;
    m.draft = [pendingDraft()];
    m.claim = [{ id: POST_ID }];
    m.persistAtomicAudit.mockImplementation(async (_tx: unknown, entry: { action: string }) => { m.order.push(entry.action); });
    m.publishPost.mockImplementation(async () => { m.order.push('publish'); return [{ success: true, platform: 'twitter', post_id: 'p1' }]; });
  });

  it('refuses to let the author approve their own post, and publishes nothing', async () => {
    const response = await call({ post_id: POST_ID, decision: 'approve' }, { userId: 'officer_a', organizationId: 'org_1' });
    expect(response.status).toBe(403);
    expect(m.publishPost).not.toHaveBeenCalled();
  });

  it('claims the draft and audits the approval before it publishes, to the one account of the draft only', async () => {
    const response = await call({ post_id: POST_ID, decision: 'approve' });
    expect(response.status).toBe(200);
    expect(m.order).toEqual(['social.post.approve', 'publish']);
    expect(m.publishPost).toHaveBeenCalledWith('org_1', expect.objectContaining({ text: 'Ratify', platforms: ['twitter'] }), 'officer_b', { accountIds: ['acct_1'], existingPostId: POST_ID });
  });

  it('does not publish when the draft was already claimed by another reviewer (409)', async () => {
    m.claim = [];
    const response = await call({ post_id: POST_ID, decision: 'approve' });
    expect(response.status).toBe(409);
    expect(m.publishPost).not.toHaveBeenCalled();
  });

  it('refuses a post that is not a draft awaiting approval, and one of another organization (not found)', async () => {
    m.draft = [pendingDraft({ status: 'published' })];
    expect((await call({ post_id: POST_ID, decision: 'approve' })).status).toBe(409);
    m.draft = [];
    expect((await call({ post_id: POST_ID, decision: 'approve' })).status).toBe(404);
    expect(m.publishPost).not.toHaveBeenCalled();
  });

  it('marks the post failed and answers 502 when no platform accepted it, without the platform text', async () => {
    m.publishPost.mockResolvedValue([{ success: false, platform: 'twitter', error: 'The platform did not accept the post.' }]);
    const response = await call({ post_id: POST_ID, decision: 'approve' });
    expect(response.status).toBe(502);
    expect(m.updates.some((u) => u.status === 'failed')).toBe(true);
  });

  it('rejects with a stated reason, writes the rejection audit and never publishes', async () => {
    const response = await call({ post_id: POST_ID, decision: 'reject', reason: 'Not cleared by communications' });
    expect(response.status).toBe(200);
    expect(m.order).toEqual(['social.post.reject']);
    expect(m.updates[0]).toMatchObject({ status: 'deleted' });
    expect(m.publishPost).not.toHaveBeenCalled();
  });

  it('requires a reason to reject', async () => {
    expect((await call({ post_id: POST_ID, decision: 'reject' })).status).toBe(400);
    expect((await call({ post_id: POST_ID, decision: 'reject', reason: 'no' })).status).toBe(400);
  });
});
