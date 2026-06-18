/**
 * Users Queries — Unit Tests
 *
 * withRLSContext + drizzle-builder queue mock. Both functions wrap a try/catch
 * that returns null on error (no throw), so error paths assert null.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ queue: [] as unknown[] }));

function shift() {
  return mocks.queue.length ? mocks.queue.shift() : [];
}
function makeChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ['from', 'where', 'limit']) {
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
  return { select: () => makeChain() };
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (op: (tx: unknown) => Promise<unknown>) => op(makeTx()),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as q from '../users-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}

beforeEach(() => {
  mocks.queue = [];
  vi.clearAllMocks();
});

describe('users-queries', () => {
  it('getUserByEmail returns the user', async () => {
    push([{ id: 'u1', email: 'a@b.com' }]);
    expect(await q.getUserByEmail('a@b.com')).toEqual({ id: 'u1', email: 'a@b.com' });
  });
  it('getUserByEmail returns null when not found', async () => {
    push([]);
    expect(await q.getUserByEmail('missing@b.com')).toBeNull();
  });
  it('getUserByEmail returns null on error', async () => {
    push(new Error('db'));
    expect(await q.getUserByEmail('a@b.com')).toBeNull();
  });

  it('getUserById returns the user', async () => {
    push([{ id: 'u1', userId: 'uuid' }]);
    expect(await q.getUserById('uuid')).toEqual({ id: 'u1', userId: 'uuid' });
  });
  it('getUserById returns null when not found', async () => {
    push([]);
    expect(await q.getUserById('missing')).toBeNull();
  });
  it('getUserById returns null on error', async () => {
    push(new Error('db'));
    expect(await q.getUserById('uuid')).toBeNull();
  });
});
