import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ error: vi.fn(), warn: vi.fn() }));

vi.mock('@/lib/client-logger', () => ({
  createClientLogger: () => ({
    error: h.error,
    warn: h.warn,
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { api, electionsAPI, ApiRequestError } from '../index';

const record = {
  id: '3f1c9a0e-5b7d-4c1a-9d52-0a6f4f7a1b01',
  electionYear: 2026,
  electionDate: '2026-10-01',
  positionsAvailable: 2,
  candidates: [{ name: 'A. Candidate', union: 'Local 1', platform: 'Fair pay' }],
  winners: [],
  totalVotes: 0,
  participationRate: null,
  verifiedBy: null,
  verificationDate: null,
  contestedResults: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** What withApi sends for a handler that returns { data }: the framework envelope around the handler's own { data }. */
const wrapped = (data: unknown) => ({ success: true, data: { data }, timestamp: '2026-01-01T00:00:00.000Z' });

function res(body: unknown, status = 200, statusText = 'OK') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  h.error.mockReset();
  h.warn.mockReset();
  fetchMock = vi.fn(async () => res(wrapped([record])));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('electionsAPI.list', () => {
  it('reads the records out of the framework envelope, with a GET and no Idempotency-Key', async () => {
    const elections = await electionsAPI.list();
    expect(elections).toHaveLength(1);
    expect(elections[0]).toMatchObject({ id: record.id, electionYear: 2026, positionsAvailable: 2 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/elections');
    expect(init.method).toBeUndefined();
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['Idempotency-Key']).toBeUndefined();
  });

  it('returns an empty list only when the server really returned one', async () => {
    fetchMock.mockResolvedValueOnce(res(wrapped([])));
    await expect(electionsAPI.list()).resolves.toEqual([]);
  });

  it('rejects a body that is not a list of records instead of answering with an empty list', async () => {
    fetchMock.mockResolvedValueOnce(res(wrapped({ not: 'a list' })));
    await expect(electionsAPI.list()).rejects.toThrow('Unexpected response from /api/elections');
    expect(h.error).toHaveBeenCalled();
  });

  it('rejects a record that is missing a field the screens rely on', async () => {
    const { id: _id, ...withoutId } = record;
    fetchMock.mockResolvedValueOnce(res(wrapped([withoutId])));
    await expect(electionsAPI.list()).rejects.toThrow('Unexpected response');
  });

  it('accepts null for the columns the table allows to be null', async () => {
    fetchMock.mockResolvedValueOnce(
      res(wrapped([{ ...record, participationRate: null, verifiedBy: null, verificationDate: null, contestedResults: null }])),
    );
    await expect(electionsAPI.list()).resolves.toHaveLength(1);
  });
});

describe('electionsAPI.get', () => {
  it('requests the record by its encoded id and reads it out of the envelope', async () => {
    fetchMock.mockResolvedValueOnce(res(wrapped(record)));
    await expect(electionsAPI.get(record.id)).resolves.toMatchObject({ id: record.id });
    expect(fetchMock.mock.calls[0][0]).toBe(`/api/elections/${record.id}`);
  });

  it('encodes an id so it cannot change the path', async () => {
    fetchMock.mockResolvedValueOnce(res(wrapped(record)));
    await electionsAPI.get('a/../b');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/elections/a%2F..%2Fb');
  });

  it('surfaces a 404 as an ApiRequestError that carries the status', async () => {
    fetchMock.mockResolvedValueOnce(res({ code: 'NOT_FOUND', message: 'Election not found' }, 404, 'Not Found'));
    const failure = await electionsAPI.get('missing').catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiRequestError);
    expect(failure).toMatchObject({ status: 404, message: 'Election not found' });
  });
});

describe('electionsAPI.create', () => {
  const input = {
    electionYear: 2026,
    electionDate: '2026-10-01',
    positionsAvailable: 2,
    candidates: [{ name: 'A. Candidate', union: 'Local 1', platform: 'Fair pay' }],
  };

  it('POSTs exactly the input with an Idempotency-Key and reads the unwrapped 201 body', async () => {
    fetchMock.mockResolvedValueOnce(res({ data: record }, 201, 'Created'));
    await expect(electionsAPI.create(input)).resolves.toMatchObject({ id: record.id });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/elections');
    expect(init.method).toBe('POST');
    expect(typeof init.headers['Idempotency-Key']).toBe('string');
    expect(JSON.parse(init.body)).toEqual(input);
  });

  it('does not send results: winners, vote totals and the contested flag are left to the route defaults', async () => {
    fetchMock.mockResolvedValueOnce(res({ data: record }, 201, 'Created'));
    await electionsAPI.create(input);
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).not.toHaveProperty('winners');
    expect(sent).not.toHaveProperty('totalVotes');
    expect(sent).not.toHaveProperty('contestedResults');
  });

  it('rejects with the status when the server refuses', async () => {
    fetchMock.mockResolvedValueOnce(res({ code: 'FORBIDDEN', message: 'Forbidden: Requires clc_staff' }, 403, 'Forbidden'));
    await expect(electionsAPI.create(input)).rejects.toMatchObject({ status: 403, message: 'Forbidden: Requires clc_staff' });
  });
});

describe('request failures', () => {
  it('uses the server message and throws an ApiRequestError; an expected refusal is logged as a warning, not an error', async () => {
    fetchMock.mockResolvedValueOnce(res({ message: 'bad request' }, 400, 'Bad Request'));
    const failure = await electionsAPI.list().catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiRequestError);
    expect(failure).toMatchObject({ status: 400, message: 'bad request', name: 'ApiRequestError' });
    expect(h.warn).toHaveBeenCalledWith('API request refused [/api/elections]', { status: 400, message: 'bad request' });
    expect(h.error).not.toHaveBeenCalled();
  });

  it('logs a server fault as an error', async () => {
    fetchMock.mockResolvedValueOnce(res({ message: 'boom' }, 500, 'Internal Server Error'));
    await expect(electionsAPI.list()).rejects.toMatchObject({ status: 500, message: 'boom' });
    expect(h.error).toHaveBeenCalled();
    expect(h.warn).not.toHaveBeenCalled();
  });

  it('falls back to statusText when the error body cannot be parsed', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Server Error',
      json: async () => {
        throw new Error('not json');
      },
    });
    await expect(electionsAPI.list()).rejects.toMatchObject({ status: 500, message: 'Server Error' });
  });

  it('falls back to the status code when there is neither a message nor a status text', async () => {
    fetchMock.mockResolvedValueOnce(res({}, 502, ''));
    await expect(electionsAPI.list()).rejects.toMatchObject({ status: 502, message: 'HTTP 502' });
  });

  it('logs and rethrows when fetch itself rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await expect(electionsAPI.list()).rejects.toThrow('network down');
    expect(h.error).toHaveBeenCalled();
  });
});

describe('the exported surface', () => {
  it('offers only what a live screen uses, and no vote or results call', () => {
    expect(Object.keys(api)).toEqual(['elections']);
    expect(api.elections).toBe(electionsAPI);
    expect(Object.keys(electionsAPI).sort()).toEqual(['create', 'get', 'list']);
    expect(electionsAPI).not.toHaveProperty('vote');
    expect(electionsAPI).not.toHaveProperty('results');
  });
});
