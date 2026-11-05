import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ exists: vi.fn(), container: vi.fn() }));
vi.mock('@nzila/blob', () => ({ container: m.container }));

import { probeCache, probeQueue, probeStorage } from './service-probes';

const KEYS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'REDIS_URL', 'DJANGO_API_URL', 'NEXT_PUBLIC_DJANGO_API_URL', 'AZURE_BLOB_CONTAINER'] as const;
const saved: Record<string, string | undefined> = {};

describe('service probes', () => {
  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    m.exists.mockReset();
    m.container.mockReset();
    m.container.mockImplementation(() => ({ exists: m.exists }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  describe('probeCache: the store the rate limiter uses', () => {
    it('is degraded, with the reason, when no store is configured', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      const result = await probeCache();
      expect(result.state).toBe('degraded');
      expect(result.note).toMatch(/rate limiting is degraded/i);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not count the Vercel KV names: the rate limiter does not read them, so a store set only there is not a store it uses', async () => {
      process.env.KV_REST_API_URL = 'https://kv.example.com';
      process.env.KV_REST_API_TOKEN = 'kv-token';
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      expect((await probeCache()).state).toBe('degraded');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('pings Upstash over REST when both its URL and its token are set, and is ok when it answers', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://store.upstash.io/';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
      const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }));
      vi.stubGlobal('fetch', fetchMock);
      const result = await probeCache();
      expect(result.state).toBe('ok');
      expect(fetchMock).toHaveBeenCalledWith('https://store.upstash.io/ping', expect.objectContaining({ cache: 'no-store' }));
    });

    it('is degraded when the store answers with an error, and when it cannot be reached', async () => {
      process.env.UPSTASH_REDIS_REST_URL = 'https://store.upstash.io';
      process.env.UPSTASH_REDIS_REST_TOKEN = 'token';
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
      expect(await probeCache()).toMatchObject({ state: 'degraded', note: 'ping returned 503' });
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('socket hang up'); }));
      const unreachable = await probeCache();
      expect(unreachable.state).toBe('degraded');
      expect(unreachable.note).toMatch(/unreachable/i);
    });
  });

  describe('probeQueue: background jobs run in the Django backend', () => {
    it('is degraded and calls nothing when the backend is not configured', async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      expect(await probeQueue()).toMatchObject({ state: 'degraded', note: 'The background-job backend (Django) is not configured' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('asks the backend whether it is ready', async () => {
      process.env.DJANGO_API_URL = 'https://django.internal/';
      const fetchMock = vi.fn(async () => ({ ok: true }));
      vi.stubGlobal('fetch', fetchMock);
      expect((await probeQueue()).state).toBe('ok');
      expect(fetchMock).toHaveBeenCalledWith('https://django.internal/api/auth_core/ready/', expect.objectContaining({ cache: 'no-store' }));
    });

    it('falls back to the public backend URL the server is also given', async () => {
      process.env.NEXT_PUBLIC_DJANGO_API_URL = 'https://django.example';
      const fetchMock = vi.fn(async () => ({ ok: true }));
      vi.stubGlobal('fetch', fetchMock);
      await probeQueue();
      expect(fetchMock).toHaveBeenCalledWith('https://django.example/api/auth_core/ready/', expect.anything());
    });

    it('fails when the backend is not ready or does not answer, and does not publish why', async () => {
      process.env.DJANGO_API_URL = 'https://django.internal';
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
      expect(await probeQueue()).toMatchObject({ state: 'fail', note: 'The background-job backend is not ready' });
      vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('getaddrinfo ENOTFOUND django.internal'); }));
      const unreachable = await probeQueue();
      expect(unreachable).toMatchObject({ state: 'fail', note: 'The background-job backend is unreachable' });
      expect(JSON.stringify(unreachable)).not.toContain('ENOTFOUND');
    });
  });

  describe('probeStorage: the document container', () => {
    it('is ok when the container the documents are written to exists, using the same default the document services use', async () => {
      m.exists.mockResolvedValue(true);
      expect((await probeStorage()).state).toBe('ok');
      expect(m.container).toHaveBeenCalledWith('union-eyes');
      process.env.AZURE_BLOB_CONTAINER = 'union-eyes-documents-staging';
      await probeStorage();
      expect(m.container).toHaveBeenLastCalledWith('union-eyes-documents-staging');
    });

    it('fails when the container does not exist', async () => {
      m.exists.mockResolvedValue(false);
      expect(await probeStorage()).toMatchObject({ state: 'fail', note: 'The document container does not exist' });
    });

    it('fails, without the storage error text, when storage cannot be reached or is not configured', async () => {
      m.exists.mockRejectedValue(new Error('Missing required environment variable: AZURE_STORAGE_ACCOUNT_NAME'));
      const result = await probeStorage();
      expect(result).toMatchObject({ state: 'fail', note: 'Document storage is not reachable or not configured' });
      expect(JSON.stringify(result)).not.toContain('AZURE_STORAGE_ACCOUNT_NAME');
    });

    it('fails when storage does not answer in time', async () => {
      vi.useFakeTimers();
      m.exists.mockReturnValue(new Promise(() => undefined));
      const pending = probeStorage();
      await vi.advanceTimersByTimeAsync(3100);
      expect((await pending).state).toBe('fail');
    });
  });
});
