/**
 * Profiles Queries — Unit Tests
 *
 * withRLSContext invokes the callback with a fake drizzle-style tx whose
 * builder chains resolve from a controllable queue.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ queue: [] as unknown[] }));

function makeChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'orderBy', 'limit', 'values', 'set', 'returning']) {
    chain[m] = () => chain;
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
    const v = mocks.queue.length ? mocks.queue.shift() : [];
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
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as q from '../profiles-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}

describe('profiles-queries', () => {
  beforeEach(() => {
    mocks.queue = [];
    vi.clearAllMocks();
  });

  it('createProfile uses defaults (free) and respects provided values', async () => {
    push([{ id: 'p1', membership: 'free' }]);
    const r = await q.createProfile({ userId: 'u1', email: 'a@b.c' } as never);
    expect(r).toEqual({ id: 'p1', membership: 'free' });

    push([{ id: 'p2', membership: 'pro' }]);
    const r2 = await q.createProfile({
      userId: 'u2', email: 'x@y.z', membership: 'pro', usageCredits: 500, usedCredits: 1,
      nextCreditRenewal: new Date(), status: 'active',
    } as never);
    expect(r2).toEqual({ id: 'p2', membership: 'pro' });
  });

  it('createProfile rethrows on error', async () => {
    push(new Error('db fail'));
    await expect(q.createProfile({ userId: 'u1', email: 'a@b.c' } as never)).rejects.toThrow('Failed to create profile');
  });

  it('getProfileByUserId returns profile or null', async () => {
    push([{ userId: 'u1' }]);
    expect(await q.getProfileByUserId('u1')).toEqual({ userId: 'u1' });
    push([]);
    expect(await q.getProfileByUserId('u1')).toBeNull();
  });

  it('getProfileByUserId returns null on error', async () => {
    push(new Error('boom'));
    expect(await q.getProfileByUserId('u1')).toBeNull();
  });

  it('getAllProfiles returns rows', async () => {
    push([{ id: 'p1' }, { id: 'p2' }]);
    expect(await q.getAllProfiles()).toHaveLength(2);
  });

  it('updateProfile + updateProfileByStripeCustomerId return updated row', async () => {
    push([{ id: 'p1', membership: 'pro' }]);
    expect(await q.updateProfile('u1', { membership: 'pro' } as never)).toEqual({ id: 'p1', membership: 'pro' });
    push([{ id: 'p1', stripeCustomerId: 'cus_1' }]);
    expect(await q.updateProfileByStripeCustomerId('cus_1', {} as never)).toEqual({ id: 'p1', stripeCustomerId: 'cus_1' });
  });

  it('updateProfile rethrows on error', async () => {
    push(new Error('fail'));
    await expect(q.updateProfile('u1', {} as never)).rejects.toThrow('Failed to update profile');
  });

  it('deleteProfile resolves and rethrows on error', async () => {
    push([]);
    await expect(q.deleteProfile('u1')).resolves.toBeUndefined();
    push(new Error('fail'));
    await expect(q.deleteProfile('u1')).rejects.toThrow('Failed to delete profile');
  });

  it('updateProfileByWhopUserId updates via found Clerk id', async () => {
    push([{ userId: 'clerk1', whopUserId: 'whop1' }]); // getProfileByWhopUserId lookup
    push([{ userId: 'clerk1', updated: true }]); // update returning
    const r = await q.updateProfileByWhopUserId('whop1', { membership: 'pro' } as never);
    expect(r).toEqual({ userId: 'clerk1', updated: true });
  });

  it('updateProfileByWhopUserId throws when whopUserId missing', async () => {
    await expect(q.updateProfileByWhopUserId('', {} as never)).rejects.toThrow(/Whop user ID/);
  });

  it('getProfileByWhopUserId returns profile or null', async () => {
    push([{ whopUserId: 'whop1' }]);
    expect(await q.getProfileByWhopUserId('whop1')).toEqual({ whopUserId: 'whop1' });
    push([]);
    expect(await q.getProfileByWhopUserId('whop1')).toBeNull();
  });

  it('getProfileByWhopUserId throws when id missing', async () => {
    await expect(q.getProfileByWhopUserId('')).rejects.toThrow(/Whop user ID/);
  });

  it('getProfileByUserEmail handles empty, found, and missing', async () => {
    expect(await q.getProfileByUserEmail('')).toBeNull();
    push([{ userId: 'u1', email: 'a@b.c' }]);
    expect(await q.getProfileByUserEmail('a@b.c')).toEqual({ userId: 'u1', email: 'a@b.c' });
    push([]);
    expect(await q.getProfileByUserEmail('a@b.c')).toBeNull();
  });

  it('getProfileByEmail returns row or null', async () => {
    push([{ email: 'a@b.c' }]);
    expect(await q.getProfileByEmail('a@b.c')).toEqual({ email: 'a@b.c' });
    push([]);
    expect(await q.getProfileByEmail('a@b.c')).toBeNull();
  });

  it('getUserPlanInfo returns plan info or null', async () => {
    push([{ userId: 'u1', membership: 'pro', planDuration: 'monthly', status: 'active', usageCredits: 100, usedCredits: 10 }]);
    const info = await q.getUserPlanInfo('u1');
    expect(info?.membership).toBe('pro');
    push([]); // no profile
    expect(await q.getUserPlanInfo('u1')).toBeNull();
  });

  it('deleteProfileById returns true/false', async () => {
    push([]);
    expect(await q.deleteProfileById('p1')).toBe(true);
    expect(await q.deleteProfileById('')).toBe(false); // empty id -> throws -> caught -> false
  });

  it('honors injected tx (if-branch)', async () => {
    push([{ id: 'p9' }]);
    const tx = makeTx();
    expect(await q.getAllProfiles(tx as never)).toHaveLength(1);
  });
});
