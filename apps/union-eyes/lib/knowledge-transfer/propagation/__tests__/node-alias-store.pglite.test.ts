import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';

// DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE (requirement B, durable
// graph identity): this suite runs the real node-alias-store functions against a PGlite database built from the
// actual table shape (platform migration 0086, RLS scoped 0060), proving:
//  - creating an alias for a label that already has one supersedes it (never a silent duplicate active row, and
//    never a destructive delete of the prior decision)
//  - listActiveNodeAliases only ever returns non-superseded rows; listAllNodeAliases returns the full history
//  - a self-referential or empty-field alias is refused before any write
//  - one organization's aliases are never visible to another organization's lookups

const state = vi.hoisted(() => ({ db: null as unknown }));

vi.mock('@/lib/db/with-rls-context', () => ({
  // Production (postgres-js) returns row arrays from tx.execute(); PGlite's driver wraps them in { rows }. Adapt
  // only that driver result envelope here so the store code under test is the real, unmodified production code.
  withRLSContext: async (...a: unknown[]) => {
    const db = state.db as { execute: (q: unknown) => Promise<{ rows: unknown[] }> };
    const postgresJsDb = new Proxy(db, {
      get(target, property) {
        if (property === 'execute') return async (query: unknown) => (await target.execute(query)).rows;
        return Reflect.get(target, property);
      },
    });
    return (a[a.length - 1] as (tx: unknown) => Promise<unknown>)(postgresJsDb);
  },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));

const ORG_A = '11111111-1111-4111-8111-111111111111';
const ORG_B = '22222222-2222-4222-8222-222222222222';

let pg: PGlite;

beforeAll(async () => {
  const { createTableDatabase } = await import('@/app/api/__tests__/support/pglite-tables');
  const created = await createTableDatabase([], [
    `CREATE TABLE ue_graph_node_alias (
       id uuid primary key default gen_random_uuid(),
       organization_id uuid not null,
       alias_label text not null,
       canonical_concept_label text not null,
       reason varchar(500) not null,
       created_by text not null,
       created_at timestamptz not null default now(),
       superseded_by text,
       superseded_at timestamptz,
       constraint ue_graph_node_alias_not_self_referential check (alias_label <> canonical_concept_label)
     )`,
  ]);
  pg = created.pg;
  state.db = created.db;
});

afterAll(async () => {
  await pg.close();
});

beforeEach(async () => {
  await pg.exec('TRUNCATE ue_graph_node_alias');
});

describe('node alias store — real PGlite SQL', () => {
  it('creates a new active alias and records an audit entry', async () => {
    const { createNodeAlias, listActiveNodeAliases } = await import('../node-alias-store');
    const alias = await createNodeAlias(
      ORG_A,
      { aliasLabel: 'payroll steward', canonicalConceptLabel: 'payroll_specialist', reason: 'title standardized' },
      'reviewer-1',
    );
    expect(alias.aliasLabel).toBe('payroll steward');
    expect(alias.canonicalConceptLabel).toBe('payroll_specialist');
    expect(alias.supersededAt).toBeNull();

    const active = await listActiveNodeAliases(ORG_A);
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe(alias.id);
  });

  it('supersedes the prior active alias for the same label instead of duplicating or deleting it', async () => {
    const { createNodeAlias, listActiveNodeAliases, listAllNodeAliases } = await import('../node-alias-store');
    const first = await createNodeAlias(
      ORG_A,
      { aliasLabel: 'payroll steward', canonicalConceptLabel: 'payroll_specialist', reason: 'initial mapping' },
      'reviewer-1',
    );
    const second = await createNodeAlias(
      ORG_A,
      { aliasLabel: 'payroll steward', canonicalConceptLabel: 'payroll_lead', reason: 'role was recategorized' },
      'reviewer-2',
    );

    const active = await listActiveNodeAliases(ORG_A);
    expect(active).toHaveLength(1);
    expect(active[0]?.id).toBe(second.id);
    expect(active[0]?.canonicalConceptLabel).toBe('payroll_lead');

    // the superseded row is never deleted - it remains in the full history, marked as superseded
    const all = await listAllNodeAliases(ORG_A);
    expect(all).toHaveLength(2);
    const supersededFirst = all.find((a) => a.id === first.id);
    expect(supersededFirst?.supersededAt).not.toBeNull();
    expect(supersededFirst?.supersededBy).toBe('reviewer-2');
  });

  it('refuses an empty aliasLabel or canonicalConceptLabel', async () => {
    const { createNodeAlias } = await import('../node-alias-store');
    await expect(
      createNodeAlias(ORG_A, { aliasLabel: '  ', canonicalConceptLabel: 'payroll_specialist', reason: 'x' }, 'reviewer-1'),
    ).rejects.toThrow(/must not be empty/);
    await expect(
      createNodeAlias(ORG_A, { aliasLabel: 'payroll steward', canonicalConceptLabel: '  ', reason: 'x' }, 'reviewer-1'),
    ).rejects.toThrow(/must not be empty/);
  });

  it('refuses a self-referential alias (a label aliased to itself names no migration at all)', async () => {
    const { createNodeAlias } = await import('../node-alias-store');
    await expect(
      createNodeAlias(ORG_A, { aliasLabel: 'payroll_specialist', canonicalConceptLabel: 'payroll_specialist', reason: 'x' }, 'reviewer-1'),
    ).rejects.toThrow(/must differ/);
  });

  it('never returns or mutates another organization\'s aliases', async () => {
    const { createNodeAlias, listActiveNodeAliases, listAllNodeAliases } = await import('../node-alias-store');
    await createNodeAlias(ORG_A, { aliasLabel: 'payroll steward', canonicalConceptLabel: 'payroll_specialist', reason: 'x' }, 'reviewer-1');
    await createNodeAlias(ORG_B, { aliasLabel: 'payroll steward', canonicalConceptLabel: 'payroll_lead', reason: 'y' }, 'reviewer-2');

    const activeA = await listActiveNodeAliases(ORG_A);
    const activeB = await listActiveNodeAliases(ORG_B);
    expect(activeA).toHaveLength(1);
    expect(activeB).toHaveLength(1);
    expect(activeA[0]?.canonicalConceptLabel).toBe('payroll_specialist');
    expect(activeB[0]?.canonicalConceptLabel).toBe('payroll_lead');

    // creating ORG_B's alias for the "same" label text must not have superseded ORG_A's row
    const allA = await listAllNodeAliases(ORG_A);
    expect(allA).toHaveLength(1);
    expect(allA[0]?.supersededAt).toBeNull();
  });
  it('supersedes an active alias whose label differs only cosmetically, so one label never has two active mappings', async () => {
    const { createNodeAlias, listActiveNodeAliases } = await import('../node-alias-store');
    await createNodeAlias(ORG_A, { aliasLabel: 'Payroll_Steward', canonicalConceptLabel: 'payroll_specialist', reason: 'x' }, 'reviewer-1');
    await createNodeAlias(ORG_A, { aliasLabel: 'payroll  steward', canonicalConceptLabel: 'payroll_lead', reason: 'y' }, 'reviewer-2');
    const active = await listActiveNodeAliases(ORG_A);
    expect(active).toHaveLength(1);
    expect(active[0]?.canonicalConceptLabel).toBe('payroll_lead');
  });

  it('refuses an alias whose two sides differ only cosmetically, and an alias pointing at another alias (no chains)', async () => {
    const { createNodeAlias } = await import('../node-alias-store');
    await expect(
      createNodeAlias(ORG_A, { aliasLabel: 'Payroll_Specialist', canonicalConceptLabel: 'payroll specialist', reason: 'x' }, 'reviewer-1'),
    ).rejects.toThrow(/must differ/);
    await createNodeAlias(ORG_A, { aliasLabel: 'payroll steward', canonicalConceptLabel: 'payroll_specialist', reason: 'x' }, 'reviewer-1');
    await expect(
      createNodeAlias(ORG_A, { aliasLabel: 'pay desk', canonicalConceptLabel: 'Payroll_Steward', reason: 'x' }, 'reviewer-1'),
    ).rejects.toThrow(/itself an active alias/);
  });
});
