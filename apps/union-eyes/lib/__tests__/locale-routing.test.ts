import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: mocks.headers,
}));

import { getPreferredLocaleForRedirect, getPublicOriginForRedirect } from '../locale-routing';

function headerStore(map: Record<string, string>) {
  return {
    get: (name: string) => map[name.toLowerCase()] ?? null,
  };
}

describe('lib/locale-routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getPreferredLocaleForRedirect', () => {
    it('prefers the NEXT_LOCALE cookie', async () => {
      mocks.headers.mockResolvedValue(headerStore({ cookie: 'NEXT_LOCALE=fr-CA' }));
      expect(await getPreferredLocaleForRedirect()).toBe('fr-CA');
    });

    it('decodes a url-encoded cookie value', async () => {
      mocks.headers.mockResolvedValue(headerStore({ cookie: 'NEXT_LOCALE=fr%2DCA' }));
      expect(await getPreferredLocaleForRedirect()).toBe('fr-CA');
    });

    it('normalizes an it variant from the cookie', async () => {
      mocks.headers.mockResolvedValue(headerStore({ cookie: 'NEXT_LOCALE=it-IT' }));
      expect(await getPreferredLocaleForRedirect()).toBe('it');
    });

    it('falls back to Accept-Language when no cookie is set', async () => {
      mocks.headers.mockResolvedValue(
        headerStore({ 'accept-language': 'pt-BR,en;q=0.8' }),
      );
      expect(await getPreferredLocaleForRedirect()).toBe('pt');
    });

    it('falls back to the default locale when nothing matches', async () => {
      mocks.headers.mockResolvedValue(headerStore({ 'accept-language': 'de-DE' }));
      expect(await getPreferredLocaleForRedirect()).toBe('en-CA');
    });

    it('returns the default when no headers are present', async () => {
      mocks.headers.mockResolvedValue(headerStore({}));
      expect(await getPreferredLocaleForRedirect()).toBe('en-CA');
    });
  });

  describe('getPublicOriginForRedirect', () => {
    it('uses x-forwarded-host and x-forwarded-proto when present', async () => {
      mocks.headers.mockResolvedValue(
        headerStore({
          'x-forwarded-host': 'app.example.com, internal',
          'x-forwarded-proto': 'http, https',
        }),
      );
      expect(await getPublicOriginForRedirect()).toBe('http://app.example.com');
    });

    it('falls back to host with https and strips the port', async () => {
      mocks.headers.mockResolvedValue(headerStore({ host: 'localhost:3000' }));
      expect(await getPublicOriginForRedirect()).toBe('https://localhost');
    });

    it('returns null when no host is resolvable', async () => {
      mocks.headers.mockResolvedValue(headerStore({}));
      expect(await getPublicOriginForRedirect()).toBeNull();
    });
  });
});
