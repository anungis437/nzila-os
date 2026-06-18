import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { WorkdayClient } from '../../../adapters/hris/workday-client';
import { AuthenticationError, RateLimitError, IntegrationError } from '../../../types';

const resp = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) => ({
  ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
  status: init.status ?? 200,
  headers: { get: (k: string) => init.headers?.[k] ?? null },
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const tokenResponse = () => resp({ access_token: 'at', token_type: 'Bearer', expires_in: 3600 });

const queue: unknown[] = [];
const pushResp = (...r: unknown[]) => queue.push(...r);
let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = (over: Record<string, unknown> = {}) =>
  new WorkdayClient({
    clientId: 'cid',
    clientSecret: 'secret',
    tenantId: 'tenant1',
    environment: 'sandbox',
    refreshToken: 'rt',
    ...over,
  });

const worker = (id: string) => ({
  id,
  descriptor: `Worker ${id}`,
  primaryWorkEmail: { email: 'jane.doe@example.com' },
  primaryWorkPhone: { formattedPhone: '555' },
  businessTitle: 'Engineer',
  location: { descriptor: 'HQ' },
  hireDate: '2020-01-01',
  workerStatus: { descriptor: 'Active' },
  timeType: { descriptor: 'Full-time' },
  manager: { id: 'm1', descriptor: 'Boss' },
});

describe('WorkdayClient', () => {
  beforeEach(() => {
    queue.length = 0;
    fetchMock = vi.fn(async () => {
      const next = queue.length ? queue.shift() : resp({});
      if (next instanceof Error) throw next;
      return next as Response;
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('authenticate succeeds with refresh_token grant', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    await expect(client.authenticate()).resolves.toBeUndefined();
  });

  it('authenticate uses client_credentials when no refresh token', async () => {
    const client = makeClient({ refreshToken: undefined });
    pushResp(tokenResponse());
    await expect(client.authenticate()).resolves.toBeUndefined();
  });

  it('authenticate throws on non-ok token response', async () => {
    const client = makeClient();
    pushResp(resp('bad', { status: 401 }));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('authenticate wraps a network error', async () => {
    const client = makeClient();
    pushResp(new Error('net'));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('getEmployees maps workers and returns pagination', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ data: [worker('1'), worker('2')], total: 2, next_cursor: 'c1' }));
    const r = await client.getEmployees({ limit: 50, offset: 0 });
    expect(r.data).toHaveLength(2);
    expect(r.cursor).toBe('c1');
    expect(r.data[0].position).toBe('Engineer');
  });

  it('getEmployee maps a single worker', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp(worker('9')));
    const e = await client.getEmployee('9');
    expect(e.id).toBe('9');
    expect(e.supervisor?.name).toBe('Boss');
  });

  it('getEmployee maps a worker without manager/email gracefully', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ id: '5' }));
    const e = await client.getEmployee('5');
    expect(e.email).toBe('');
    expect(e.supervisor).toBeUndefined();
  });

  it('getPositions maps job profiles', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ data: [{ id: 'p1', descriptor: 'Dev', jobDescription: 'desc' }] }));
    const r = await client.getPositions({ limit: 10, offset: 0 });
    expect(r.data[0].title).toBe('Dev');
    expect(r.total).toBe(1);
  });

  it('getDepartments maps organizations', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ data: [{ id: 'o1', descriptor: 'Eng', organizationCode: 'ENG', manager: { id: 'm1', descriptor: 'Boss' }, superiorOrganization: { id: 'root' } }] }));
    const r = await client.getDepartments();
    expect(r.data[0].name).toBe('Eng');
    expect(r.data[0].manager?.name).toBe('Boss');
    expect(r.data[0].parentDepartment).toBe('root');
  });

  it('request throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({}, { status: 429, headers: { 'Retry-After': '30' } }));
    await expect(client.getDepartments()).rejects.toBeInstanceOf(RateLimitError);
  });

  it('request throws IntegrationError on non-ok', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp('err', { status: 500 }));
    await expect(client.getDepartments()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('request wraps a network error as IntegrationError', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(new Error('socket'));
    await expect(client.getDepartments()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('healthCheck returns true then false', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ data: [worker('1')], total: 1 }));
    expect(await client.healthCheck()).toBe(true);
    const client2 = makeClient();
    pushResp(new Error('down'));
    expect(await client2.healthCheck()).toBe(false);
  });
});
