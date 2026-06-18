import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'crypto';

const h = vi.hoisted(() => {
  process.env.CLC_WEBHOOK_SECRET = 'test-secret';
  process.env.CLC_API_BASE_URL = 'https://clc.test/v1';
  process.env.CLC_API_KEY = 'test-key';
  const queue: unknown[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'from', 'where', 'limit', 'orderBy', 'set', 'values', 'returning', 'insert', 'update', 'delete']) {
      chain[m] = () => chain;
    }
    chain.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) => {
      const v = queue.length ? queue.shift() : [];
      return (v instanceof Error ? Promise.reject(v) : Promise.resolve(v)).then(res, rej);
    };
    return chain;
  };
  const db = { select: () => makeChain(), insert: () => makeChain(), update: () => makeChain() };
  return { queue, db, fetch: vi.fn() };
});

vi.mock('@/db', () => ({ db: h.db }));
vi.mock('@/db/schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('@/db/schema/clc-sync-audit-schema', () => new Proxy({}, {
  has: () => true,
  get: (_t, n) => (n === '__esModule' ? false : new Proxy({}, { get: (_o, c) => ({ __col: c }) })),
}));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('drizzle-orm', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  eq: vi.fn(() => ({})),
  isNotNull: vi.fn(() => ({})),
}));

import {
  syncOrganization,
  syncAllOrganizations,
  createOrganizationFromCLC,
  handleWebhook,
} from '../clc-api-integration';

const push = (...items: unknown[]) => h.queue.push(...items);

const CLC = {
  affiliateCode: 'CH1', name: 'Local 1', legalName: 'Local 1 Legal', organizationType: 'local',
  status: 'active', province: 'ON', city: 'Toronto', postalCode: 'M1M 1M1',
  contactEmail: 'a@x.com', contactPhone: '+15551', membershipCount: 90, lastUpdated: '2024-01-01', perCapitaRate: 5,
};
const localEqual = {
  id: 'o1', charterNumber: 'CH1', name: 'Local 1', legalName: 'Local 1 Legal', status: 'active',
  province: 'ON', city: 'Toronto', postalCode: 'M1M 1M1', contactEmail: 'a@x.com', contactPhone: '+15551', totalMembers: 90,
};
const localDiff = { ...localEqual, name: 'Old Name', contactEmail: 'old@x.com', city: 'Ottawa' };

const okFetch = () => ({ ok: true, status: 200, statusText: 'OK', json: async () => CLC });

const buildPayload = (type: string, badSig = false) => {
  const p: Record<string, unknown> = { id: 'w1', type, timestamp: '2024-01-01T00:00:00Z', data: CLC, signature: '' };
  const { signature: _omit, ...rest } = p;
  p.signature = badSig ? 'deadbeef' : createHmac('sha256', 'test-secret').update(JSON.stringify(rest)).digest('hex');
  return p as never;
};

beforeEach(() => {
  h.queue.length = 0;
  global.fetch = h.fetch as never;
  h.fetch.mockReset().mockResolvedValue(okFetch());
});

describe('syncOrganization', () => {
  it('skips when there are no changes', async () => {
    push([localEqual], []);
    const r = await syncOrganization('o1');
    expect(r.action).toBe('skipped');
    expect(r.success).toBe(true);
  });

  it('updates and resolves conflicts when fields differ', async () => {
    push([localDiff], [], []);
    const r = await syncOrganization('o1');
    expect(r.action).toBe('updated');
    expect(r.changes?.some((c) => c.startsWith('name:'))).toBe(true);
    expect((r.conflicts?.length ?? 0)).toBeGreaterThanOrEqual(3);
  });

  it('fails when the organization is not found locally', async () => {
    push([], []);
    const r = await syncOrganization('o1');
    expect(r.action).toBe('failed');
    expect(r.error).toContain('not found locally');
  });

  it('fails when the organization has no charter number', async () => {
    push([{ id: 'o1', charterNumber: null }], []);
    const r = await syncOrganization('o1');
    expect(r.action).toBe('failed');
    expect(r.error).toContain('charter');
  });

  it('updates when only a manual-review field differs (no clc_wins changes)', async () => {
    push([{ ...localEqual, city: 'Ottawa' }], [], []);
    const r = await syncOrganization('o1');
    expect(r.action).toBe('updated');
    expect(r.changes).toEqual([]);
    expect(r.conflicts?.some((c) => c.resolution === 'manual_review')).toBe(true);
  });
});

describe('syncAllOrganizations', () => {
  it('iterates organizations and tallies statistics', async () => {
    push([{ id: 'o1' }], [localEqual], []);
    const stats = await syncAllOrganizations();
    expect(stats.totalOrganizations).toBe(1);
    expect(stats.synced).toBe(1);
    expect(stats.skipped).toBe(1);
  });
});

describe('createOrganizationFromCLC', () => {
  it('creates a new organization', async () => {
    push([], [{ id: 'new1' }], []);
    const r = await createOrganizationFromCLC('CH1');
    expect(r.action).toBe('created');
    expect(r.organizationId).toBe('new1');
  });

  it('fails when the organization already exists', async () => {
    push([{ id: 'ex1' }]);
    const r = await createOrganizationFromCLC('CH1');
    expect(r.action).toBe('failed');
    expect(r.error).toContain('already exists');
  });

  it('fails when the CLC API returns an error', async () => {
    h.fetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error', json: async () => ({}) });
    push([]);
    const r = await createOrganizationFromCLC('CH1');
    expect(r.action).toBe('failed');
    expect(r.error).toContain('CLC API error');
  });

  it('retries after an aborted (timed-out) request', async () => {
    vi.useFakeTimers();
    let calls = 0;
    h.fetch.mockImplementation((_url: string, opts: { signal: AbortSignal }) => {
      calls++;
      if (calls === 1) {
        return new Promise((_res, rej) => {
          opts.signal.addEventListener('abort', () => rej(new Error('aborted')));
        });
      }
      return Promise.resolve(okFetch());
    });
    push([], [{ id: 'new1' }], []);
    const promise = createOrganizationFromCLC('CH1');
    await vi.advanceTimersByTimeAsync(30000); // trigger the abort timeout
    await vi.advanceTimersByTimeAsync(1000); // exhaust the retry backoff
    const r = await promise;
    vi.useRealTimers();
    expect(r.action).toBe('created');
  });
});

describe('handleWebhook', () => {
  it('rejects an invalid signature', async () => {
    push([]);
    const r = await handleWebhook(buildPayload('organization.updated', true));
    expect(r.success).toBe(false);
    expect(r.message).toContain('Invalid');
  });

  it('handles organization.created', async () => {
    push([], [{ id: 'new1' }], [], []);
    const r = await handleWebhook(buildPayload('organization.created'));
    expect(r.success).toBe(true);
  });

  it('handles organization.updated for an existing organization', async () => {
    push([localEqual], [localEqual], [], []);
    const r = await handleWebhook(buildPayload('organization.updated'));
    expect(r.success).toBe(true);
  });

  it('handles organization.deleted with a soft delete', async () => {
    push([localEqual], [], []);
    const r = await handleWebhook(buildPayload('organization.deleted'));
    expect(r.success).toBe(true);
  });

  it('handles membership.updated', async () => {
    push([localEqual], [], []);
    const r = await handleWebhook(buildPayload('membership.updated'));
    expect(r.success).toBe(true);
  });

  it('rejects an unknown webhook type', async () => {
    push([]);
    const r = await handleWebhook(buildPayload('something.unknown'));
    expect(r.success).toBe(false);
    expect(r.message).toContain('Unknown');
  });
});
