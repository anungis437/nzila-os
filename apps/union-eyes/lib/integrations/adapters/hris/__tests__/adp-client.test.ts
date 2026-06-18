import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { ADPClient } from '../../../adapters/hris/adp-client';
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
  new ADPClient({ clientId: 'cid', clientSecret: 'secret', environment: 'sandbox', ...over });

const adpWorker = (oid: string) => ({
  associateOID: oid,
  workerID: { idValue: `EMP-${oid}` },
  person: {
    legalName: { givenName: 'Jane', familyName: 'Doe' },
    communication: { emails: [{ emailUri: 'jane@x.com' }], phones: [{ areaDialing: '1', dialNumber: '5551234' }] },
  },
  businessCommunication: { emails: [{ emailUri: 'jane@work.com' }] },
  workerDates: { originalHireDate: '2020-01-01' },
  workerStatus: { statusCode: { codeValue: 'Active' } },
  workAssignments: [
    {
      positionTitle: 'Engineer',
      organizationalUnits: [{ nameCode: { codeValue: 'ENG', shortName: 'Engineering' } }],
      reportsTo: [{ associateOID: 'm1', workerID: { idValue: 'M1' } }],
    },
  ],
});

describe('ADPClient', () => {
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

  it('authenticate succeeds with client_credentials', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    await expect(client.authenticate()).resolves.toBeUndefined();
  });

  it('authenticate throws on non-ok response', async () => {
    const client = makeClient();
    pushResp(resp('bad', { status: 401 }));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('authenticate wraps a network error', async () => {
    const client = makeClient();
    pushResp(new Error('net'));
    await expect(client.authenticate()).rejects.toBeInstanceOf(AuthenticationError);
  });

  it('getWorkers returns workers', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ workers: [adpWorker('1')], meta: { totalCount: 1 } }));
    const r = await client.getWorkers({ limit: 10, skip: 0 });
    expect(r.workers).toHaveLength(1);
  });

  it('getWorker returns the first worker', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ workers: [adpWorker('9')] }));
    const w = await client.getWorker('9');
    expect(w.associateOID).toBe('9');
  });

  it('getWorker throws when worker not found', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ workers: [] }));
    await expect(client.getWorker('x')).rejects.toBeInstanceOf(IntegrationError);
  });

  it('mapWorkerToEmployee flattens nested fields', () => {
    const client = makeClient();
    const e = client.mapWorkerToEmployee(adpWorker('1'));
    expect(e.firstName).toBe('Jane');
    expect(e.email).toBe('jane@work.com');
    expect(e.phone).toBe('1-5551234');
    expect(e.department).toBe('Engineering');
    expect(e.supervisorId).toBe('m1');
  });

  it('getOrganizationalUnits returns units', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ workers: [], meta: {} }));
    const r = await client.getOrganizationalUnits({ limit: 5, skip: 0 });
    expect(r).toBeDefined();
  });

  it('request throws RateLimitError on 429', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({}, { status: 429, headers: { 'Retry-After': '15' } }));
    await expect(client.getWorkers()).rejects.toBeInstanceOf(RateLimitError);
  });

  it('request throws IntegrationError on non-ok', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp('err', { status: 500 }));
    await expect(client.getWorkers()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('request wraps a network error as IntegrationError', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(new Error('socket'));
    await expect(client.getWorkers()).rejects.toBeInstanceOf(IntegrationError);
  });

  it('healthCheck returns true then false', async () => {
    const client = makeClient();
    pushResp(tokenResponse());
    pushResp(resp({ workers: [adpWorker('1')] }));
    expect(await client.healthCheck()).toBe(true);
    const client2 = makeClient();
    pushResp(new Error('down'));
    expect(await client2.healthCheck()).toBe(false);
  });
});
