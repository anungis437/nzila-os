/**
 * Social Media API Clients — Comprehensive Unit Tests
 *
 * Exercises the Twitter, LinkedIn and Meta API client classes end-to-end with a
 * mocked global `fetch`. Covers OAuth flows, posting (text/media/album/carousel),
 * analytics, deletion, rate-limit tracking, error handling, and the module-level
 * helper/factory functions. Network is fully stubbed; no real requests are made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockFetch = vi.fn();

/** Build a Response-like object understood by the clients' handleResponse(). */
function ok(data: unknown = {}, headers: Record<string, string> = {}, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    headers: new Headers(headers),
    json: async () => data,
    arrayBuffer: async () => new ArrayBuffer(8),
  };
}
function fail(data: unknown, status = 400) {
  return {
    ok: false,
    status,
    statusText: 'Bad Request',
    headers: new Headers(),
    json: async () => data,
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

beforeEach(() => {
  mockFetch.mockReset();
  mockFetch.mockResolvedValue(ok({}));
  vi.stubGlobal('fetch', mockFetch);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

import {
  TwitterAPIClient,
  createTwitterClient,
  generatePKCE,
  calculateTweetEngagementRate,
} from '../twitter-api-client';
import {
  LinkedInAPIClient,
  createLinkedInClient,
  calculateLinkedInEngagementRate,
  extractIdFromUrn,
  formatAsUrn,
} from '../linkedin-api-client';
import {
  MetaAPIClient,
  createMetaClient,
  formatMetaInsights,
  calculateEngagementRate,
} from '../meta-api-client';

// ─────────────────────────────────────────────────────────────────────
// Twitter
// ─────────────────────────────────────────────────────────────────────
describe('TwitterAPIClient', () => {
  let client: TwitterAPIClient;
  beforeEach(() => {
    client = new TwitterAPIClient('cid', 'csecret', 'tok', 'refresh');
  });

  it('getAuthorizationUrl builds PKCE URL', () => {
    const url = client.getAuthorizationUrl('https://cb', ['tweet.read', 'tweet.write'], 'st', 'chal');
    expect(url).toContain('https://twitter.com/i/oauth2/authorize');
    expect(url).toContain('code_challenge=chal');
    expect(url).toContain('code_challenge_method=S256');
  });

  it('getAccessToken + refreshAccessToken update tokens', async () => {
    mockFetch.mockResolvedValueOnce(ok({ access_token: 'a1', refresh_token: 'r1' }));
    const t = await client.getAccessToken('code', 'https://cb', 'verifier');
    expect(t.access_token).toBe('a1');
    mockFetch.mockResolvedValueOnce(ok({ access_token: 'a2', refresh_token: 'r2' }));
    const r = await client.refreshAccessToken();
    expect(r.access_token).toBe('a2');
  });

  it('refreshAccessToken throws without refresh token', async () => {
    const c = new TwitterAPIClient('cid', 'csecret', 'tok');
    await expect(c.refreshAccessToken()).rejects.toThrow('Refresh token required');
  });

  it('revokeToken clears tokens; throws when no token available', async () => {
    await client.revokeToken('explicit-token');
    const c = new TwitterAPIClient('cid', 'csecret');
    await expect(c.revokeToken()).rejects.toThrow('Token required');
  });

  it('getMe returns user data; throws when missing', async () => {
    mockFetch.mockResolvedValueOnce(ok({ data: { id: 'u1', name: 'Me' } }));
    const me = await client.getMe();
    expect(me.id).toBe('u1');
    mockFetch.mockResolvedValueOnce(ok({}));
    await expect(client.getMe()).rejects.toThrow('Failed to fetch user data');
  });

  it('postTweet handles media/reply/quote/poll branches', async () => {
    mockFetch.mockResolvedValueOnce(ok({ data: { id: 't1', text: 'hi' } }));
    const tweet = await client.postTweet({
      text: 'hi',
      media_ids: ['m1'],
      reply_to: 'r1',
      quote_tweet_id: 'q1',
      poll: { options: ['a', 'b'], duration_minutes: 60 },
    });
    expect(tweet.id).toBe('t1');
    mockFetch.mockResolvedValueOnce(ok({}));
    await expect(client.postTweet({ text: 'x' })).rejects.toThrow('Failed to post tweet');
  });

  it('postThread posts sequential replies (fake timers for delays)', async () => {
    vi.useFakeTimers();
    mockFetch
      .mockResolvedValueOnce(ok({ data: { id: 't1', text: 'one' } }))
      .mockResolvedValueOnce(ok({ data: { id: 't2', text: 'two' } }));
    const promise = client.postThread(['one', 'two']);
    await vi.runAllTimersAsync();
    const thread = await promise;
    expect(thread.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('uploadMedia uploads and applies alt text', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ media_id_string: 'm1' })) // upload
      .mockResolvedValueOnce(ok({})); // addAltText
    const media = await client.uploadMedia(Buffer.from('data'), 'image/png', 'description');
    expect(media.media_id_string).toBe('m1');
  });

  it('uploadMediaChunked (video) runs INIT/APPEND/FINALIZE and waits for processing', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ media_id_string: 'm1' })) // INIT
      .mockResolvedValueOnce(ok({})) // APPEND
      .mockResolvedValueOnce(ok({ media_id_string: 'm1' })) // FINALIZE
      .mockResolvedValueOnce(ok({ processing_info: { state: 'succeeded' } })); // STATUS
    const media = await client.uploadMediaChunked(Buffer.from('small'), 'video/mp4');
    expect(media.media_id_string).toBe('m1');
  });

  it('addAltText, deleteTweet, like, retweet', async () => {
    await client.addAltText('m1', 'alt');
    mockFetch.mockResolvedValueOnce(ok({ data: { deleted: true } }));
    expect(await client.deleteTweet('t1')).toBe(true);
    mockFetch.mockResolvedValueOnce(ok({ data: { liked: true } }));
    expect(await client.likeTweet('u1', 't1')).toBe(true);
    mockFetch.mockResolvedValueOnce(ok({ data: { retweeted: true } }));
    expect(await client.retweet('u1', 't1')).toBe(true);
  });

  it('getTweet / getUserTweets / getTweetAnalytics', async () => {
    mockFetch.mockResolvedValueOnce(ok({ data: { id: 't1' } }));
    expect((await client.getTweet('t1', true)).id).toBe('t1');
    mockFetch.mockResolvedValueOnce(ok({ data: { id: 't2' } }));
    expect((await client.getTweet('t2', false)).id).toBe('t2');
    mockFetch.mockResolvedValueOnce(ok({}));
    await expect(client.getTweet('missing')).rejects.toThrow('Tweet not found');

    mockFetch.mockResolvedValueOnce(ok({ data: [{ id: 't1' }], meta: { next_token: 'n1' } }));
    const ut = await client.getUserTweets('u1', 5, 'page');
    expect(ut.tweets.length).toBe(1);
    expect(ut.nextToken).toBe('n1');

    mockFetch.mockResolvedValueOnce(ok({ data: { id: 't1' } }));
    expect((await client.getTweetAnalytics('t1')).id).toBe('t1');
    mockFetch.mockResolvedValueOnce(ok({}));
    await expect(client.getTweetAnalytics('x')).rejects.toThrow('Tweet not found');
  });

  it('rate limit tracking via response headers', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({ data: { id: 'u1' } }, {
        'x-rate-limit-limit': '100',
        'x-rate-limit-remaining': '5',
        'x-rate-limit-reset': String(Math.floor(Date.now() / 1000) + 60),
      }),
    );
    await client.getMe();
    const rl = client.getRateLimit('/users/me');
    expect(rl?.limit).toBe(100);
    expect(client.isApproachingRateLimit('/users/me')).toBe(true);
    expect(client.isApproachingRateLimit('/unknown')).toBe(false);
    expect(client.getTimeUntilReset('/users/me')).toBeGreaterThan(0);
    expect(client.getTimeUntilReset('/unknown')).toBe(0);
  });

  it('makeRequest throws without access token; handleResponse surfaces API + http errors', async () => {
    const noTok = new TwitterAPIClient('cid', 'csecret');
    await expect(noTok.getMe()).rejects.toThrow('Access token required');
    mockFetch.mockResolvedValueOnce(ok({ errors: [{ title: 'T', detail: 'D' }] }));
    await expect(client.getMe()).rejects.toThrow('Twitter API Error');
    mockFetch.mockResolvedValueOnce(fail({}, 500));
    await expect(client.getMe()).rejects.toThrow('Twitter API request failed');
  });

  it('module helpers: createTwitterClient, generatePKCE, calculateTweetEngagementRate', () => {
    expect(() => createTwitterClient()).toThrow('environment variables required');
    vi.stubEnv('TWITTER_CLIENT_ID', 'id');
    vi.stubEnv('TWITTER_CLIENT_SECRET', 'secret');
    expect(createTwitterClient('tok')).toBeInstanceOf(TwitterAPIClient);
    vi.unstubAllEnvs();

    const pkce = generatePKCE();
    expect(pkce.verifier.length).toBeGreaterThan(0);
    expect(pkce.challenge.length).toBeGreaterThan(0);

    expect(calculateTweetEngagementRate({} as never)).toBe(0);
    const rate = calculateTweetEngagementRate({
      public_metrics: { like_count: 5, retweet_count: 3, reply_count: 1, quote_count: 1 },
      non_public_metrics: { impression_count: 100 },
    } as never);
    expect(rate).toBeCloseTo(10);
    expect(
      calculateTweetEngagementRate({
        public_metrics: { like_count: 0, retweet_count: 0, reply_count: 0, quote_count: 0 },
        non_public_metrics: { impression_count: 0 },
      } as never),
    ).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// LinkedIn
// ─────────────────────────────────────────────────────────────────────
describe('LinkedInAPIClient', () => {
  let client: LinkedInAPIClient;
  beforeEach(() => {
    client = new LinkedInAPIClient('cid', 'csecret', 'tok');
  });

  it('getAuthorizationUrl + getAccessToken + refreshAccessToken', async () => {
    expect(client.getAuthorizationUrl('https://cb', ['r_liteprofile'], 'st')).toContain(
      'linkedin.com/oauth/v2/authorization',
    );
    mockFetch.mockResolvedValueOnce(ok({ access_token: 'a1' }));
    expect((await client.getAccessToken('code', 'https://cb')).access_token).toBe('a1');
    mockFetch.mockResolvedValueOnce(ok({ access_token: 'a2' }));
    expect((await client.refreshAccessToken('refresh')).access_token).toBe('a2');
  });

  it('getProfile / getOrganizations / getOrganization', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: 'p1' }));
    expect((await client.getProfile()).id).toBe('p1');
    mockFetch.mockResolvedValueOnce(
      ok({ elements: [{ 'organization~': { id: 'o1', localizedName: 'Org' } }, {}] }),
    );
    const orgs = await client.getOrganizations();
    expect(orgs.length).toBe(1);
    mockFetch.mockResolvedValueOnce(ok({ id: 'o1' }));
    expect((await client.getOrganization('o1')).id).toBe('o1');
  });

  it('createOrganizationPost (text) with default + explicit visibility', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: 'share1' }));
    expect((await client.createOrganizationPost('o1', { text: 'hi' })).id).toBe('share1');
    mockFetch.mockResolvedValueOnce(ok({ id: 'share2' }));
    expect(
      (await client.createOrganizationPost('o1', { text: 'hi', visibility: 'CONNECTIONS' })).id,
    ).toBe('share2');
  });

  it('createOrganizationPostWithImage registers upload, uploads, and posts', async () => {
    mockFetch
      .mockResolvedValueOnce(
        ok({
          value: {
            asset: 'urn:li:asset:1',
            uploadMechanism: {
              'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
                uploadUrl: 'https://upload.linkedin.com/x',
              },
            },
          },
        }),
      ) // registerImageUpload
      .mockResolvedValueOnce(ok({})) // fetch image (arrayBuffer)
      .mockResolvedValueOnce(ok({})) // upload PUT
      .mockResolvedValueOnce(ok({ id: 'shareImg' })); // create post
    const share = await client.createOrganizationPostWithImage('o1', {
      text: 'caption',
      imageUrl: 'https://cdn.example.com/img.jpg',
    });
    expect(share.id).toBe('shareImg');
  });

  it('createOrganizationPostWithImage rejects SSRF image URLs', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({
        value: {
          asset: 'urn:li:asset:1',
          uploadMechanism: {
            'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest': {
              uploadUrl: 'https://upload.linkedin.com/x',
            },
          },
        },
      }),
    );
    await expect(
      client.createOrganizationPostWithImage('o1', { text: 't', imageUrl: 'http://127.0.0.1/x.jpg' }),
    ).rejects.toThrow('Blocked');
  });

  it('createOrganizationPostWithLink with and without optional fields', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: 'l1' }));
    expect(
      (await client.createOrganizationPostWithLink('o1', { text: 't', linkUrl: 'https://x.com' })).id,
    ).toBe('l1');
    mockFetch.mockResolvedValueOnce(ok({ id: 'l2' }));
    expect(
      (
        await client.createOrganizationPostWithLink('o1', {
          text: 't',
          linkUrl: 'https://x.com',
          linkTitle: 'T',
          linkDescription: 'D',
          visibility: 'CONNECTIONS',
        })
      ).id,
    ).toBe('l2');
  });

  it('deletePost / statistics / shares', async () => {
    mockFetch.mockResolvedValueOnce(ok({}, {}, 204));
    await expect(client.deletePost('s1')).resolves.toBeUndefined();
    mockFetch.mockResolvedValueOnce(ok({ totalShareStatistics: {} }));
    await client.getPostStatistics('s1');
    mockFetch.mockResolvedValueOnce(ok({ elements: [] }));
    await client.getOrganizationStatistics('o1', new Date(0), new Date());
    mockFetch.mockResolvedValueOnce(ok({ elements: [] }));
    await client.getFollowerStatistics('o1', new Date(0), new Date());
    mockFetch.mockResolvedValueOnce(ok({ elements: [], paging: {} }));
    const shares = await client.getOrganizationShares('o1', 10, 0);
    expect(shares.elements).toEqual([]);
  });

  it('rate limit info + error handling', async () => {
    mockFetch.mockResolvedValueOnce(
      ok({ id: 'p1' }, { 'X-RateLimit-Remaining': '10', 'X-RateLimit-Reset': '12345' }),
    );
    await client.getProfile();
    expect(client.getRateLimitInfo().remaining).toBe(10);
    expect(client.isApproachingRateLimit()).toBe(true);
    expect(new LinkedInAPIClient('a', 'b', 't').isApproachingRateLimit()).toBe(false);

    const noTok = new LinkedInAPIClient('a', 'b');
    await expect(noTok.getProfile()).rejects.toThrow('Access token required');
    mockFetch.mockResolvedValueOnce(fail({ message: 'boom', serviceErrorCode: 42 }, 400));
    await expect(client.getProfile()).rejects.toThrow('LinkedIn API Error');
  });

  it('module helpers: createLinkedInClient, engagement, urn helpers', () => {
    expect(() => createLinkedInClient()).toThrow('environment variables required');
    vi.stubEnv('LINKEDIN_CLIENT_ID', 'id');
    vi.stubEnv('LINKEDIN_CLIENT_SECRET', 'secret');
    expect(createLinkedInClient('tok')).toBeInstanceOf(LinkedInAPIClient);
    vi.unstubAllEnvs();

    expect(
      calculateLinkedInEngagementRate({
        totalShareStatistics: {
          likeCount: 2,
          commentCount: 1,
          shareCount: 1,
          clickCount: 1,
          uniqueImpressionsCount: 100,
        },
      } as never),
    ).toBeCloseTo(5);
    expect(
      calculateLinkedInEngagementRate({
        totalShareStatistics: {
          likeCount: 0,
          commentCount: 0,
          shareCount: 0,
          clickCount: 0,
          uniqueImpressionsCount: 0,
        },
      } as never),
    ).toBe(0);
    expect(extractIdFromUrn('urn:li:organization:123')).toBe('123');
    expect(formatAsUrn('organization', '123')).toBe('urn:li:organization:123');
  });
});

