/**
 * Organization Hierarchy — Semantic Integration Proof
 *
 * Issue: the repo contained two conflicting materialized-path conventions —
 * createOrganization() appends the PARENT's id (ancestors-only, self
 * excluded), while validatePathConsistency() previously expected the ORG's
 * OWN id to be appended (ancestors+self). Only one convention can be correct
 * because getOrganizationDescendants()/getOrganizationTree() rely on
 * `hierarchyPath @> ARRAY[ancestorId]` to find descendants.
 *
 * This test exercises the REAL createOrganization(), getOrganizationDescendants(),
 * getOrganizationAncestors(), and getOrganizationTree() against an in-memory
 * fake db that interprets eq/and/inArray/sql predicates for real (not a
 * canned response queue), so the assertions below are driven by what the
 * production code actually computes and actually queries for — not by a
 * hand-written expectation of what it "should" compute.
 *
 * This does not replace a live-Postgres test of the `@>` operator itself;
 * it proves the write-side (hierarchyPath shape) and read-side (containment
 * queries) agree on one convention, which is the gap that caused the drift.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({ rows: [] as Array<Record<string, unknown>> }));

vi.mock('@/db/schema-organizations', () => ({
  organizations: {
    id: 'id', parentId: 'parentId', hierarchyPath: 'hierarchyPath', hierarchyLevel: 'hierarchyLevel',
    organizationType: 'organizationType', status: 'status', name: 'name', slug: 'slug', clcAffiliated: 'clcAffiliated',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Minimal predicate interpreter: real eq()/and()/inArray() results are opaque
// drizzle SQL objects, so for this test only, drizzle-orm's predicate builders
// are replaced with plain descriptors this in-memory "db" can evaluate.
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return {
    ...actual,
    eq: (col: string, val: unknown) => (row: Record<string, unknown>) => row[col] === val,
    and: (...preds: Array<(row: Record<string, unknown>) => boolean>) => (row: Record<string, unknown>) => preds.every((p) => p(row)),
    or: (...preds: Array<(row: Record<string, unknown>) => boolean>) => (row: Record<string, unknown>) => preds.some((p) => p(row)),
    isNull: (col: string) => (row: Record<string, unknown>) => row[col] == null,
    inArray: (col: string, vals: unknown[]) => (row: Record<string, unknown>) => vals.includes(row[col]),
    ne: (col: string, val: unknown) => (row: Record<string, unknown>) => row[col] !== val,
    asc: (col: string) => ({ __order: col, dir: 'asc' as const }),
    desc: (col: string) => ({ __order: col, dir: 'desc' as const }),
    // sql`${organizations.hierarchyPath} @> ARRAY[${ancestorId}]::uuid[]` and
    // sql`${organizations.id} != ${ancestorId}` are the only two tagged-template
    // shapes used by the functions under test.
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => {
      const joined = strings.join('~');
      if (joined.includes('@>')) {
        const [col, ancestorId] = values as [string, string];
        return (row: Record<string, unknown>) => ((row[col] as string[]) ?? []).includes(ancestorId);
      }
      if (joined.includes('!=')) {
        const [col, val] = values as [string, unknown];
        return (row: Record<string, unknown>) => row[col] !== val;
      }
      throw new Error(`Unsupported sql template in test interpreter: ${joined}`);
    },
  };
});

function evaluate(rows: Array<Record<string, unknown>>, predicate: unknown, order?: { __order: string; dir: 'asc' | 'desc' }) {
  const pred = predicate as ((row: Record<string, unknown>) => boolean) | undefined;
  let result = pred ? rows.filter(pred) : [...rows];
  if (order) {
    result = [...result].sort((a, b) => {
      const av = a[order.__order] as number, bv = b[order.__order] as number;
      return order.dir === 'asc' ? av - bv : bv - av;
    });
  }
  return result;
}

function makeTx() {
  return {
    select: (_proj?: unknown) => {
      let wherePred: unknown;
      let orderBy: unknown;
      let limitN: number | undefined;
      const chain = {
        from: () => chain,
        where: (p: unknown) => { wherePred = p; return chain; },
        orderBy: (o: unknown) => { orderBy = o; return chain; },
        limit: (n: number) => { limitN = n; return chain; },
        then: (resolve: (v: unknown) => unknown) => {
          let result = evaluate(mocks.rows, wherePred, orderBy as { __order: string; dir: 'asc' | 'desc' } | undefined);
          if (limitN !== undefined) result = result.slice(0, limitN);
          return Promise.resolve(result).then(resolve);
        },
      };
      return chain;
    },
    insert: () => {
      let values: Record<string, unknown>;
      const chain = {
        values: (v: Record<string, unknown>) => { values = v; return chain; },
        returning: async () => {
          const row = { id: `generated-${mocks.rows.length + 1}`, ...values };
          mocks.rows.push(row);
          return [row];
        },
      };
      return chain;
    },
  };
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (op: (tx: unknown) => Promise<unknown>) => op(makeTx()),
}));

import { createOrganization, getOrganizationDescendants, getOrganizationAncestors, getOrganizationTree } from '../organization-queries';

beforeEach(() => {
  mocks.rows = [];
});

describe('organization hierarchy — semantic integration proof (ancestors-only convention)', () => {
  it('createOrganization produces ancestors-only hierarchyPath at every level of a 3-level tree', async () => {
    const root = await createOrganization({ name: 'Root', slug: 'root', organizationType: 'congress' } as never);
    expect(root.hierarchyPath).toEqual([]);
    expect(root.hierarchyLevel).toBe(0);

    const mid = await createOrganization({ name: 'Mid', slug: 'mid', organizationType: 'federation', parentId: root.id } as never);
    expect(mid.hierarchyPath).toEqual([root.id]);
    expect(mid.hierarchyLevel).toBe(1);

    const leaf = await createOrganization({ name: 'Leaf', slug: 'leaf', organizationType: 'local', parentId: mid.id } as never);
    expect(leaf.hierarchyPath).toEqual([root.id, mid.id]);
    expect(leaf.hierarchyLevel).toBe(2);
  });

  it('getOrganizationDescendants finds all descendants of the root and only leaf-level descendants of mid', async () => {
    const root = await createOrganization({ name: 'Root', slug: 'root', organizationType: 'congress' } as never);
    const mid = await createOrganization({ name: 'Mid', slug: 'mid', organizationType: 'federation', parentId: root.id } as never);
    const leaf = await createOrganization({ name: 'Leaf', slug: 'leaf', organizationType: 'local', parentId: mid.id } as never);
    // Give every row an active status so the descendants query's default filter includes them.
    for (const row of mocks.rows) row.status = 'active';

    const rootDescendants = await getOrganizationDescendants(root.id as string);
    expect(rootDescendants.map((r) => r.id).sort()).toEqual([leaf.id, mid.id].sort());

    const midDescendants = await getOrganizationDescendants(mid.id as string);
    expect(midDescendants.map((r) => r.id)).toEqual([leaf.id]);

    const leafDescendants = await getOrganizationDescendants(leaf.id as string);
    expect(leafDescendants).toEqual([]);
  });

  it('getOrganizationAncestors resolves root and mid, in root-to-parent order, for the leaf organization', async () => {
    const root = await createOrganization({ name: 'Root', slug: 'root', organizationType: 'congress' } as never);
    const mid = await createOrganization({ name: 'Mid', slug: 'mid', organizationType: 'federation', parentId: root.id } as never);
    const leaf = await createOrganization({ name: 'Leaf', slug: 'leaf', organizationType: 'local', parentId: mid.id } as never);

    const ancestors = await getOrganizationAncestors(leaf.id as string);
    expect(ancestors.map((r) => r.id)).toEqual([root.id, mid.id]);
  });

  it('getOrganizationTree with a root scoped to mid returns mid + leaf, not the top-level root', async () => {
    const root = await createOrganization({ name: 'Root', slug: 'root', organizationType: 'congress' } as never);
    const mid = await createOrganization({ name: 'Mid', slug: 'mid', organizationType: 'federation', parentId: root.id } as never);
    const leaf = await createOrganization({ name: 'Leaf', slug: 'leaf', organizationType: 'local', parentId: mid.id } as never);
    for (const row of mocks.rows) row.status = 'active';

    const subtree = await getOrganizationTree(mid.id as string);
    expect(subtree.map((r) => r.id).sort()).toEqual([leaf.id, mid.id].sort());
    expect(subtree.map((r) => r.id)).not.toContain(root.id);
  });
});
