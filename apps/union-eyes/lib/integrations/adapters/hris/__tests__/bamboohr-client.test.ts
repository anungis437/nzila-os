import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { BambooHRClient } from '../../../adapters/hris/bamboohr-client';
import { AuthenticationError, RateLimitError, IntegrationError } from '../../../types';

const resp = (body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) => ({
  ok: (init.status ?? 200) >= 200 && (init.status ?? 200) < 300,
  status: init.status ?? 200,
  headers: { get: (k: string) => init.headers?.[k] ?? null },
  json: async () => body,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
});

const queue: unknown[] = [];
const pushResp = (...r: unknown[]) => queue.push(...r);
let fetchMock: ReturnType<typeof vi.fn>;

const makeClient = () => new BambooHRClient({ companyDomain: 'acme', apiKey: 'key' });

describe('BambooHRClient', () => {
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

  it('getEmployees returns the directory employees', async () => {
    const client = makeClient();
    pushResp(resp({ employees: [{ id: '1', firstName: 'Jane' }] }));
    const r = await client.getEmployees();
    expect(r).toHaveLength(1);
  });

  it('getEmployees with custom fields and empty result returns []', async () => {
    const client = makeClient();
    pushResp(resp({}));
    const r = await client.getEmployees(['id', 'email']);
    expect(r).toEqual([]);
  });

  it('getEmployee returns a single employee', async () => {
    const client = makeClient();
    pushResp(resp({ id: '9', firstName: 'Joe' }));
    const e = await client.getEmployee('9');
    expect(e.id).toBe('9');
  });

  it('getEmployee with custom fields works', async () => {
    const client = makeClient();
    pushResp(resp({ id: '9' }));
    const e = await client.getEmployee('9', ['id']);
    expect(e.id).toBe('9');
  });

  it('getChangedEmployees returns changes', async () => {
    const client = makeClient();
    pushResp(resp({ changes: [{ id: '1' }] }));
    const r = await client.getChangedEmployees(new Date('2023-01-01'));
    expect(r.changes).toHaveLength(1);
  });

  it('getDepartments returns departments', async () => {
    const client = makeClient();
    pushResp(resp({ departments: [{ id: '1', name: 'Eng' }] }));
    const r = await client.getDepartments();
    expect(r).toHaveLength(1);
  });

  it('getLocations returns locations', async () => {
    const client = makeClient();
    pushResp(resp({ locations: [{ id: '1', name: 'HQ' }] }));
    const r = await client.getLocations();
    expect(r).toHaveLength(1);
  });

  it('getTimeOffRequests passes through query params', async () => {
    const client = makeClient();
    pushResp(resp([{ id: '1' }]));
    const r = await client.getTimeOffRequests({ startDate: '2023-01-01', endDate: '2023-12-31', type: 'vacation', status: 'approved' });
    expect(r).toHaveLength(1);
  });

  it('getTimeOffRequests without params works', async () => {
    const client = makeClient();
    pushResp(resp([]));
    const r = await client.getTimeOffRequests();
    expect(r).toEqual([]);
  });

  it('request throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(resp({}, { status: 429, headers: { 'Retry-After': '20' } }));
    await expect(client.getDepartments()).rejects.toBeInstanceOf(RateLimitError);
  });

  it('request throws AuthenticationError on 401/403', async () => {
    const client = makeClient();
    pushResp(resp('forbidden', { status: 403 }));
    await expect(client.getDepartments()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('request throws IntegrationError on other non-ok', async () => {
    const client = makeClient();
    pushResp(resp('err', { status: 500 }));
    await expect(client.getDepartments()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('request returns {} on an empty body', async () => {
    const client = makeClient();
    pushResp(resp(''));
    const e = await client.getEmployee('1');
    expect(e).toEqual({});
  });

  it('request wraps a network error as IntegrationError', async () => {
    const client = makeClient();
    pushResp(new Error('socket'));
    await expect(client.getDepartments()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('healthCheck returns true then false', async () => {
    const client = makeClient();
    pushResp(resp({ departments: [] }));
    expect(await client.healthCheck()).toBe(true);
    pushResp(new Error('down'));
    expect(await client.healthCheck()).toBe(false);
  });
});
