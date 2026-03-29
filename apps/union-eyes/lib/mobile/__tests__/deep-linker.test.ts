import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import {
  DeepLinker,
  handleDeepLink,
  deepLinker,
  type DeepLinkConfig,
  type DeepLinkPath,
  type ParsedDeepLink,
} from '../deep-linker';

describe('DeepLinker', () => {
  let linker: DeepLinker;

  beforeEach(() => {
    linker = new DeepLinker();
  });

  describe('constructor', () => {
    it('uses default config when none provided', () => {
      const result = linker.parse('https://unioneyes.app/claim/123');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/claim/[id]');
    });

    it('merges partial config with defaults', () => {
      const custom = new DeepLinker({ host: 'my.app' });
      const result = custom.parse('https://my.app/claim/123');
      expect(result).not.toBeNull();
      expect(result!.params.id).toBe('123');
    });
  });

  describe('parse', () => {
    it('parses a single-param deep link', () => {
      const result = linker.parse('https://unioneyes.app/claim/42');
      expect(result).toEqual<ParsedDeepLink>({
        route: '/claim/[id]',
        params: { id: '42' },
        query: {},
        fragment: '',
      });
    });

    it('parses a multi-param deep link', () => {
      const result = linker.parse('https://unioneyes.app/union/committee/abc');
      expect(result).toEqual<ParsedDeepLink>({
        route: '/union/[type]/[id]',
        params: { type: 'committee', id: 'abc' },
        query: {},
        fragment: '',
      });
    });

    it('extracts query parameters', () => {
      const result = linker.parse('https://unioneyes.app/claim/1?tab=details&lang=en');
      expect(result).not.toBeNull();
      expect(result!.query).toEqual({ tab: 'details', lang: 'en' });
    });

    it('extracts fragment', () => {
      const result = linker.parse('https://unioneyes.app/claim/1#section');
      expect(result).not.toBeNull();
      expect(result!.fragment).toBe('section');
    });

    it('returns null for non-app URLs with different scheme', () => {
      const result = linker.parse('ftp://example.com/claim/1');
      expect(result).toBeNull();
    });

    it('returns null for unmatched paths', () => {
      const result = linker.parse('https://unioneyes.app/unknown/path/deep');
      expect(result).toBeNull();
    });

    it('returns null for invalid URLs', () => {
      const result = linker.parse('not a url at all');
      expect(result).toBeNull();
    });

    it('matches root path to /dashboard', () => {
      const result = linker.parse('https://unioneyes.app/');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/dashboard');
    });

    it('matches /home to /dashboard', () => {
      const result = linker.parse('https://unioneyes.app/home');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/dashboard');
    });

    it.each([
      ['member', '/member/[id]'],
      ['employer', '/employer/[id]'],
      ['document', '/document/[id]'],
      ['notification', '/notification/[id]'],
      ['vote', '/vote/[id]'],
      ['grievance', '/grievance/[id]'],
    ] as const)('parses /%s/:id links', (segment, expectedRoute) => {
      const result = linker.parse(`https://unioneyes.app/${segment}/99`);
      expect(result).not.toBeNull();
      expect(result!.route).toBe(expectedRoute);
      expect(result!.params.id).toBe('99');
    });

    it('parses nested message/thread links', () => {
      const result = linker.parse('https://unioneyes.app/message/thread/xyz');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/message/thread/[id]');
      expect(result!.params.id).toBe('xyz');
    });

    it('parses calendar/event links', () => {
      const result = linker.parse('https://unioneyes.app/calendar/event/ev1');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/calendar/event/[id]');
      expect(result!.params.id).toBe('ev1');
    });
  });

  describe('build', () => {
    it('builds a URL with bracket-style params', () => {
      const url = linker.build('/claim/[id]', { id: '55' });
      expect(url).toBe('https://unioneyes.app/claim/55');
    });

    it('builds a URL with colon-style params', () => {
      const url = linker.build('/claim/:id', { id: '55' });
      expect(url).toBe('https://unioneyes.app/claim/55');
    });

    it('builds a URL with query params', () => {
      const url = linker.build('/claim/[id]', { id: '1' }, { tab: 'info' });
      expect(url).toContain('tab=info');
    });

    it('builds a URL with no params', () => {
      const url = linker.build('/dashboard');
      expect(url).toBe('https://unioneyes.app/dashboard');
    });

    it('builds with custom scheme and host', () => {
      const custom = new DeepLinker({ scheme: 'myapp', host: 'deep' });
      const url = custom.build('/claim/[id]', { id: '1' });
      expect(url).toBe('myapp://deep/claim/1');
    });
  });

  describe('buildMobile', () => {
    it('appends .mobile to the host', () => {
      const url = linker.buildMobile('/claim/[id]', { id: '7' });
      expect(url).toContain('unioneyes.app.mobile');
      expect(url).toContain('/claim/7');
    });

    it('replaces bracket params in path', () => {
      const url = linker.buildMobile('/union/[type]/[id]', { type: 'local', id: '5' });
      expect(url).toContain('/union/local/5');
    });
  });

  describe('handleDeepLink', () => {
    it('returns true for a valid deep link', async () => {
      const result = await handleDeepLink('https://unioneyes.app/claim/1');
      expect(result).toBe(true);
    });

    it('returns false for an invalid deep link', async () => {
      const result = await handleDeepLink('https://other.com/path');
      expect(result).toBe(false);
    });
  });

  describe('deepLinker singleton', () => {
    it('is an instance of DeepLinker', () => {
      expect(deepLinker).toBeInstanceOf(DeepLinker);
    });

    it('can parse links using default config', () => {
      const result = deepLinker.parse('https://unioneyes.app/grievance/g1');
      expect(result).not.toBeNull();
      expect(result!.route).toBe('/grievance/[id]');
    });
  });

  describe('type exports', () => {
    it('DeepLinkConfig shape', () => {
      const config: DeepLinkConfig = { scheme: 'https', host: 'x', paths: [] };
      expect(config).toHaveProperty('scheme');
      expect(config).toHaveProperty('host');
      expect(config).toHaveProperty('paths');
    });

    it('DeepLinkPath shape', () => {
      const path: DeepLinkPath = { pattern: '/a/:id', route: '/a/[id]', params: ['id'] };
      expect(path.params).toContain('id');
    });

    it('ParsedDeepLink shape', () => {
      const parsed: ParsedDeepLink = { route: '/x', params: {}, query: {}, fragment: '' };
      expect(parsed).toHaveProperty('route');
    });
  });
});
