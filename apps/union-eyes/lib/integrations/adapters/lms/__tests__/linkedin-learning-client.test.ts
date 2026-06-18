import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { LinkedInLearningClient } from '../../../adapters/lms/linkedin-learning-client';

const resp = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) => ({
  ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
  status: init.status ?? 200,
  headers: { get: (k: string) => init.headers?.[k] ?? null },
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const tokenResponse = () => resp({ access_token: 'at', token_type: 'Bearer', expires_in: 3600 });
const elements = (rows: unknown[], total?: number) => resp({ elements: rows, paging: total !== undefined ? { total } : undefined });

const queue: unknown[] = [];
const pushResp = (...r: unknown[]) => queue.push(...r);
let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = () => new LinkedInLearningClient({ clientId: 'cid', clientSecret: 'secret' });

const expectRejectName = async (p: Promise<unknown>, name: string) => {
  await expect(p).rejects.toMatchObject({ name });
};

describe('LinkedInLearningClient', () => {
  beforeEach(() => {
    queue.length = 0;
    fetchMock = vi.fn(async () => {
      const next = queue.length ? queue.shift() : resp({ elements: [] });
      if (next instanceof Error) throw next;
      return next as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getCourses authenticates then returns courses', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(elements([{ urn: 'c1' }], 1));
    const r = await client.getCourses({ start: 0, count: 10, modifiedSince: '2024-01-01T00:00:00Z' });
    expect(r.courses).toHaveLength(1);
    expect(r.total).toBe(1);
  });

  it('getEnrollments returns enrollments', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(elements([{ courseUrn: 'c1' }]));
    const r = await client.getEnrollments({ start: 0, count: 5, modifiedSince: '2024-01-01T00:00:00Z' });
    expect(r.enrollments).toHaveLength(1);
  });

  it('getProgress returns progress', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(elements([{ courseUrn: 'c1' }]));
    const r = await client.getProgress({ start: 0, count: 5, learnerUrn: 'urn:li:person:1' });
    expect(r.progress).toHaveLength(1);
  });

  it('getCompletions returns completions', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(elements([{ courseUrn: 'c1' }]));
    const r = await client.getCompletions({ start: 0, count: 5, completedSince: '2024-01-01T00:00:00Z' });
    expect(r.completions).toHaveLength(1);
  });

  it('getLearners returns learners', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(elements([{ urn: 'urn:li:person:1' }]));
    const r = await client.getLearners({ start: 0, count: 5 });
    expect(r.learners).toHaveLength(1);
  });

  it('authenticate throws AuthenticationError on a non-ok token response', async () => {
    const client = makeClient();
    pushResp(resp('bad', { status: 401 }));
    await expectRejectName(client.getCourses(), 'AuthenticationError');
  });

  it('authenticate wraps a network error as AuthenticationError', async () => {
    const client = makeClient();
    pushResp(new Error('net'));
    await expectRejectName(client.getCourses(), 'AuthenticationError');
  });

  it('request throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({}, { status: 429, headers: { 'Retry-After': '30' } }));
    await expectRejectName(client.getCourses(), 'RateLimitError');
  });

  it('request throws AuthenticationError on 401', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp('unauthorized', { status: 401 }));
    await expectRejectName(client.getCourses(), 'AuthenticationError');
  });

  it('request throws IntegrationError on other non-ok', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp('boom', { status: 500 }));
    await expectRejectName(client.getCourses(), 'IntegrationError');
  });

  it('request wraps a network error as IntegrationError', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(new Error('socket'));
    await expectRejectName(client.getCourses(), 'IntegrationError');
  });

  it('healthCheck returns ok then error', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(elements([{ urn: 'c1' }]));
    expect((await client.healthCheck()).status).toBe('ok');
    const client2 = makeClient();
    pushResp(resp('bad', { status: 401 }));
    expect((await client2.healthCheck()).status).toBe('error');
  });
});
