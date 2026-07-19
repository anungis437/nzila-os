/**
 * Organization Queries — Unit Tests
 *
 * withRLSContext + drizzle-builder queue mock. Chain supports the builder
 * methods used here (select/from/where/orderBy/limit/innerJoin/insert/update/
 * values/set/returning) plus `tx.execute` (for the raw RLS-function query).
 * chain.then resolves queue.shift() (Error => reject). Several mutating
 * functions call sibling query functions with the SAME tx, so pushes are
 * ordered to match the sequential await order.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ queue: [] as unknown[] }));

function shift() {
  return mocks.queue.length ? mocks.queue.shift() : [];
}
function makeChain() {
  const chain: Record<string, unknown> = {};
  for (const m of [
    'from',
    'where',
    'orderBy',
    'limit',
    'innerJoin',
    'leftJoin',
    'values',
    'set',
    'returning',
    '$dynamic',
    'offset',
  ]) {
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
    execute: async () => {
      const v = shift();
      if (v instanceof Error) throw v;
      return v;
    },
  };
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (op: (tx: unknown) => Promise<unknown>) => op(makeTx()),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as q from '../organization-queries';

function push(...rows: unknown[]) {
  mocks.queue.push(...rows);
}

beforeEach(() => {
  mocks.queue = [];
  vi.clearAllMocks();
});

describe('organization-queries — single org lookups', () => {
  it('getOrganizationById returns row or null', async () => {
    push([{ id: 'o1' }]);
    expect(await q.getOrganizationById('o1')).toEqual({ id: 'o1' });
    push([]);
    expect(await q.getOrganizationById('missing')).toBeNull();
  });
  it('getOrganizationById rethrows on error', async () => {
    push(new Error('x'));
    await expect(q.getOrganizationById('o1')).rejects.toThrow('Failed to fetch organization with ID');
  });

  it('getOrganizationBySlug returns row or null', async () => {
    push([{ id: 'o1', slug: 's' }]);
    expect(await q.getOrganizationBySlug('s')).toEqual({ id: 'o1', slug: 's' });
    push([]);
    expect(await q.getOrganizationBySlug('missing')).toBeNull();
  });

  it('getOrganizationWithParent attaches parent when parentId set', async () => {
    push([{ id: 'o1', parentId: 'p1' }], [{ id: 'p1' }]);
    expect(await q.getOrganizationWithParent('o1')).toEqual({
      id: 'o1',
      parentId: 'p1',
      parent: { id: 'p1' },
    });
  });
  it('getOrganizationWithParent returns org without parent', async () => {
    push([{ id: 'o1', parentId: null }]);
    expect(await q.getOrganizationWithParent('o1')).toEqual({ id: 'o1', parentId: null });
  });
  it('getOrganizationWithParent returns null when not found', async () => {
    push([]);
    expect(await q.getOrganizationWithParent('missing')).toBeNull();
  });
});

describe('organization-queries — hierarchy lists', () => {
  it('getOrganizations for a parent including inactive', async () => {
    push([{ id: 'c1' }]);
    expect(await q.getOrganizations('p1', true)).toHaveLength(1);
  });
  it('getOrganizations for roots (active only)', async () => {
    push([{ id: 'r1' }]);
    expect(await q.getOrganizations()).toHaveLength(1);
  });

  it('getOrganizationChildren active and including inactive', async () => {
    push([{ id: 'c1' }]);
    expect(await q.getOrganizationChildren('p1')).toHaveLength(1);
    push([{ id: 'c1' }, { id: 'c2' }]);
    expect(await q.getOrganizationChildren('p1', true)).toHaveLength(2);
  });

  it('getOrganizationDescendants active and including inactive', async () => {
    push([{ id: 'd1' }]);
    expect(await q.getOrganizationDescendants('a1')).toHaveLength(1);
    push([{ id: 'd1' }]);
    expect(await q.getOrganizationDescendants('a1', true)).toHaveLength(1);
  });

  it('getOrganizationAncestors found by slug with hierarchy path', async () => {
    push([{ id: 'o1', slug: 's', hierarchyPath: ['root', 'parent'] }], [{ id: 'root' }, { id: 'parent' }]);
    expect(await q.getOrganizationAncestors('s')).toHaveLength(2);
  });
  it('getOrganizationAncestors found by id (slug miss)', async () => {
    push([], [{ id: 'o1', hierarchyPath: ['root'] }], [{ id: 'root' }]);
    expect(await q.getOrganizationAncestors('o1')).toHaveLength(1);
  });
  it('getOrganizationAncestors not found returns empty', async () => {
    push([], []);
    expect(await q.getOrganizationAncestors('missing')).toEqual([]);
  });
  it('getOrganizationAncestors with no hierarchy path returns empty', async () => {
    push([{ id: 'o1', slug: 's', hierarchyPath: [] }]);
    expect(await q.getOrganizationAncestors('s')).toEqual([]);
  });

  it('getOrganizationTree full tree (no root/depth)', async () => {
    push([{ id: 'o1' }]);
    expect(await q.getOrganizationTree()).toHaveLength(1);
  });
  it('getOrganizationTree subtree with rootId and maxDepth', async () => {
    push([{ id: 'root', hierarchyLevel: 1 }], [{ id: 'root' }, { id: 'child' }]);
    expect(await q.getOrganizationTree('root', 2)).toHaveLength(2);
  });
  it('getOrganizationTree with maxDepth from absolute root', async () => {
    push([{ id: 'o1' }]);
    expect(await q.getOrganizationTree(undefined, 1)).toHaveLength(1);
  });

  it('getUserVisibleOrganizations executes the RLS function query', async () => {
    push([{ id: 'o1' }, { id: 'o2' }]);
    expect(await q.getUserVisibleOrganizations('u1')).toHaveLength(2);
  });

  it('getUserPrimaryOrganization returns joined org or null', async () => {
    push([{ organization: { id: 'o1' } }]);
    expect(await q.getUserPrimaryOrganization('u1')).toEqual({ id: 'o1' });
    push([]);
    expect(await q.getUserPrimaryOrganization('u1')).toBeNull();
  });
});

describe('organization-queries — search & filters', () => {
  it('searchOrganizations returns matches', async () => {
    push([{ id: 'o1' }]);
    expect(await q.searchOrganizations('cupe', 5)).toHaveLength(1);
  });
  it('getOrganizationsByType with and without parent filter', async () => {
    push([{ id: 'o1' }]);
    expect(await q.getOrganizationsByType('union', 'p1')).toHaveLength(1);
    push([{ id: 'o1' }]);
    expect(await q.getOrganizationsByType('local')).toHaveLength(1);
  });
  it('getCLCAffiliatedOrganizations excluding and including root', async () => {
    push([{ id: 'o1' }]);
    expect(await q.getCLCAffiliatedOrganizations()).toHaveLength(1);
    push([{ id: 'o1' }]);
    expect(await q.getCLCAffiliatedOrganizations(true)).toHaveLength(1);
  });
});

describe('organization-queries — mutations', () => {
  it('createOrganization without parent inserts at root', async () => {
    push([{ id: 'new', name: 'Root' }]);
    expect(await q.createOrganization({ name: 'Root', organizationType: 'congress' } as never)).toEqual({
      id: 'new',
      name: 'Root',
    });
  });
  it('createOrganization with valid parent computes hierarchy', async () => {
    push(
      [{ id: 'p1', hierarchyPath: [], hierarchyLevel: 0, organizationType: 'union' }],
      [{ id: 'new', name: 'Local' }],
    );
    const r = await q.createOrganization({
      name: 'Local',
      organizationType: 'local',
      parentId: 'p1',
    } as never);
    expect(r).toEqual({ id: 'new', name: 'Local' });
  });
  it('createOrganization throws when parent not found', async () => {
    push([]);
    await expect(
      q.createOrganization({ name: 'X', organizationType: 'local', parentId: 'missing' } as never),
    ).rejects.toThrow('Failed to create organization');
  });
  it('createOrganization throws on invalid hierarchy', async () => {
    push([{ id: 'p1', hierarchyPath: [], hierarchyLevel: 0, organizationType: 'local' }]);
    await expect(
      q.createOrganization({ name: 'X', organizationType: 'congress', parentId: 'p1' } as never),
    ).rejects.toThrow('Failed to create organization');
  });

  it('updateOrganization without parent change', async () => {
    push([{ id: 'o1', name: 'New' }]);
    expect(await q.updateOrganization('o1', { name: 'New' } as never)).toEqual({
      id: 'o1',
      name: 'New',
    });
  });
  it('updateOrganization changing to a valid new parent', async () => {
    push(
      [{ id: 'o1', parentId: 'old', organizationType: 'local' }],
      [{ id: 'p2', hierarchyPath: [], hierarchyLevel: 0, organizationType: 'union' }],
      [{ id: 'o1', name: 'Moved' }],
    );
    const r = await q.updateOrganization('o1', { parentId: 'p2' } as never);
    expect(r).toEqual({ id: 'o1', name: 'Moved' });
  });
  it('updateOrganization rejects self-parenting', async () => {
    push([{ id: 'o1', parentId: 'old' }]);
    await expect(q.updateOrganization('o1', { parentId: 'o1' } as never)).rejects.toThrow(
      'Failed to update organization',
    );
  });
  it('updateOrganization throws when target not found', async () => {
    push([]);
    await expect(q.updateOrganization('missing', { name: 'X' } as never)).rejects.toThrow(
      'Failed to update organization',
    );
  });

  it('deleteOrganization archives when no active children', async () => {
    push([], [{ id: 'o1', name: 'Old' }]);
    expect(await q.deleteOrganization('o1')).toEqual({ id: 'o1', name: 'Old' });
  });
  it('deleteOrganization throws when it has active children', async () => {
    push([{ id: 'c1' }]);
    await expect(q.deleteOrganization('o1')).rejects.toThrow('Failed to delete organization');
  });
});

describe('organization-queries — relationships & stats', () => {
  it('createOrganizationRelationship returns the created row', async () => {
    push([{ parentOrgId: 'p1', childOrgId: 'c1', relationshipType: 'affiliation' }]);
    const r = await q.createOrganizationRelationship({ parentOrgId: 'p1', childOrgId: 'c1' } as never);
    expect(r.relationshipType).toBe('affiliation');
  });
  it('getOrganizationRelationships as parent and as child', async () => {
    push([{ id: 'rel1' }]);
    expect(await q.getOrganizationRelationships('o1')).toHaveLength(1);
    push([{ id: 'rel2' }]);
    expect(await q.getOrganizationRelationships('o1', false)).toHaveLength(1);
  });

  it('getOrganizationMemberStats without descendants', async () => {
    push([{ memberCount: 5, activeMemberCount: 3 }]);
    expect(await q.getOrganizationMemberStats('o1', false)).toEqual({
      totalMembers: 5,
      activeMembers: 3,
      descendantOrgs: 0,
    });
  });
  it('getOrganizationMemberStats including descendants', async () => {
    push([{ memberCount: 10, activeMemberCount: 8 }], [{ memberCount: 4, activeMemberCount: 2 }]);
    const r = await q.getOrganizationMemberStats('o1');
    expect(r.totalMembers).toBe(14);
    expect(r.activeMembers).toBe(10);
    expect(r.descendantOrgs).toBe(1);
  });
  it('getOrganizationMemberStats throws when org not found', async () => {
    push([], []);
    await expect(q.getOrganizationMemberStats('missing')).rejects.toThrow(
      'Failed to fetch member stats',
    );
  });
});
