/**
 * Tests for csrf-client.ts (client-side CSRF utils)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

describe('csrf-client', () => {
  const browserGlobal = globalThis as any as { document: { cookie: string } };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    mocks.mockFetch.mockResolvedValue(new Response('ok'));
    vi.stubGlobal('fetch', mocks.mockFetch);
    // Simulate browser environment
    Object.defineProperty(globalThis, 'document', {
      value: {
        cookie: '',
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, 'document');
  });

  // ── fetchWithCSRF ─────────────────────────────────────────────────────
  describe('fetchWithCSRF', () => {
    it('includes CSRF token header on POST requests', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=test-csrf-token-value';

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
      expect(opts?.headers).toBeUndefined();
    });

    it('includes CSRF token on DELETE requests', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=delete-token';

      const { fetchWithCSRF } = await import('../csrf-client');
      await fetchWithCSRF('/api/item/1', { method: 'DELETE' });

      const [, opts] = mocks.mockFetch.mock.calls[0];
      const headers = opts.headers as Headers;
      expect(headers.get('x-csrf-token')).toBe('delete-token');
    });

    it('handles missing CSRF cookie gracefully', async () => {
      browserGlobal.document.cookie = '';

      const { fetchWithCSRF } = await import('../csrf-client');
      await fetchWithCSRF('/api/test', { method: 'PUT', body: '{}' });

      expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not add token on HEAD requests', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=head-token';

      const { fetchWithCSRF } = await import('../csrf-client');
      await fetchWithCSRF('/api/test', { method: 'HEAD' });

      const [, opts] = mocks.mockFetch.mock.calls[0];
      expect(opts?.headers).toBeUndefined();
    });

    it('does not add token on OPTIONS requests', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=opt-token';

      const { fetchWithCSRF } = await import('../csrf-client');
      await fetchWithCSRF('/api/test', { method: 'OPTIONS' });

      const [, opts] = mocks.mockFetch.mock.calls[0];
      expect(opts?.headers).toBeUndefined();
    });

    it('includes CSRF token on PATCH requests', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=patch-token';

      const { fetchWithCSRF } = await import('../csrf-client');
      await fetchWithCSRF('/api/resource', { method: 'PATCH', body: '{}' });

      const [, opts] = mocks.mockFetch.mock.calls[0];
      const headers = opts.headers as Headers;
      expect(headers.get('x-csrf-token')).toBe('patch-token');
    });

    it('defaults to GET when no method specified', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=some-token';

      const { fetchWithCSRF } = await import('../csrf-client');
      await fetchWithCSRF('/api/data');

      const [, opts] = mocks.mockFetch.mock.calls[0];
      // No method = GET, should not add CSRF header
      expect(opts?.headers).toBeUndefined();
    });

    it('preserves existing headers on POST', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=merge-token';

      const { fetchWithCSRF } = await import('../csrf-client');
      await fetchWithCSRF('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });

      const [, opts] = mocks.mockFetch.mock.calls[0];
      const headers = opts.headers as Headers;
      expect(headers.get('content-type')).toBe('application/json');
      expect(headers.get('x-csrf-token')).toBe('merge-token');
    });

    it('decodes URL-encoded cookie value', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=token%20with%20spaces';

      const { fetchWithCSRF } = await import('../csrf-client');
      await fetchWithCSRF('/api/test', { method: 'POST', body: '{}' });

      const [, opts] = mocks.mockFetch.mock.calls[0];
      const headers = opts.headers as Headers;
      expect(headers.get('x-csrf-token')).toBe('token with spaces');
    });
  });

  // ── setupAxiosCSRF ────────────────────────────────────────────────────
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

    it('interceptor adds token for POST config', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=axios-token';

      const { setupAxiosCSRF } = await import('../csrf-client');
      const mockAxios = {
        interceptors: { request: { use: vi.fn() } },
      };
      setupAxiosCSRF(mockAxios);

      const [onFulfilled] = mockAxios.interceptors.request.use.mock.calls[0];
      const config = { method: 'POST', headers: {} as Record<string, string> };
      const result = onFulfilled(config);
      expect(result.headers['x-csrf-token']).toBe('axios-token');
    });

    it('interceptor skips token for GET config', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=axios-token';

      const { setupAxiosCSRF } = await import('../csrf-client');
      const mockAxios = {
        interceptors: { request: { use: vi.fn() } },
      };
      setupAxiosCSRF(mockAxios);

      const [onFulfilled] = mockAxios.interceptors.request.use.mock.calls[0];
      const config = { method: 'GET', headers: {} as Record<string, string> };
      const result = onFulfilled(config);
      expect(result.headers['x-csrf-token']).toBeUndefined();
    });

    it('interceptor error handler rejects', async () => {
      const { setupAxiosCSRF } = await import('../csrf-client');
      const mockAxios = {
        interceptors: { request: { use: vi.fn() } },
      };
      setupAxiosCSRF(mockAxios);

      const [, onRejected] = mockAxios.interceptors.request.use.mock.calls[0];
      await expect(onRejected(new Error('req error'))).rejects.toThrow('req error');
    });
  });

  // ── getToken / hasCSRFToken ───────────────────────────────────────────
  describe('getToken', () => {
    it('returns token when cookie exists', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=my-token';
      const { getToken } = await import('../csrf-client');
      expect(getToken()).toBe('my-token');
    });

    it('returns null when cookie is absent', async () => {
      browserGlobal.document.cookie = 'other-cookie=value';
      const { getToken } = await import('../csrf-client');
      expect(getToken()).toBeNull();
    });

    it('returns null in SSR (no document)', async () => {
      Object.defineProperty(globalThis, 'document', {
        value: undefined,
        writable: true,
        configurable: true,
      });
      const { getToken } = await import('../csrf-client');
      expect(getToken()).toBeNull();
    });
  });

  describe('hasCSRFToken', () => {
    it('returns true when token exists', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=exists';
      const { hasCSRFToken } = await import('../csrf-client');
      expect(hasCSRFToken()).toBe(true);
    });

    it('returns false when token absent', async () => {
      browserGlobal.document.cookie = '';
      const { hasCSRFToken } = await import('../csrf-client');
      expect(hasCSRFToken()).toBe(false);
    });
  });

  // ── useCSRFFetch ──────────────────────────────────────────────────────
  describe('useCSRFFetch', () => {
    it('returns fetchWithCSRF function', async () => {
      const { useCSRFFetch, fetchWithCSRF } = await import('../csrf-client');
      expect(useCSRFFetch()).toBe(fetchWithCSRF);
    });
  });

  // ── createCSRFMutation ────────────────────────────────────────────────
  describe('createCSRFMutation', () => {
    it('calls underlying mutation when token exists', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=mut-token';
      const { createCSRFMutation } = await import('../csrf-client');

      const mockMutation = vi.fn().mockResolvedValue({ id: 1 });
      const wrapped = createCSRFMutation(mockMutation);
      const result = await wrapped({ name: 'test' });

      expect(mockMutation).toHaveBeenCalledWith({ name: 'test' });
      expect(result).toEqual({ id: 1 });
    });

    it('throws when no CSRF token', async () => {
      browserGlobal.document.cookie = '';
      const { createCSRFMutation } = await import('../csrf-client');

      const wrapped = createCSRFMutation(vi.fn());
      await expect(wrapped({})).rejects.toThrow('CSRF token not found');
    });
  });

  // ── submitFormWithCSRF ────────────────────────────────────────────────
  describe('submitFormWithCSRF', () => {
    it('submits form data with CSRF header', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=form-token';
      const { submitFormWithCSRF } = await import('../csrf-client');

      // Minimal HTMLFormElement mock
      const mockForm = {} as HTMLFormElement;
      // Mock FormData constructor
      vi.stubGlobal('FormData', class { });

      await submitFormWithCSRF(mockForm, '/api/submit', 'POST');

      expect(mocks.mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mocks.mockFetch.mock.calls[0];
      expect(url).toBe('/api/submit');
      expect(opts.method).toBe('POST');
      expect(opts.headers['x-csrf-token']).toBe('form-token');
    });

    it('throws when no CSRF token', async () => {
      browserGlobal.document.cookie = '';
      const { submitFormWithCSRF } = await import('../csrf-client');

      const mockForm = {} as HTMLFormElement;
      vi.stubGlobal('FormData', class { });

      await expect(submitFormWithCSRF(mockForm, '/api/submit')).rejects.toThrow('CSRF token not found');
    });
  });

  // ── submitJSONWithCSRF ────────────────────────────────────────────────
  describe('submitJSONWithCSRF', () => {
    it('submits JSON with CSRF header and returns parsed response', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=json-token';
      mocks.mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));

      const { submitJSONWithCSRF } = await import('../csrf-client');
      const result = await submitJSONWithCSRF('/api/users', { name: 'Jane' });

      expect(result).toEqual({ ok: true });
      const [url, opts] = mocks.mockFetch.mock.calls[0];
      expect(url).toBe('/api/users');
      expect(opts.method).toBe('POST');
      expect(opts.headers['Content-Type']).toBe('application/json');
      expect(opts.headers['x-csrf-token']).toBe('json-token');
      expect(opts.body).toBe(JSON.stringify({ name: 'Jane' }));
    });

    it('throws when no CSRF token', async () => {
      browserGlobal.document.cookie = '';
      const { submitJSONWithCSRF } = await import('../csrf-client');

      await expect(submitJSONWithCSRF('/api/users', {})).rejects.toThrow('CSRF token not found');
    });

    it('throws on non-OK response', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=err-token';
      mocks.mockFetch.mockResolvedValue(new Response('', { status: 403, statusText: 'Forbidden' }));

      const { submitJSONWithCSRF } = await import('../csrf-client');
      await expect(submitJSONWithCSRF('/api/admin', {})).rejects.toThrow('HTTP 403');
    });

    it('uses custom method when provided', async () => {
      browserGlobal.document.cookie = '__Host-csrf-token=put-token';
      mocks.mockFetch.mockResolvedValue(new Response(JSON.stringify({ updated: true }), { status: 200 }));

      const { submitJSONWithCSRF } = await import('../csrf-client');
      await submitJSONWithCSRF('/api/users/1', { name: 'Updated' }, 'PUT');

      const [, opts] = mocks.mockFetch.mock.calls[0];
      expect(opts.method).toBe('PUT');
    });
  });
});
