import { describe, it, expect } from 'vitest';
import { buildLocaleAlternates, localeMarketingPaths } from '../marketing-seo';

describe('lib/marketing-seo', () => {
  describe('buildLocaleAlternates', () => {
    it('builds canonical and language map for a nested path', () => {
      const result = buildLocaleAlternates('en-CA', '/pricing');
      expect(result.canonical).toBe('/en-CA/pricing');
      expect(result.languages['en-CA']).toBe('/en-CA/pricing');
      expect(result.languages['fr-CA']).toBe('/fr-CA/pricing');
      expect(result.languages['it']).toBe('/it/pricing');
      expect(result.languages['pt']).toBe('/pt/pricing');
      expect(result.languages['x-default']).toBe('/en-CA/pricing');
    });

    it('normalizes a path without a leading slash', () => {
      const result = buildLocaleAlternates('fr-CA', 'about');
      expect(result.canonical).toBe('/fr-CA/about');
      expect(result.languages['fr-CA']).toBe('/fr-CA/about');
    });

    it('treats the root path as empty', () => {
      const result = buildLocaleAlternates('en-CA', '/');
      expect(result.canonical).toBe('/en-CA');
      expect(result.languages['x-default']).toBe('/en-CA');
    });

    it('defaults the pathname to empty when omitted', () => {
      const result = buildLocaleAlternates('pt');
      expect(result.canonical).toBe('/pt');
    });
  });

  describe('localeMarketingPaths', () => {
    it('returns one path per supported locale', () => {
      expect(localeMarketingPaths('/insights')).toEqual([
        '/en-CA/insights',
        '/fr-CA/insights',
        '/it/insights',
        '/pt/insights',
      ]);
    });

    it('handles the root path', () => {
      expect(localeMarketingPaths('/')).toEqual(['/en-CA', '/fr-CA', '/it', '/pt']);
    });
  });
});
