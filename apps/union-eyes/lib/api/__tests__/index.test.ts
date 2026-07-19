import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ error: vi.fn() }));

vi.mock('@/lib/client-logger', () => ({
  createClientLogger: () => ({
    error: h.error,
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  membersAPI,
  memberSegmentsAPI,
  duesAPI,
  casesAPI,
  strikeFundAPI,
  electionsAPI,
  dashboardAPI,
  adminAPI,
  api,
} from '../index';

type FakeResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<unknown>;
};

function res(body: unknown, status = 200, statusText = 'OK'): FakeResponse {
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
  fetchMock = vi.fn(async () => res({ ok: true }));
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('fetchAPI behavior (via membersAPI)', () => {
  it('issues a GET without an Idempotency-Key header', async () => {
    await membersAPI.get('m1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/members/m1');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['Idempotency-Key']).toBeUndefined();
  });

  it('adds an Idempotency-Key header for mutations', async () => {
    await membersAPI.create({ name: 'x' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/members');
    expect(init.method).toBe('POST');
    expect(typeof init.headers['Idempotency-Key']).toBe('string');
  });

  it('builds query strings and filters out undefined/null params', async () => {
    await membersAPI.list({ search: 'a', status: 'active', local: undefined, limit: 10 });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain('/api/members?');
    expect(url).toContain('search=a');
    expect(url).toContain('status=active');
    expect(url).toContain('limit=10');
    expect(url).not.toContain('local');
  });

  it('omits the query string when no params are provided', async () => {
    await membersAPI.list();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/members');
  });

  it('throws the server-provided error message on non-ok responses', async () => {
    fetchMock.mockResolvedValueOnce(res({ message: 'bad request' }, 400, 'Bad Request'));
    await expect(membersAPI.get('m1')).rejects.toThrow('bad request');
    expect(h.error).toHaveBeenCalled();
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
    await expect(membersAPI.get('m1')).rejects.toThrow('Server Error');
  });

  it('returns an empty object for 204 No Content', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 204,
      statusText: 'No Content',
      json: async () => {
        throw new Error('should not parse');
      },
    });
    await expect(membersAPI.delete('m1')).resolves.toEqual({});
  });

  it('logs and rethrows when fetch itself rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    await expect(membersAPI.get('m1')).rejects.toThrow('network down');
    expect(h.error).toHaveBeenCalled();
  });
});

describe('members and segments APIs', () => {
  it('covers every members method', async () => {
    await membersAPI.list();
    await membersAPI.get('m1');
    await membersAPI.create({});
    await membersAPI.update('m1', {});
    await membersAPI.delete('m1');
    await membersAPI.search('q');
    await membersAPI.import({ name: 'f.csv' } as unknown as File);
    expect(fetchMock).toHaveBeenCalled();
  });

  it('throws when member import fails', async () => {
    fetchMock.mockResolvedValueOnce(res({}, 500, 'fail'));
    await expect(membersAPI.import({ name: 'f.csv' } as unknown as File)).rejects.toThrow('Import failed');
  });

  it('covers every member-segments method', async () => {
    await memberSegmentsAPI.list();
    await memberSegmentsAPI.create({});
    await memberSegmentsAPI.preview([{}]);
    await memberSegmentsAPI.delete('s1');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('dues API', () => {
  it('covers dashboard, remittances, reconciliation, arrears and payment plans', async () => {
    await duesAPI.dashboard();
    await duesAPI.remittances.list({ employer: 'e', status: 's', limit: 5 });
    await duesAPI.remittances.upload({ name: 'r.csv' } as unknown as File, { period: '2024' });
    await duesAPI.reconciliation.queue();
    await duesAPI.reconciliation.autoMatch();
    await duesAPI.reconciliation.match('r1', 'm1');
    await duesAPI.reconciliation.reject('r1', 'bad');
    await duesAPI.arrears.list();
    await duesAPI.arrears.recordPayment('m1', 100, 'note');
    await duesAPI.arrears.sendReminder('m1');
    await duesAPI.paymentPlans.list();
    await duesAPI.paymentPlans.get('p1');
    await duesAPI.paymentPlans.create({});
    await duesAPI.paymentPlans.update('p1', {});
    await duesAPI.paymentPlans.delete('p1');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('throws when remittance upload fails', async () => {
    fetchMock.mockResolvedValueOnce(res({}, 500, 'fail'));
    await expect(
      duesAPI.remittances.upload({ name: 'r.csv' } as unknown as File, {})
    ).rejects.toThrow('Upload failed');
  });
});

describe('cases API', () => {
  it('covers every cases method', async () => {
    await casesAPI.list({ status: 'open', type: 't', priority: 'high' });
    await casesAPI.get('c1');
    await casesAPI.create({});
    await casesAPI.update('c1', {});
    await casesAPI.delete('c1');
    await casesAPI.timeline('c1');
    await casesAPI.evidence.list('c1');
    await casesAPI.evidence.upload('c1', { name: 'e.pdf' } as unknown as File);
    await casesAPI.evidence.delete('c1', 'e1');
    await casesAPI.notes.list('c1');
    await casesAPI.notes.create('c1', 'hello');
    expect(fetchMock).toHaveBeenCalled();
  });

  it('throws when evidence upload fails', async () => {
    fetchMock.mockResolvedValueOnce(res({}, 500, 'fail'));
    await expect(
      casesAPI.evidence.upload('c1', { name: 'e.pdf' } as unknown as File)
    ).rejects.toThrow('Upload failed');
  });
});

describe('remaining APIs', () => {
  it('covers strike fund, elections, dashboard and admin', async () => {
    await strikeFundAPI.dashboard();

    await electionsAPI.list({ status: 'open' });
    await electionsAPI.get('e1');
    await electionsAPI.create({});
    await electionsAPI.update('e1', {});
    await electionsAPI.vote('e1', { pos: ['cand'] });
    await electionsAPI.results('e1');

    await dashboardAPI.stats();
    await dashboardAPI.activities(20);

    await adminAPI.integrations.list();
    await adminAPI.integrations.test('i1');
    await adminAPI.integrations.sync('i1');
    await adminAPI.governance.policies();
    await adminAPI.governance.createPolicy({});
    await adminAPI.audit.logs({ limit: 10, entity: 'member' });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('exposes the aggregated api object', () => {
    expect(api.members).toBe(membersAPI);
    expect(api.dues).toBe(duesAPI);
    expect(api.admin).toBe(adminAPI);
  });
});
