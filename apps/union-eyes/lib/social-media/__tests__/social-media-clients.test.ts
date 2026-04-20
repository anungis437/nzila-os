import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockFetch = vi.fn();

beforeEach(() => {
  mockFetch.mockReset();
  vi.stubGlobal('fetch', mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

import { MetaAPIClient } from '../meta-api-client';
import { TwitterAPIClient } from '../twitter-api-client';
import { LinkedInAPIClient } from '../linkedin-api-client';

// ─── MetaAPIClient ───────────────────────────────────────────────────

describe('MetaAPIClient', () => {
  let client: MetaAPIClient;

  beforeEach(() => {
    client = new MetaAPIClient('app-id', 'app-secret', 'access-token');
  });

  describe('getAuthorizationUrl', () => {
    it('builds correct Facebook OAuth URL', () => {
      const url = client.getAuthorizationUrl(
        'https://example.com/callback',
        ['pages_manage_posts', 'pages_read_engagement'],
        'state123'
      );

      expect(url).toContain('https://www.facebook.com/v18.0/dialog/oauth');
      expect(url).toContain('client_id=app-id');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('state=state123');
      expect(url).toContain('response_type=code');
      expect(url).toContain('scope=pages_manage_posts%2Cpages_read_engagement');
    });

    it('handles single scope', () => {
      const url = client.getAuthorizationUrl(
        'https://example.com/cb',
        ['email'],
        'st'
      );
      expect(url).toContain('scope=email');
    });
  });

  describe('getAccessToken', () => {
    it('exchanges code for token', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          access_token: 'new-token',
          token_type: 'bearer',
          expires_in: 3600,
        }),
      });

      const result = await client.getAccessToken('code123', 'https://example.com/cb');
      expect(result.access_token).toBe('new-token');
    });

    it('throws on error response', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: { message: 'Invalid code' },
        }),
      });

      await expect(
        client.getAccessToken('bad', 'https://example.com/cb')
      ).rejects.toThrow('Meta OAuth error');
    });
  });

  describe('getLongLivedToken', () => {
    it('exchanges short-lived token', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          access_token: 'long-lived',
          token_type: 'bearer',
          expires_in: 5184000,
        }),
      });

      const result = await client.getLongLivedToken('short-token');
      expect(result.access_token).toBe('long-lived');
    });

    it('throws on error response', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          error: { message: 'Invalid token' },
        }),
      });

      await expect(client.getLongLivedToken('bad')).rejects.toThrow(
        'Meta token exchange error'
      );
    });
  });

  describe('getUserPages', () => {
    it('throws without access token', async () => {
      const noToken = new MetaAPIClient('app', 'secret');
      await expect(noToken.getUserPages()).rejects.toThrow('Access token required');
    });
  });
});

// ─── TwitterAPIClient ────────────────────────────────────────────────

describe('TwitterAPIClient', () => {
  let client: TwitterAPIClient;

  beforeEach(() => {
    client = new TwitterAPIClient('client-id', 'client-secret', 'access', 'refresh');
  });

  describe('getAuthorizationUrl', () => {
    it('builds correct Twitter OAuth2 URL with PKCE', () => {
      const url = client.getAuthorizationUrl(
        'https://example.com/callback',
        ['tweet.read', 'tweet.write'],
        'state456',
        'challenge789'
      );

      expect(url).toContain('https://twitter.com/i/oauth2/authorize');
      expect(url).toContain('client_id=client-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('code_challenge=challenge789');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('state=state456');
      expect(url).toContain('scope=tweet.read+tweet.write');
    });

    it('handles single scope', () => {
      const url = client.getAuthorizationUrl(
        'https://example.com/cb',
        ['offline.access'],
        'st',
        'ch'
      );
      expect(url).toContain('scope=offline.access');
    });
  });

  describe('getAccessToken', () => {
    it('exchanges code for token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'tw-token',
          refresh_token: 'tw-refresh',
          token_type: 'bearer',
          expires_in: 7200,
        }),
        headers: new Map(),
      });

      const result = await client.getAccessToken(
        'code123',
        'https://example.com/cb',
        'verifier'
      );
      expect(result.access_token).toBe('tw-token');
    });
  });

  describe('refreshAccessToken', () => {
    it('throws without refresh token', async () => {
      const noRefresh = new TwitterAPIClient('id', 'secret');
      await expect(noRefresh.refreshAccessToken()).rejects.toThrow(
        'Refresh token required'
      );
    });
  });
});

// ─── LinkedInAPIClient ───────────────────────────────────────────────

describe('LinkedInAPIClient', () => {
  let client: LinkedInAPIClient;

  beforeEach(() => {
    client = new LinkedInAPIClient('li-id', 'li-secret', 'access');
  });

  describe('getAuthorizationUrl', () => {
    it('builds correct LinkedIn OAuth URL', () => {
      const url = client.getAuthorizationUrl(
        'https://example.com/callback',
        ['r_liteprofile', 'w_member_social'],
        'state789'
      );

      expect(url).toContain('https://www.linkedin.com/oauth/v2/authorization');
      expect(url).toContain('client_id=li-id');
      expect(url).toContain('response_type=code');
      expect(url).toContain('state=state789');
      expect(url).toContain('scope=r_liteprofile+w_member_social');
    });
  });

  describe('getAccessToken', () => {
    it('exchanges code for token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'li-token',
          expires_in: 5184000,
        }),
        headers: new Map(),
      });

      const result = await client.getAccessToken('code123', 'https://example.com/cb');
      expect(result.access_token).toBe('li-token');
    });
  });
});
