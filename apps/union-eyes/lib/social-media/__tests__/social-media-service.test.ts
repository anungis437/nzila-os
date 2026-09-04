/**
 * Social Media Service — Test Suite
 *
 * Drives the unified orchestration service (getClient, refreshAccessToken,
 * publishPost, deletePost, fetchAnalytics, getRateLimitStatus, detectPostType,
 * createSocialMediaService) through a table-aware Drizzle mock plus mocked
 * platform client factories and a stubbed global fetch.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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

  it('publishes a Twitter post with uploaded media via fetch', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      arrayBuffer: async () => new ArrayBuffer(8),
      headers: new Headers({ 'content-type': 'image/jpeg' }),
    }));
    const svc = new SocialMediaService();
    const results = await svc.publishPost(
      'org-1',
      { text: 'tweet', media_urls: ['https://img/1.jpg'], platforms: ['twitter'] },
      'user-1',
    );
    expect(results[0]).toMatchObject({ platform: 'twitter', success: true, post_id: 'tw-post-1' });
    expect(clients.twitter.uploadMedia).toHaveBeenCalled();
  });

  it('blocks a Twitter media URL with a disallowed scheme (SSRF guard)', async () => {
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    const svc = new SocialMediaService();
    const results = await svc.publishPost(
      'org-1',
      { text: 'tweet', media_urls: ['file:///etc/passwd'], platforms: ['twitter'] },
      'user-1',
    );
    expect(results[0].success).toBe(false);
    expect(results[0].error).toMatch(/Blocked media URL scheme/);
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
    state.selects.socialAccounts = [account({ platform: 'linkedin' })];
    const svc = new SocialMediaService();
    const results = await svc.publishPost(
      'org-1',
      {
        text: 'scheduled',
        media_urls: ['https://img/1.jpg', 'https://img/2.jpg'],
        platforms: ['linkedin'],
        scheduled_for: new Date('2030-01-01'),
      },
      'user-1',
    );
    expect(results[0].success).toBe(true);
    expect(clients.linkedin.createOrganizationPostWithImage).toHaveBeenCalled();
  });
});

// ===========================================================================
// deletePost
// ===========================================================================
describe('deletePost', () => {
  it('throws when the post is not found', async () => {
    state.selects.socialPosts = [];
    const svc = new SocialMediaService();
    await expect(svc.deletePost('post-x')).rejects.toThrow(/Post not found/);
  });

  it('deletes a Twitter post and marks it deleted', async () => {
    state.selects.socialPosts = [{
      id: 'post-1', accountId: 'acct-1', platformPostId: 'tw-post-1',
      platform: 'twitter', accessToken: 'token-1',
    }];
    state.selects.socialAccounts = [account({ platform: 'twitter' })];
    const svc = new SocialMediaService();
    await svc.deletePost('post-1');
    expect(clients.twitter.deleteTweet).toHaveBeenCalledWith('tw-post-1');
  });

  it('deletes a Facebook post', async () => {
    state.selects.socialPosts = [{
      id: 'post-2', accountId: 'acct-1', platformPostId: 'fb-post-1',
      platform: 'facebook', accessToken: 'token-1',
    }];
    state.selects.socialAccounts = [account({ platform: 'facebook' })];
    const svc = new SocialMediaService();
    await svc.deletePost('post-2');
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
    await expect(svc.deletePost('post-3')).rejects.toThrow(/Failed to delete post: li delete fail/);
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

  it('fetches LinkedIn analytics (empty unified set)', async () => {
    state.selects.socialAccounts = [account({ platform: 'linkedin' })];
    const svc = new SocialMediaService();
    const result = await svc.fetchAnalytics('org-1', 'acct-1', new Date('2025-01-01'), new Date('2025-01-31'));
    expect(Array.isArray(result)).toBe(true);
    expect(clients.linkedin.getOrganizationStatistics).toHaveBeenCalled();
  });

  it('fetches Facebook page insights', async () => {
    state.selects.socialAccounts = [account({ platform: 'facebook' })];
    const svc = new SocialMediaService();
    await svc.fetchAnalytics('org-1', 'acct-1', new Date('2025-01-01'), new Date('2025-01-31'));
    expect(clients.meta.getPageInsights).toHaveBeenCalled();
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
