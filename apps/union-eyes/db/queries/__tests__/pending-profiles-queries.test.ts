/**
 * Pending Profiles Queries — Unit Tests
 *
 * withRLSContext + drizzle-builder queue mock. No try/catch in this file, so
 * only happy paths plus empty-result branches are exercised.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ queue: [] as unknown[] }));

function shift() {
  return mocks.queue.length ? mocks.queue.shift() : [];
}
function makeChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'values', 'set', 'returning']) {
    chain[m] = () => chain;
  }
  (chain as { then: unknown }).then = (
    resolve: (v: unknown) => unknown,
    reject: (e: unknown) => unknown,
  ) => {
    const v = shift();
    if (v instanceof Error) return Promise.reject(v).then(resolve, reject);
    return Promise.resolve(v).then(resolve, reject);
  };
  return chain;
}
function makeTx() {
  return {
    select: () => makeChain(),
    insert: () => makeChain(),
    update: () => makeChain(),
    delete: () => makeChain(),
  };
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (op: (tx: unknown) => Promise<unknown>) => op(makeTx()),
}));

import * as q from '../pending-profiles-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}

beforeEach(() => {
  mocks.queue = [];
  vi.clearAllMocks();
});

describe('pending-profiles-queries', () => {
  it('createPendingProfile returns the inserted row', async () => {
    push([{ id: 'p1', email: 'a@b.com' }]);
    expect(await q.createPendingProfile({ email: 'a@b.com' } as never)).toEqual({
      id: 'p1',
      email: 'a@b.com',
    });
  });

  it('getPendingProfileByEmail returns first match', async () => {
    push([{ id: 'p1', email: 'a@b.com' }]);
    expect(await q.getPendingProfileByEmail('a@b.com')).toEqual({ id: 'p1', email: 'a@b.com' });
  });
  it('getPendingProfileByEmail returns undefined when none', async () => {
    push([]);
    expect(await q.getPendingProfileByEmail('missing@b.com')).toBeUndefined();
  });

  it('getUnclaimedPendingProfiles returns the list', async () => {
    push([{ id: 'p1' }, { id: 'p2' }]);
    expect(await q.getUnclaimedPendingProfiles()).toHaveLength(2);
  });

  it('markPendingProfileAsClaimed returns the updated row', async () => {
    push([{ id: 'p1', claimed: true, claimedByUserId: 'u1' }]);
    const r = await q.markPendingProfileAsClaimed('p1', 'u1');
    expect(r).toEqual({ id: 'p1', claimed: true, claimedByUserId: 'u1' });
  });

  it('deletePendingProfile returns true when a row was deleted', async () => {
    push([{ id: 'p1' }]);
    expect(await q.deletePendingProfile('p1')).toBe(true);
  });
  it('deletePendingProfile returns false when nothing was deleted', async () => {
    push([]);
    expect(await q.deletePendingProfile('missing')).toBe(false);
  });
});
