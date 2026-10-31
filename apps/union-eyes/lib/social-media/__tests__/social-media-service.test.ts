/**
 * Social Media Service — Test Suite
 *
 * Drives the unified orchestration service (getClient, refreshAccessToken,
 * publishPost, deletePost, fetchAnalytics, getRateLimitStatus, detectPostType,
 * createSocialMediaService) through a table-aware Drizzle mock plus mocked
 * platform client factories and a stubbed global fetch.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Provider tokens are stored sealed (B91); a deterministic stand-in for the secret service keeps these tests free of key material.
vi.mock('@/lib/encryption', () => ({
  encryptSecret: async (value: string) => `sealed(${value})`,
  decryptSecret: async (value: string) => value.replace(/^sealed\((.*)\)$/, '$1'),
}));

const state = vi.hoisted(() => ({
  selects: {} as Record<string, unknown>,
  inserts: {} as Record<string, unknown>,
  updates: {} as Record<string, unknown>,
}));

const dbMock = vi.hoisted(() => {
  function resolveResult(c: any) {
    const name = c._table?.__name;
    if (c._op === 'insert') return c._returning ? state.inserts[name] ?? [{ id: `${name}-new` }] : undefined;
    if (c._op === 'update') return c._returning ? state.updates[name] ?? [{ id: `${name}-upd` }] : undefined;
    if (c._op === 'select') return state.selects[name] ?? [];
    return undefined;
  }
  function makeBuilder() {
    function chain(op: string, table: any) {
      const c: any = {
        _op: op,
        _table: table,
        _returning: false,
        from(t: any) { c._table = t; return c; },
        innerJoin() { return c; },
        leftJoin() { return c; },
        where() { return c; },
        orderBy() { return c; },
        limit() { return c; },
        groupBy() { return c; },
        values(v: any) { c._values = v; return c; },
        set(v: any) { c._set = v; return c; },
        onConflictDoUpdate() { return c; },
        returning() { c._returning = true; return c; },
        then(resolve: (v: unknown) => void, reject: (e: unknown) => void) {
          try { resolve(resolveResult(c)); } catch (e) { reject(e); }
        },
      };
      return c;
    }
    return {
      insert: (t: any) => chain('insert', t),
      select: (_shape?: any) => chain('select', null),
      update: (t: any) => chain('update', t),
      delete: (t: any) => chain('delete', t),
    };
  }
  return { ...makeBuilder(), transaction: async (cb: (tx: unknown) => unknown) => cb(makeBuilder()) };
});

vi.mock('@/db', () => ({ db: dbMock }));

vi.mock('@/db/schema/social-media-schema', () => {
  const t = (name: string) => new Proxy({ __name: name }, { get: (o: any, k) => (k in o ? o[k] : { __col: String(k) }) });
  return {
    socialAccounts: t('socialAccounts'),
    socialPosts: t('socialPosts'),
    socialAnalytics: t('socialAnalytics'),
  };
});

vi.mock('drizzle-orm', () => ({
  eq: (...a: unknown[]) => ({ __op: 'eq', a }),
  and: (...a: unknown[]) => ({ __op: 'and', a }),
  inArray: (...a: unknown[]) => ({ __op: 'inArray', a }),
}));

// Platform client mocks — shared instances so tests can assert/configure.
const clients = vi.hoisted(() => ({
  meta: {} as any,
  twitter: {} as any,
  linkedin: {} as any,
}));

vi.mock('../meta-api-client', () => ({
  MetaAPIClient: class {},
  createMetaClient: vi.fn(() => clients.meta),
}));
vi.mock('../twitter-api-client', () => ({
  TwitterAPIClient: class {},
  createTwitterClient: vi.fn(() => clients.twitter),
}));
vi.mock('../linkedin-api-client', () => ({
  LinkedInAPIClient: class {},
  createLinkedInClient: vi.fn(() => clients.linkedin),
}));

import { SocialMediaService, createSocialMediaService } from '../social-media-service';

function account(overrides: Record<string, unknown> = {}) {
  return {
    id: 'acct-1',
    organizationId: 'org-1',
    platform: 'twitter',
    platformUserId: 'puid-1',
    accessToken: 'token-1',
    refreshToken: 'refresh-1',
    tokenExpiresAt: null,
    status: 'active',
    ...overrides,
  };
}

beforeEach(() => {
  state.selects = {};
  state.inserts = {};
  state.updates = {};

  clients.meta = {
    publishFacebookPost: vi.fn().mockResolvedValue({ id: 'fb-post-1', permalink_url: 'https://fb/p/1' }),
    publishInstagramPost: vi.fn().mockResolvedValue({ id: 'ig-post-1', permalink: 'https://ig/p/1' }),
    deletePost: vi.fn().mockResolvedValue({ success: true }),
    getPageInsights: vi.fn().mockResolvedValue([]),
    getInstagramInsights: vi.fn().mockResolvedValue([]),
    getLongLivedToken: vi.fn().mockResolvedValue({ access_token: 'new-meta', expires_in: 3600 }),
    getRateLimitInfo: vi.fn().mockReturnValue({ call_count: 20 }),
  };
  clients.twitter = {
    postTweet: vi.fn().mockResolvedValue({ id: 'tw-post-1' }),
    uploadMedia: vi.fn().mockResolvedValue({ media_id_string: 'media-1' }),
    deleteTweet: vi.fn().mockResolvedValue(true),
    refreshAccessToken: vi.fn().mockResolvedValue({ access_token: 'new-tw', refresh_token: 'new-tw-refresh', expires_in: 7200 }),
    getRateLimit: vi.fn().mockReturnValue({ remaining: 100, limit: 300, reset: 1_700_000_000 }),
  };
  clients.linkedin = {
    createOrganizationPost: vi.fn().mockResolvedValue({ id: 'li-post-1' }),
    createOrganizationPostWithImage: vi.fn().mockResolvedValue({ id: 'li-img-1' }),
    createOrganizationPostWithLink: vi.fn().mockResolvedValue({ id: 'li-link-1' }),
    deletePost: vi.fn().mockResolvedValue(undefined),
    getOrganizationStatistics: vi.fn().mockResolvedValue([]),
    refreshAccessToken: vi.fn().mockResolvedValue({ access_token: 'new-li', refresh_token: 'new-li-refresh', expires_in: 5184000 }),
    getRateLimitInfo: vi.fn().mockReturnValue({ remaining: 400, reset: 1_700_000_000 }),
  };
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ===========================================================================
// Factory + construction
// ===========================================================================
describe('createSocialMediaService', () => {
  it('returns a SocialMediaService instance', () => {
    expect(createSocialMediaService()).toBeInstanceOf(SocialMediaService);
  });
});

// ===========================================================================
// refreshAccessToken (also exercises getClient's account lookup path)
// ===========================================================================
describe('refreshAccessToken', () => {
  it('throws when the account is not found', async () => {
    state.selects.socialAccounts = [];
    const svc = new SocialMediaService();
    await expect(svc.refreshAccessToken('acct-x', 'org-1')).rejects.toThrow(/Account not found/);
  });

  it('refreshes a Meta (facebook) long-lived token and updates the account', async () => {
    state.selects.socialAccounts = [account({ platform: 'facebook' })];
    const svc = new SocialMediaService();
    await svc.refreshAccessToken('acct-1', 'org-1');
    expect(clients.meta.getLongLivedToken).toHaveBeenCalled();
  });

  it('refreshes a Twitter token using the refresh token', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    const svc = new SocialMediaService();
    await svc.refreshAccessToken('acct-1', 'org-1');
    expect(clients.twitter.refreshAccessToken).toHaveBeenCalled();
  });

  it('throws when a Twitter account has no refresh token', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter', refreshToken: null })];
    const svc = new SocialMediaService();
    await expect(svc.refreshAccessToken('acct-1', 'org-1')).rejects.toThrow(/No refresh token/);
  });

  it('refreshes a LinkedIn token using the refresh token', async () => {
    state.selects.socialAccounts = [account({ platform: 'linkedin' })];
    const svc = new SocialMediaService();
    await svc.refreshAccessToken('acct-1', 'org-1');
    expect(clients.linkedin.refreshAccessToken).toHaveBeenCalled();
  });

  it('marks the account expired and rethrows when refresh fails', async () => {
    state.selects.socialAccounts = [account({ platform: 'facebook' })];
    clients.meta.getLongLivedToken.mockRejectedValueOnce(new Error('meta boom'));
    const svc = new SocialMediaService();
    await expect(svc.refreshAccessToken('acct-1', 'org-1')).rejects.toThrow(/meta boom/);
  });
});

// ===========================================================================
// publishPost
// ===========================================================================
describe('publishPost', () => {
  it('throws when no active accounts exist for the requested platforms', async () => {
    state.selects.socialAccounts = [];
    const svc = new SocialMediaService();
    await expect(
      svc.publishPost('org-1', { text: 'hi', platforms: ['twitter'] }, 'user-1'),
    ).rejects.toThrow(/No active accounts/);
  });

  it('publishes a Facebook post and saves it', async () => {
    state.selects.socialAccounts = [account({ platform: 'facebook' })];
    const svc = new SocialMediaService();
    const results = await svc.publishPost('org-1', { text: 'hello fb', platforms: ['facebook'] }, 'user-1');
    expect(results[0]).toMatchObject({ platform: 'facebook', success: true, post_id: 'fb-post-1' });
    expect(clients.meta.publishFacebookPost).toHaveBeenCalled();
  });

  it('publishes an Instagram post when media is present', async () => {
    state.selects.socialAccounts = [account({ platform: 'instagram' })];
    const svc = new SocialMediaService();
    const results = await svc.publishPost(
      'org-1',
      { text: 'hello ig', media_urls: ['https://img/1.jpg'], platforms: ['instagram'] },
      'user-1',
    );
    expect(results[0]).toMatchObject({ platform: 'instagram', success: true, post_id: 'ig-post-1' });
  });

  it('reports failure for an Instagram post with no media', async () => {
    state.selects.socialAccounts = [account({ platform: 'instagram' })];
    const svc = new SocialMediaService();
    const results = await svc.publishPost('org-1', { text: 'no media', platforms: ['instagram'] }, 'user-1');
    expect(results[0].success).toBe(false);
    expect(results[0].error).toMatch(/require at least one image/);
  });

  it.each([
    'https://img.example.com/picture.jpg',
    'http://127.0.0.1/admin',
    'http://169.254.169.254/latest/meta-data',
    'https://example.com/redirect-to-private',
    'file:///etc/passwd',
  ])('refuses server-side X media fetching for untrusted URL %s', async url => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const svc = new SocialMediaService();
    const results = await svc.publishPost(
      'org-1',
      { text: 'tweet', media_urls: [url], platforms: ['twitter'] },
      'user-1',
    );
    expect(results[0].success).toBe(false);
    expect(results[0].error).toMatch(/remote media URL ingestion is disabled/);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(clients.twitter.uploadMedia).not.toHaveBeenCalled();
    expect(clients.twitter.postTweet).not.toHaveBeenCalled();
  });

  it('keeps the text-only X publishing journey available', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    const svc = new SocialMediaService();
    const results = await svc.publishPost('org-1', { text: 'safe text', platforms: ['twitter'] }, 'user-1');
    expect(results[0]).toMatchObject({ platform: 'twitter', success: true, post_id: 'tw-post-1' });
    expect(clients.twitter.postTweet).toHaveBeenCalledWith({ text: 'safe text' });
  });

  it('publishes a LinkedIn link post', async () => {
    state.selects.socialAccounts = [account({ platform: 'linkedin' })];
    const svc = new SocialMediaService();
    const results = await svc.publishPost(
      'org-1',
      { text: 'li link', link_url: 'https://example.com', platforms: ['linkedin'] },
      'user-1',
    );
    expect(results[0]).toMatchObject({ platform: 'linkedin', success: true, post_id: 'li-link-1' });
    expect(clients.linkedin.createOrganizationPostWithLink).toHaveBeenCalled();
  });

  it('publishes a plain LinkedIn text post', async () => {
    state.selects.socialAccounts = [account({ platform: 'linkedin' })];
    const svc = new SocialMediaService();
    const results = await svc.publishPost('org-1', { text: 'li text', platforms: ['linkedin'] }, 'user-1');
    expect(results[0].post_id).toBe('li-post-1');
    expect(clients.linkedin.createOrganizationPost).toHaveBeenCalled();
  });

  it('saves a scheduled carousel post (detectPostType branches)', async () => {
    state.selects.socialAccounts = [account({ platform: 'facebook' })];
    const svc = new SocialMediaService();
    const results = await svc.publishPost(
      'org-1',
      {
        text: 'scheduled',
        media_urls: ['https://img/1.jpg', 'https://img/2.jpg'],
        platforms: ['facebook'],
        scheduled_for: new Date('2030-01-01'),
      },
      'user-1',
    );
    expect(results[0].success).toBe(true);
    expect(clients.meta.publishFacebookPost).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ scheduled_publish_time: Math.floor(new Date('2030-01-01').getTime() / 1000) }),
    );
  });

  // DEF-0B11-SOC-SCHEDULED-POST-IS-PUBLISHED-AT-ONCE-ON-INSTAGRAM-X-AND-LINKEDIN-WHILE-THE-ROW-SAYS-SCHEDULED
  it.each(['instagram', 'twitter', 'linkedin'] as const)('refuses a schedule on %s instead of publishing at once', async (platform) => {
    state.selects.socialAccounts = [account({ platform })];
    const results = await new SocialMediaService().publishPost(
      'org-1',
      { text: 'later', media_urls: platform === 'instagram' ? ['https://img/1.jpg'] : [], platforms: [platform], scheduled_for: new Date('2030-01-01') },
      'user-1',
    );
    expect(results[0]).toMatchObject({ success: false, error: expect.stringContaining('Scheduled publishing is not supported') });
    expect(clients.twitter.postTweet).not.toHaveBeenCalled();
    expect(clients.linkedin.createOrganizationPost).not.toHaveBeenCalled();
    expect(clients.meta.publishInstagramPost).not.toHaveBeenCalled();
  });

  it('sends the hashtags as part of the post text', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    await new SocialMediaService().publishPost('org-1', { text: 'hello', hashtags: ['union', 'strong'], platforms: ['twitter'] }, 'user-1');
    expect(clients.twitter.postTweet).toHaveBeenCalledWith({ text: 'hello\n\n#union #strong' });
  });

  it('refuses an X post that is over the limit once its hashtags are added', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    const results = await new SocialMediaService().publishPost('org-1', { text: 'x'.repeat(275), hashtags: ['union'], platforms: ['twitter'] }, 'user-1');
    expect(results[0].success).toBe(false);
    expect(clients.twitter.postTweet).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// deletePost
// ===========================================================================
describe('deletePost', () => {
  it('throws when the post is not found', async () => {
    state.selects.socialPosts = [];
    const svc = new SocialMediaService();
    await expect(svc.deletePost('post-x', 'org-1')).rejects.toThrow(/Post not found/);
  });

  it('deletes a Twitter post and marks it deleted', async () => {
    state.selects.socialPosts = [{
      id: 'post-1', accountId: 'acct-1', platformPostId: 'tw-post-1',
      platform: 'twitter', accessToken: 'token-1',
    }];
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    const svc = new SocialMediaService();
    await svc.deletePost('post-1', 'org-1');
    expect(clients.twitter.deleteTweet).toHaveBeenCalledWith('tw-post-1');
  });

  it('deletes a Facebook post', async () => {
    state.selects.socialPosts = [{
      id: 'post-2', accountId: 'acct-1', platformPostId: 'fb-post-1',
      platform: 'facebook', accessToken: 'token-1',
    }];
    state.selects.socialAccounts = [account({ platform: 'facebook' })];
    const svc = new SocialMediaService();
    await svc.deletePost('post-2', 'org-1');
    expect(clients.meta.deletePost).toHaveBeenCalled();
  });

  it('wraps platform delete failures', async () => {
    state.selects.socialPosts = [{
      id: 'post-3', accountId: 'acct-1', platformPostId: 'li-post-1',
      platform: 'linkedin', accessToken: 'token-1',
    }];
    state.selects.socialAccounts = [account({ platform: 'linkedin' })];
    clients.linkedin.deletePost.mockRejectedValueOnce(new Error('li delete fail'));
    const svc = new SocialMediaService();
    await expect(svc.deletePost('post-3', 'org-1')).rejects.toThrow(/Failed to delete post: li delete fail/);
  });
});

// ===========================================================================
// fetchAnalytics
// ===========================================================================
describe('fetchAnalytics', () => {
  it('throws when the account is not found', async () => {
    state.selects.socialAccounts = [];
    const svc = new SocialMediaService();
    await expect(svc.fetchAnalytics('org-1', 'acct-x', new Date(), new Date())).rejects.toThrow(/Account not found/);
  });

  // DEF-0B11-SOC-ANALYTICS-AND-ENGAGEMENT-FIGURES-HAVE-NO-WRITER-SO-EVERY-METRIC-IS-ZERO-OR-EMPTY: the platform responses are fetched but not
  // transformed, so an empty result used to be returned as a successful collection and nothing was written. It is a 501 now.
  it.each([
    ['linkedin', () => clients.linkedin.getOrganizationStatistics],
    ['facebook', () => clients.meta.getPageInsights],
    ['instagram', () => clients.meta.getInstagramInsights],
  ])('refuses with 501, not an empty success, when the %s response cannot be turned into analytics', async (platform, called) => {
    state.selects.socialAccounts = [account({ platform })];
    const svc = new SocialMediaService();
    await expect(svc.fetchAnalytics('org-1', 'acct-1', new Date('2025-01-01'), new Date('2025-01-31'))).rejects.toMatchObject({ code: 'NOT_IMPLEMENTED' });
    expect(called()).toHaveBeenCalled();
  });
});

// ===========================================================================
// getRateLimitStatus
// ===========================================================================
describe('getRateLimitStatus', () => {
  it('returns an empty list when there are no active accounts', async () => {
    state.selects.socialAccounts = [];
    const svc = new SocialMediaService();
    expect(await svc.getRateLimitStatus('org-1')).toEqual([]);
  });

  it('reports Twitter rate limit status', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    const svc = new SocialMediaService();
    const statuses = await svc.getRateLimitStatus('org-1');
    expect(statuses[0]).toMatchObject({ platform: 'twitter', remaining: 100, limit: 300 });
  });

  it('reports LinkedIn rate limit status', async () => {
    state.selects.socialAccounts = [account({ platform: 'linkedin' })];
    const svc = new SocialMediaService();
    const statuses = await svc.getRateLimitStatus('org-1');
    expect(statuses[0]).toMatchObject({ platform: 'linkedin', remaining: 400, limit: 500 });
  });

  it('reports Meta rate limit status', async () => {
    state.selects.socialAccounts = [account({ platform: 'facebook' })];
    const svc = new SocialMediaService();
    const statuses = await svc.getRateLimitStatus('org-1');
    expect(statuses[0]).toMatchObject({ platform: 'facebook', remaining: 80, limit: 100 });
  });

  it('swallows per-account errors and continues', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    clients.twitter.getRateLimit.mockImplementationOnce(() => { throw new Error('boom'); });
    const svc = new SocialMediaService();
    const statuses = await svc.getRateLimitStatus('org-1');
    expect(statuses).toEqual([]);
  });
});


// DEF-0B11-SOC-PUBLISH-RECORDS-THE-ROW-AFTER-THE-EXTERNAL-POST-AUDITS-COMPLETED-WHEN-EVERY-PLATFORM-FAILED-AND-RETURNS-PLATFORM-ERROR-TEXT
describe('publishPost reports what happened without echoing the platform or hiding a live post', () => {
  it('never returns the platform error text', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    clients.twitter.postTweet = vi.fn().mockRejectedValue(new Error('401 Unauthorized: bearer abc.def.ghi rejected for app 12345'));
    const results = await new SocialMediaService().publishPost('org-1', { text: 'hello', platforms: ['twitter'] }, 'user-1');
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBe('The platform did not accept the post.');
    expect(JSON.stringify(results)).not.toContain('bearer');
  });

  it('reports a post the platform accepted as published and unrecorded when the row cannot be saved', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    const original = dbMock.insert;
    (dbMock as any).insert = () => { throw new Error('db down'); };
    try {
      const results = await new SocialMediaService().publishPost('org-1', { text: 'hello', platforms: ['twitter'] }, 'user-1');
      expect(results[0]).toMatchObject({ success: true, post_id: 'tw-post-1', recorded: false });
    } finally {
      (dbMock as any).insert = original;
    }
  });

  it('marks a recorded post as recorded', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    const results = await new SocialMediaService().publishPost('org-1', { text: 'hello', platforms: ['twitter'] }, 'user-1');
    expect(results[0]).toMatchObject({ success: true, recorded: true });
  });
});

// An approved draft is published to its own account only and completed in place.
describe('publishPost options', () => {
  it('publishes only to the named accounts', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    const results = await new SocialMediaService().publishPost('org-1', { text: 'hello', platforms: ['twitter'] }, 'user-1', { accountIds: ['acct-1'] });
    expect(results[0]).toMatchObject({ success: true });
  });

  it('completes an existing draft instead of inserting a second row', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    state.updates.socialPosts = [{ id: 'draft-1' }];
    let inserted = false;
    const original = dbMock.insert;
    (dbMock as any).insert = (...args: unknown[]) => { inserted = true; return (original as any)(...args); };
    try {
      const results = await new SocialMediaService().publishPost('org-1', { text: 'hello', platforms: ['twitter'] }, 'user-1', { accountIds: ['acct-1'], existingPostId: 'draft-1' });
      expect(results[0]).toMatchObject({ success: true, recorded: true });
      expect(inserted).toBe(false);
    } finally {
      (dbMock as any).insert = original;
    }
  });
});
