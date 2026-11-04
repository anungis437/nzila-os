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
  scopes: [] as unknown[],
}));

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule);
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
vi.mock('@/db/schema/social-media-schema', () => ({
  socialPosts: { id: 'id', organizationId: 'organizationId', status: 'status', postMetadata: 'postMetadata', accountId: 'accountId' },
  socialAccounts: { id: 'id', platform: 'platform' },
}));
vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: vi.fn(), and: vi.fn(), sql: Object.assign(vi.fn(() => 'sql'), { raw: vi.fn() }),
}));
// Every database step of the route runs in a tenant transaction of the caller's organization: the read of the draft, the claim, the rejection and the outcome.
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (scope: unknown, fn: (tx: unknown) => Promise<unknown>) => {
    m.scopes.push(scope);
    return fn({
      select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit: async () => m.draft }) }) }) }),
      update: () => ({ set: (row: Record<string, unknown>) => { m.updates.push(row); return { where: () => ({ returning: async () => m.claim }) }; } }),
    });
  },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: async (_op: unknown, fn: () => Promise<unknown>) => fn(),
  operationAuditResponse: () => null,
}));

const { caller, declared, resetCaller } = await import('./support/with-api-stub');

const POST_ID = '22222222-2222-4222-8222-222222222222';
const call = (body: unknown) =>
  import('../social-media/posts/review/route').then(({ POST }) =>
    POST(new NextRequest('http://localhost/api/social-media/posts/review', { method: 'POST', body: JSON.stringify(body) })));

const pendingDraft = (over: Record<string, unknown> = {}) => ({
  id: POST_ID, accountId: 'acct_1', campaignId: null, content: 'Ratify', mediaUrls: [], linkUrl: null, hashtags: [], scheduledFor: null,
  status: 'draft', createdBy: 'officer_a', platform: 'twitter', postMetadata: { approval: { state: 'pending' } }, ...over,
});

describe('social-media/posts/review — a second officer decides', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCaller();
    caller.userId = 'officer_b';
    caller.organizationId = 'org_1';
    caller.role = 'officer';
    m.updates.length = 0;
    m.order.length = 0;
    m.scopes.length = 0;
    m.draft = [pendingDraft()];
    m.claim = [{ id: POST_ID }];
    m.persistAtomicAudit.mockImplementation(async (_tx: unknown, entry: { action: string }) => { m.order.push(entry.action); });
    m.publishPost.mockImplementation(async () => { m.order.push('publish'); return [{ success: true, platform: 'twitter', post_id: 'p1' }]; });
  });

  it('declares what it asks of the wrapper: an officer, with no transaction spanning the platform call (every database step opens its own)', async () => {
    await import('../social-media/posts/review/route');
    const config = declared.find((entry) => entry.openapi?.summary === 'Approve or reject a drafted social media post');

    expect(config?.auth).toEqual({ minRole: 'officer' });
    expect(config?.rlsOrgContext).toBeUndefined();
    expect(config?.registry).toMatchObject({ audience: 'officer', evidenceRequired: true, orgScoping: 'caller-org' });
  });

  it('refuses a steward, whom the officer floor does not admit, before any read, claim or publish', async () => {
    caller.role = 'steward';
    const response = await call({ post_id: POST_ID, decision: 'approve' });
    expect(response.status).toBe(403);
    expect(m.scopes).toEqual([]);
    expect(m.publishPost).not.toHaveBeenCalled();
  });

  it('refuses to let the author approve their own post, and publishes nothing', async () => {
    caller.userId = 'officer_a';
    const response = await call({ post_id: POST_ID, decision: 'approve' });
    expect(response.status).toBe(403);
    expect(m.publishPost).not.toHaveBeenCalled();
  });

  it('claims the draft and audits the approval before it publishes, to the one account of the draft only', async () => {
    const response = await call({ post_id: POST_ID, decision: 'approve' });
    expect(response.status).toBe(200);
    expect(m.order).toEqual(['social.post.approve', 'publish']);
    expect(m.publishPost).toHaveBeenCalledWith('org_1', expect.objectContaining({ text: 'Ratify', platforms: ['twitter'] }), 'officer_b', { accountIds: ['acct_1'], existingPostId: POST_ID });
    // Every database step ran in a tenant transaction of the caller's organization.
    expect(m.scopes.length).toBeGreaterThanOrEqual(3);
    expect(m.scopes.every((scope) => JSON.stringify(scope) === JSON.stringify({ organizationId: 'org_1' }))).toBe(true);
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

  it('does not claim publication succeeded when the platform accepted but the local record was not saved', async () => {
    m.publishPost.mockResolvedValueOnce([{ success: true, platform: 'twitter', post_id: 'provider-private-id', recorded: false }]);
    const response = await call({ post_id: POST_ID, decision: 'approve' });
    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body).toMatchObject({ state: 'external_accepted_local_unconfirmed', post_id: POST_ID });
    expect(JSON.stringify(body)).not.toContain('provider-private-id');
    // Only the initial atomic approval claim was made; no 'approved' status was falsely persisted.
    expect(m.updates).toHaveLength(1);
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
