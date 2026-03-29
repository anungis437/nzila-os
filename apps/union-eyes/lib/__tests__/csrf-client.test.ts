/**
 * Tests for csrf-client.ts (client-side CSRF utils)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

// Stub global fetch
vi.stubGlobal('fetch', mocks.mockFetch);

describe('csrf-client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockFetch.mockResolvedValue(new Response('ok'));
    // Simulate browser environment
    Object.defineProperty(globalThis, 'document', {
      value: {
        cookie: '',
      },
      writable: true,
      configurable: true,
    });
  });

  describe('fetchWithCSRF', () => {
    it('includes CSRF token header on POST requests', async () => {
      // Set cookie with CSRF token
      (globalThis as any).document.cookie = '__Host-csrf-token=test-csrf-token-value';

      const { fetchWithCSRF } = await import('../csrf-client');
      await fetchWithCSRF('/api/test', { method: 'POST', body: '{}' });

      expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mocks.mockFetch.mock.calls[0];
      expect(url).toBe('/api/test');
      const headers = opts.headers as Headers;
      expect(headers.get('x-csrf-token')).toBe('test-csrf-token-value');
    });

    it('does not include CSRF token on GET requests', async () => {
      const { fetchWithCSRF } = await import('../csrf-client');
      await fetchWithCSRF('/api/test', { method: 'GET' });

      expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
      const [, opts] = mocks.mockFetch.mock.calls[0];
      // GET should not add CSRF headers
      expect(opts?.headers).toBeUndefined();
    });

    it('includes CSRF token on DELETE requests', async () => {
      (globalThis as any).document.cookie = '__Host-csrf-token=delete-token';

      const { fetchWithCSRF } = await import('../csrf-client');
      await fetchWithCSRF('/api/item/1', { method: 'DELETE' });

      const [, opts] = mocks.mockFetch.mock.calls[0];
      const headers = opts.headers as Headers;
      expect(headers.get('x-csrf-token')).toBe('delete-token');
    });

    it('handles missing CSRF cookie gracefully', async () => {
      (globalThis as any).document.cookie = '';

      const { fetchWithCSRF } = await import('../csrf-client');
      await fetchWithCSRF('/api/test', { method: 'PUT', body: '{}' });

      expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('setupAxiosCSRF', () => {
    it('installs request interceptor on axios instance', async () => {
      const { setupAxiosCSRF } = await import('../csrf-client');
      const mockAxios = {
        interceptors: {
          request: {
            use: vi.fn(),
          },
        },
      };
      setupAxiosCSRF(mockAxios);
      expect(mockAxios.interceptors.request.use).toHaveBeenCalledTimes(1);
    });
  });
});