// ─────────────────────────────────────────────────────────────────────
// Meta
// ─────────────────────────────────────────────────────────────────────
describe('MetaAPIClient', () => {
  let client: MetaAPIClient;
  beforeEach(() => {
    client = new MetaAPIClient('app', 'secret', 'tok');
  });

  it('getAuthorizationUrl + getAccessToken + getLongLivedToken (+ error branches)', async () => {
    expect(client.getAuthorizationUrl('https://cb', ['pages_show_list'], 'st')).toContain(
      'facebook.com/v18.0/dialog/oauth',
    );
    mockFetch.mockResolvedValueOnce(ok({ access_token: 'a1' }));
    expect((await client.getAccessToken('code', 'https://cb')).access_token).toBe('a1');
    mockFetch.mockResolvedValueOnce(ok({ error: { message: 'bad' } }));
    await expect(client.getAccessToken('code', 'https://cb')).rejects.toThrow('Meta OAuth error');
    mockFetch.mockResolvedValueOnce(ok({ access_token: 'long' }));
    expect((await client.getLongLivedToken('short')).access_token).toBe('long');
    mockFetch.mockResolvedValueOnce(ok({ error: { message: 'bad' } }));
    await expect(client.getLongLivedToken('short')).rejects.toThrow('token exchange error');
  });

  it('getUserPages / getInstagramAccount (+ token guards)', async () => {
    mockFetch.mockResolvedValueOnce(ok({ data: [{ id: 'pg1', name: 'Page' }] }));
    expect((await client.getUserPages()).length).toBe(1);
    mockFetch.mockResolvedValueOnce(ok({ instagram_business_account: { id: 'ig1' } }));
    expect((await client.getInstagramAccount('pg1'))?.id).toBe('ig1');
    mockFetch.mockResolvedValueOnce(ok({}));
    expect(await client.getInstagramAccount('pg1')).toBeNull();

    const noTok = new MetaAPIClient('app', 'secret');
    await expect(noTok.getUserPages()).rejects.toThrow('Access token required');
    await expect(noTok.getInstagramAccount('pg1')).rejects.toThrow('Access token required');
  });

  it('publishFacebookPost: text, link, single photo, single video, album, scheduled', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: 'post1' }));
    expect((await client.publishFacebookPost('pg', 'ptok', { message: 'hi' })).id).toBe('post1');

    mockFetch.mockResolvedValueOnce(ok({ id: 'post2' }));
    await client.publishFacebookPost('pg', 'ptok', { message: 'hi', link: 'https://x.com' });

    mockFetch.mockResolvedValueOnce(ok({ id: 'photo1' }));
    await client.publishFacebookPost('pg', 'ptok', { message: 'hi', media_urls: ['https://x.com/a.jpg'] });

    mockFetch.mockResolvedValueOnce(ok({ id: 'video1' }));
    await client.publishFacebookPost('pg', 'ptok', { message: 'hi', media_urls: ['https://x.com/a.mp4'] });

    // album: 2 photo uploads + 1 feed post
    mockFetch
      .mockResolvedValueOnce(ok({ id: 'p1' }))
      .mockResolvedValueOnce(ok({ id: 'p2' }))
      .mockResolvedValueOnce(ok({ id: 'album1' }));
    const album = await client.publishFacebookPost('pg', 'ptok', {
      message: 'hi',
      media_urls: ['https://x.com/a.jpg', 'https://x.com/b.jpg'],
    });
    expect(album.id).toBe('album1');

    mockFetch.mockResolvedValueOnce(ok({ id: 'sched1' }));
    await client.publishFacebookPost('pg', 'ptok', { message: 'later', scheduled_publish_time: 12345 });
  });

  it('publishInstagramPost: image, video, carousel, and missing-media error', async () => {
    mockFetch
      .mockResolvedValueOnce(ok({ id: 'c1' }))
      .mockResolvedValueOnce(ok({ id: 'media1', permalink: 'http://x' }));
    const img = await client.publishInstagramPost('ig', { image_url: 'https://x/a.jpg', caption: 'c' });
    expect(img.id).toBe('media1');

    mockFetch
      .mockResolvedValueOnce(ok({ id: 'c2' }))
      .mockResolvedValueOnce(ok({ id: 'media2' }));
    await client.publishInstagramPost('ig', { video_url: 'https://x/a.mp4', caption: 'c', cover_url: 'https://x/t.jpg' });

    mockFetch
      .mockResolvedValueOnce(ok({ id: 'c3' }))
      .mockResolvedValueOnce(ok({ id: 'media3' }));
    await client.publishInstagramPost('ig', { is_carousel: true, children: ['a', 'b'], caption: 'c' });

    await expect(client.publishInstagramPost('ig', {})).rejects.toThrow('required');
    const noTok = new MetaAPIClient('app', 'secret');
    await expect(noTok.publishInstagramPost('ig', { image_url: 'x' })).rejects.toThrow('Access token required');
  });

  it('createInstagramCarouselItem image + video + token guard', async () => {
    mockFetch.mockResolvedValueOnce(ok({ id: 'item1' }));
    expect(await client.createInstagramCarouselItem('ig', 'https://x/a.jpg')).toBe('item1');
    mockFetch.mockResolvedValueOnce(ok({ id: 'item2' }));
    expect(await client.createInstagramCarouselItem('ig', 'https://x/a.mp4', true)).toBe('item2');
    const noTok = new MetaAPIClient('app', 'secret');
    await expect(noTok.createInstagramCarouselItem('ig', 'x')).rejects.toThrow('Access token required');
  });

  it('insights endpoints + deletePost + validateToken', async () => {
    mockFetch.mockResolvedValueOnce(ok({ data: [{ name: 'page_impressions', values: [{ value: 10 }] }] }));
    expect((await client.getPageInsights('pg', 'ptok', undefined, 'day', new Date(0), new Date())).length).toBe(1);
    mockFetch.mockResolvedValueOnce(ok({ data: [] }));
    await client.getPostInsights('post1', 'tok');
    mockFetch.mockResolvedValueOnce(ok({ data: [] }));
    await client.getInstagramInsights('ig', undefined, 'lifetime');
    mockFetch.mockResolvedValueOnce(ok({ data: [] }));
    await client.getInstagramInsights('ig', undefined, 'day', new Date(0), new Date());
    mockFetch.mockResolvedValueOnce(ok({ data: [] }));
    await client.getInstagramMediaInsights('media1');

    mockFetch.mockResolvedValueOnce(ok({ success: true }));
    expect((await client.deletePost('post1', 'tok')).success).toBe(true);

    mockFetch.mockResolvedValueOnce(ok({ data: { is_valid: true, user_id: 'u1' } }));
    expect((await client.validateToken('tok')).is_valid).toBe(true);

    const noTok = new MetaAPIClient('app', 'secret');
    await expect(noTok.getInstagramInsights('ig')).rejects.toThrow('Access token required');
    await expect(noTok.getInstagramMediaInsights('m')).rejects.toThrow('Access token required');
  });

  it('rate limit extraction + isApproachingRateLimit + error handling', async () => {
    const usage = JSON.stringify({ app: { call_count: 80, total_time: 10, total_cputime: 10 } });
    mockFetch.mockResolvedValueOnce(ok({ data: [] }, { 'x-business-use-case-usage': usage }));
    await client.getUserPages();
    expect(client.getRateLimitInfo()?.call_count).toBe(80);
    expect(client.isApproachingRateLimit()).toBe(true);
    expect(new MetaAPIClient('a', 'b', 't').isApproachingRateLimit()).toBe(false);

    // malformed usage header → undefined (no throw)
    mockFetch.mockResolvedValueOnce(ok({ data: [] }, { 'x-business-use-case-usage': 'not-json' }));
    await client.getUserPages();

    mockFetch.mockResolvedValueOnce(ok({ error: { code: 1, message: 'm', fbtrace_id: 'fb' } }));
    await expect(client.getUserPages()).rejects.toThrow('Meta API Error');
    mockFetch.mockResolvedValueOnce(fail({}, 500));
    await expect(client.getUserPages()).rejects.toThrow('Meta API request failed');
  });

  it('module helpers: createMetaClient, formatMetaInsights, calculateEngagementRate', () => {
    expect(() => createMetaClient()).toThrow('environment variables required');
    vi.stubEnv('META_APP_ID', 'id');
    vi.stubEnv('META_APP_SECRET', 'secret');
    expect(createMetaClient('tok')).toBeInstanceOf(MetaAPIClient);
    vi.unstubAllEnvs();

    const formatted = formatMetaInsights([
      { name: 'impressions', values: [{ value: 5 }, { value: 9 }] },
      { name: 'reach', values: [] },
    ]);
    expect(formatted.impressions).toBe(9);
    expect(formatted.reach).toBeUndefined();
    expect(calculateEngagementRate(10, 100)).toBeCloseTo(10);
    expect(calculateEngagementRate(10, 0)).toBe(0);
  });
});
