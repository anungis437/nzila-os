import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { SocialMediaService, socialMediaService, shareTemplates } from '../social-media';

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const notOk = (status = 500) => ({ ok: false, status, json: async () => ({}) });

let fetchMock: ReturnType<typeof vi.fn>;

describe('social-media', () => {
  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('configurePlatform / isEnabled', () => {
    it('configures and reports enabled state', () => {
      const s = new SocialMediaService();
      expect(s.isEnabled('facebook')).toBe(false);
      s.configurePlatform('facebook', { enabled: true, apiKey: 'k' });
      expect(s.isEnabled('facebook')).toBe(true);
    });
  });

  describe('share', () => {
    it('publishes to enabled platforms and skips disabled ones', async () => {
      const s = new SocialMediaService();
      s.configurePlatform('facebook', { enabled: true, apiKey: 'fb' });
      fetchMock.mockResolvedValueOnce(ok({ id: 'fb-1' }));
      const res = await s.share({ platform: 'all', title: 'T', description: 'D', url: 'https://x', mediaUrl: 'https://img' });
      expect(res.success).toBe(true);
      expect(res.postIds.facebook).toBe('fb-1');
    });

    it('returns success=false when publishing fails for every platform', async () => {
      const s = new SocialMediaService();
      s.configurePlatform('twitter', { enabled: true, apiKey: 'tw' });
      fetchMock.mockResolvedValueOnce(notOk(400));
      const res = await s.share({ platform: 'twitter', title: 'T', description: 'D', url: 'https://x' });
      expect(res.success).toBe(false);
      expect(res.postIds).toEqual({});
    });
  });

  describe('schedulePost', () => {
    it('returns a post id when the platform is enabled', async () => {
      const s = new SocialMediaService();
      s.configurePlatform('linkedin', { enabled: true });
      const id = await s.schedulePost({ platform: 'linkedin', content: 'hi', status: 'scheduled' });
      expect(id).toMatch(/^post-/);
    });

    it('throws when the platform is not enabled', async () => {
      const s = new SocialMediaService();
      await expect(s.schedulePost({ platform: 'facebook', content: 'x', status: 'draft' }))
        .rejects.toThrow(/not enabled/);
    });
  });

  describe('getAnalytics', () => {
    it('returns null when the platform is disabled', async () => {
      const s = new SocialMediaService();
      expect(await s.getAnalytics('facebook', 'p1')).toBeNull();
    });

    it('returns null when no API key is configured', async () => {
      const s = new SocialMediaService();
      s.configurePlatform('facebook', { enabled: true });
      expect(await s.getAnalytics('facebook', 'p1')).toBeNull();
    });

    it('fetches Facebook analytics including found and missing metrics', async () => {
      const s = new SocialMediaService();
      s.configurePlatform('facebook', { enabled: true, apiKey: 'fb' });
      fetchMock.mockResolvedValueOnce(ok({
        data: [{ name: 'post_impressions', values: [{ value: 10 }] }],
      }));
      const a = await s.getAnalytics('facebook', 'p1');
      expect(a?.impressions).toBe(10);
      expect(a?.engagements).toBe(0); // missing metric defaults to 0
    });

    it('fetches Twitter analytics from public_metrics', async () => {
      const s = new SocialMediaService();
      s.configurePlatform('twitter', { enabled: true, apiKey: 'tw' });
      fetchMock.mockResolvedValueOnce(ok({
        data: { public_metrics: { impression_count: 5, reply_count: 1, retweet_count: 2, like_count: 3 } },
      }));
      const a = await s.getAnalytics('twitter', 'p1');
      expect(a?.impressions).toBe(5);
      expect(a?.engagements).toBe(6);
      expect(a?.shares).toBe(2);
    });

    it('returns zeroed LinkedIn analytics', async () => {
      const s = new SocialMediaService();
      s.configurePlatform('linkedin', { enabled: true, apiKey: 'li' });
      const a = await s.getAnalytics('linkedin', 'p1');
      expect(a).toEqual({ impressions: 0, engagements: 0, clicks: 0, shares: 0, likes: 0 });
    });

    it('returns null for platforms without analytics support', async () => {
      const s = new SocialMediaService();
      s.configurePlatform('instagram', { enabled: true, apiKey: 'ig' });
      expect(await s.getAnalytics('instagram', 'p1')).toBeNull();
    });

    it('returns null when the analytics request throws', async () => {
      const s = new SocialMediaService();
      s.configurePlatform('facebook', { enabled: true, apiKey: 'fb' });
      fetchMock.mockResolvedValueOnce(notOk(500));
      expect(await s.getAnalytics('facebook', 'p1')).toBeNull();
    });
  });

  describe('getShareUrl', () => {
    const s = new SocialMediaService();
    const opts = { platform: 'all' as const, title: 'Hello World', description: 'D', url: 'https://x.test/a' };
    it('builds facebook url', () => { expect(s.getShareUrl('facebook', opts)).toContain('facebook.com/sharer'); });
    it('builds twitter url', () => { expect(s.getShareUrl('twitter', opts)).toContain('twitter.com/intent'); });
    it('builds linkedin url', () => { expect(s.getShareUrl('linkedin', opts)).toContain('linkedin.com/shareArticle'); });
    it('returns empty for instagram', () => { expect(s.getShareUrl('instagram', opts)).toBe(''); });
    it('builds youtube url', () => { expect(s.getShareUrl('youtube', opts)).toContain('youtube.com/share'); });
    it('returns empty for unknown platform', () => {
      expect(s.getShareUrl('tiktok' as unknown as 'facebook', opts)).toBe('');
    });
  });

  describe('getShareSheetOptions', () => {
    it('returns urls for enabled platforms with non-empty share urls', () => {
      const s = new SocialMediaService();
      s.configurePlatform('facebook', { enabled: true });
      s.configurePlatform('instagram', { enabled: true }); // share url is empty -> filtered out
      const sheet = s.getShareSheetOptions({ platform: 'all', title: 'T', description: 'D', url: 'https://x' });
      expect(sheet.map(e => e.platform)).toEqual(['facebook']);
    });
  });

  describe('publishPost (via share)', () => {
    it('publishes to twitter', async () => {
      const s = new SocialMediaService();
      s.configurePlatform('twitter', { enabled: true, apiKey: 'tw' });
      fetchMock.mockResolvedValueOnce(ok({ data: { id: 'tw-1' } }));
      const res = await s.share({ platform: 'twitter', title: 'T', description: 'D', url: 'https://x' });
      expect(res.postIds.twitter).toBe('tw-1');
    });

    it('publishes to linkedin', async () => {
      const s = new SocialMediaService();
      s.configurePlatform('linkedin', { enabled: true, apiKey: 'li' });
      fetchMock.mockResolvedValueOnce(ok({ id: 'li-1' }));
      const res = await s.share({ platform: 'linkedin', title: 'T', description: 'D', url: 'https://x' });
      expect(res.postIds.linkedin).toBe('li-1');
    });

    it('throws for a platform without publish support', async () => {
      const s = new SocialMediaService();
      s.configurePlatform('youtube', { enabled: true, apiKey: 'yt' });
      const res = await s.share({ platform: 'youtube', title: 'T', description: 'D', url: 'https://x' });
      expect(res.success).toBe(false); // publishPost throws -> caught -> no result
    });

    it('throws when the platform has no API key', async () => {
      const s = new SocialMediaService();
      s.configurePlatform('facebook', { enabled: true });
      const res = await s.share({ platform: 'facebook', title: 'T', description: 'D', url: 'https://x' });
      expect(res.success).toBe(false);
    });
  });

  describe('singleton and templates', () => {
    it('exports a singleton', () => {
      expect(socialMediaService).toBeInstanceOf(SocialMediaService);
    });

    it('builds all share templates', () => {
      expect(shareTemplates.strikeNotice('ACME', '2024-01-01', 'Hall').title).toBe('Strike Notice');
      expect(shareTemplates.contractWin('ACME', 'raises').platform).toBe('all');
      expect(shareTemplates.memberDrive('Local 1').url).toContain('/join');
      expect(shareTemplates.event('Rally', '2024-02-02', 'Park').title).toBe('Rally');
    });
  });
});
