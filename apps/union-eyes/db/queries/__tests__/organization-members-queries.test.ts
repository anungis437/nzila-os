/**
 * Organization Members Queries — Unit Tests
 *
 * withRLSContext invokes the callback with a fake drizzle-style tx whose
 * builder chains resolve from a controllable queue (Errors reject).
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

import * as q from '../organization-members-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}

describe('organization-members-queries', () => {
  beforeEach(() => {
    mocks.queue = [];
    vi.clearAllMocks();
  });

  it('getOrganizationMembers returns members', async () => {
    push([{ id: 'm1' }, { id: 'm2' }]);
    expect(await q.getOrganizationMembers('org')).toHaveLength(2);
  });

  it('getMemberById returns first or undefined', async () => {
    push([{ id: 'm1' }]);
    expect(await q.getMemberById('org', 'm1')).toEqual({ id: 'm1' });
    push([]);
    expect(await q.getMemberById('org', 'x')).toBeUndefined();
  });

  it('getMemberByUserId returns first or undefined', async () => {
    push([{ id: 'm1', userId: 'u1' }]);
    expect(await q.getMemberByUserId('org', 'u1')).toEqual({ id: 'm1', userId: 'u1' });
    push([]);
    expect(await q.getMemberByUserId('org', 'u9')).toBeUndefined();
  });

  it('createMember returns created row / throws when none', async () => {
    push([{ id: 'm1' }]);
    expect(await q.createMember({ organizationId: 'org', userId: 'u1' } as never)).toEqual({ id: 'm1' });
    push([]);
    await expect(q.createMember({} as never)).rejects.toThrow('Failed to create member');
  });

  it('addOrganizationMember returns existing when present', async () => {
    push([{ id: 'existing', userId: 'u1' }]); // getMemberByUserId lookup
    const r = await q.addOrganizationMember({
      organizationId: 'org', userId: 'u1', role: 'member', name: 'A', email: 'a@b.c',
    });
    expect(r).toEqual({ id: 'existing', userId: 'u1' });
  });

  it('addOrganizationMember creates when not present (all option branches)', async () => {
    push([]); // getMemberByUserId lookup -> none
    push([{ id: 'new1' }]); // createMember returning
    const r = await q.addOrganizationMember({
      organizationId: 'org', userId: 'u1', role: 'admin', isPrimary: true, name: 'A', email: 'a@b.c', phone: '555',
    });
    expect(r).toEqual({ id: 'new1' });
  });

  it('updateMember returns updated row', async () => {
    push([{ id: 'm1', name: 'New' }]);
    expect(await q.updateMember('m1', { name: 'New' } as never)).toEqual({ id: 'm1', name: 'New' });
  });

  it('deleteMember returns true/false', async () => {
    push([{ id: 'm1' }]);
    expect(await q.deleteMember('m1')).toBe(true);
    push([]);
    expect(await q.deleteMember('m9')).toBe(false);
  });

  it('getMemberCount + getActiveMemberCount return counts (with fallback)', async () => {
    push([{ count: 12 }]);
    expect(await q.getMemberCount('org')).toBe(12);
    push([]);
    expect(await q.getMemberCount('org')).toBe(0);
    push([{ count: 8 }]);
    expect(await q.getActiveMemberCount('org')).toBe(8);
    push([]);
    expect(await q.getActiveMemberCount('org')).toBe(0);
  });

  it('getMembersByRole + getMembersByStatus return rows', async () => {
    push([{ id: 'm1' }]);
    expect(await q.getMembersByRole('org', 'steward')).toHaveLength(1);
    push([{ id: 'm2' }]);
    expect(await q.getMembersByStatus('org', 'active')).toHaveLength(1);
  });

  it('searchMembers: no query (orderBy createdAt path)', async () => {
    push([{ id: 'm1' }]);
    expect(await q.searchMembers('org', '')).toHaveLength(1);
  });

  it('searchMembers: with query + all filters (relevance order path)', async () => {
    push([{ id: 'm1' }]);
    const r = await q.searchMembers('org', 'john doe', {
      role: 'officer', status: 'active', department: 'logistics',
    });
    expect(r).toHaveLength(1);
  });

  it('honors injected tx (if-branch)', async () => {
    push([{ id: 'm9' }]);
    expect(await q.getOrganizationMembers('org', makeTx() as never)).toHaveLength(1);
  });
});
