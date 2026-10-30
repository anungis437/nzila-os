import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { sql, type SQL } from 'drizzle-orm';

// R-44 class: a minimum role is eligibility, never authority over a specific row. These tests drive the real factory over
// tables that carry no organization column, which the factory used to serve to every tenant without saying so.
const captured = vi.hoisted(() => ({
  handlers: new Map<string, (ctx: Record<string, unknown>) => Promise<unknown>>(),
  wheres: [] as unknown[],
  sets: [] as Array<Record<string, unknown>>,
  inserts: [] as Array<Record<string, unknown>>,
  parentRows: [] as unknown[],
}));

vi.mock('../with-api', () => ({
  withApi: (config: { openapi: { summary: string } }, handler: (ctx: Record<string, unknown>) => Promise<unknown>) => {
    captured.handlers.set(config.openapi.summary.split(' ')[0], handler);
    return vi.fn();
  },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }));
vi.mock('@/lib/organization-utils', () => ({ getUserRoleInOrganization: vi.fn().mockResolvedValue('steward') }));

vi.mock('@/db/db', () => ({
  db: {
    select: (fields?: Record<string, unknown>) => {
      // The parent-ownership subquery: rendered as real SQL so the test can read it back.
      if (fields && 'key' in fields) return { from: (parent: unknown) => ({ where: (clause: unknown) => sql`(select ${fields.key} from ${parent} where ${clause})` }) };
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = (clause: unknown) => { captured.wheres.push(clause); return chain; };
      chain.orderBy = () => chain;
      chain.limit = () => chain;
      chain.offset = () => Promise.resolve([]);
      chain.then = (resolve: (value: unknown[]) => unknown) => resolve([{ total: 0 }]);
      return chain;
    },
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_ctx: unknown, operation: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ limit: () => Promise.resolve(captured.parentRows) }) }) }),
      insert: () => ({ values: (values: Record<string, unknown>) => { captured.inserts.push(values); return { returning: () => Promise.resolve([{ id: 'new', ...values }]) }; } }),
      update: () => ({ set: (values: Record<string, unknown>) => { captured.sets.push(values); return { where: (clause: unknown) => { captured.wheres.push(clause); return { returning: () => Promise.resolve([{ id: 'row' }]) }; } }; } }),
    };
    tx.delete = () => ({ where: (clause: unknown) => { captured.wheres.push(clause); return { returning: () => Promise.resolve([{ id: 'row' }]) }; } });
    return operation(tx);
  },
}));

// The governance class is decided by table name; this one is an ordinary operational record.
const negotiations = pgTable('negotiations', { id: uuid('id').primaryKey(), organizationId: uuid('organization_id').notNull() });
const proposals = pgTable('bargaining_proposals', {
  id: uuid('id').primaryKey(),
  negotiationId: uuid('negotiation_id').notNull(),
  title: text('title'),
});
const ORG = '11111111-1111-4111-8111-111111111111';
const FOREIGN_NEGOTIATION = '22222222-2222-4222-8222-222222222222';
const ctx = (extra: Record<string, unknown> = {}) => ({ organizationId: ORG, userId: 'user-1', params: { id: 'row' }, request: new Request('http://localhost/api/x'), ...extra });
const render = (clause: unknown) => new PgDialect().sqlToQuery(clause as SQL);

async function factory() {
  captured.handlers.clear();
  const { crudRoutes } = await import('../crud-factory');
  return crudRoutes;
}

describe('crud-factory refuses to lose its scope silently', () => {
  beforeEach(() => {
    vi.resetModules();
    captured.wheres.length = 0;
    captured.sets.length = 0;
    captured.inserts.length = 0;
    captured.parentRows = [];
  });

  it('will not mount an org-scoped route over a table with no organization column', async () => {
    const crudRoutes = await factory();
    expect(() => crudRoutes({ table: proposals, tags: ['t'], orgScoped: true })).toThrow(/no organizationId column/);
  });

  it('accepts an explicit, reasoned exemption or an explicit non-scoped route', async () => {
    const crudRoutes = await factory();
    expect(() => crudRoutes({ table: proposals, tags: ['t'], orgScoped: true, unscopedByDesign: 'shared reference data' })).not.toThrow();
    expect(() => crudRoutes({ table: proposals, tags: ['t'], orgScoped: false })).not.toThrow();
  });

  it('will not mount a route whose owner column does not exist', async () => {
    const crudRoutes = await factory();
    expect(() => crudRoutes({ table: proposals, tags: ['t'], orgScoped: false, ownerColumn: 'workerId' })).toThrow(/ownerColumn "workerId"/);
  });

  it('will not mount a parent scope that names a missing column', async () => {
    const crudRoutes = await factory();
    expect(() => crudRoutes({ table: proposals, tags: ['t'], parentScope: { column: 'nope', parent: negotiations } })).toThrow(/parentScope/);
    expect(() => crudRoutes({ table: proposals, tags: ['t'], parentScope: { column: 'negotiationId', parent: negotiations, parentOrgColumn: 'nope' } })).toThrow(/parentScope/);
  });
});

describe('crud-factory parent scope (rows owned through a parent)', () => {
  beforeEach(() => {
    vi.resetModules();
    captured.wheres.length = 0;
    captured.sets.length = 0;
    captured.inserts.length = 0;
    captured.parentRows = [];
  });
  const options = { table: proposals, tags: ['t'], orgScoped: true, parentScope: { column: 'negotiationId', parent: negotiations } } as const;

  it('limits a list to rows whose parent belongs to the caller organization', async () => {
    const crudRoutes = await factory();
    crudRoutes(options);
    await captured.handlers.get('List')!(ctx());
    const rendered = render(captured.wheres[0]);
    expect(rendered.sql).toMatch(/"negotiation_id" in \(select "negotiations"\."id" from "negotiations" where "negotiations"\."organization_id" = \$\d\)/);
    expect(rendered.params).toContain(ORG);
  });

  it('limits read, update and delete of one row the same way', async () => {
    const crudRoutes = await factory();
    crudRoutes({ ...options, itemRoute: true });
    for (const verb of ['Get', 'Update', 'Delete']) {
      captured.wheres.length = 0;
      await captured.handlers.get(verb)!(ctx({ body: { title: 'x' } }));
      expect(captured.wheres, `${verb} must include a scoped WHERE predicate`).not.toHaveLength(0);
      expect(render(captured.wheres[0]).sql, verb).toContain('"negotiations"."organization_id"');
      expect(render(captured.wheres[0]).params, verb).toContain(ORG);
    }
  });

  it('refuses a create that names a negotiation of another organization, and writes nothing', async () => {
    const crudRoutes = await factory();
    crudRoutes(options);
    captured.parentRows = [];
    await expect(captured.handlers.get('Create')!(ctx({ body: { negotiationId: FOREIGN_NEGOTIATION, title: 'x' } }))).rejects.toMatchObject({ message: 'Insufficient permissions' });
    expect(captured.inserts).toEqual([]);
  });

  it('refuses a create that names no parent at all', async () => {
    const crudRoutes = await factory();
    crudRoutes(options);
    captured.parentRows = [{ key: 'n' }];
    await expect(captured.handlers.get('Create')!(ctx({ body: { title: 'x' } }))).rejects.toMatchObject({ message: 'Insufficient permissions' });
    expect(captured.inserts).toEqual([]);
  });

  it('creates when the parent belongs to the caller organization', async () => {
    const crudRoutes = await factory();
    crudRoutes(options);
    captured.parentRows = [{ key: FOREIGN_NEGOTIATION }];
    await captured.handlers.get('Create')!(ctx({ body: { negotiationId: FOREIGN_NEGOTIATION, title: 'x' } }));
    expect(captured.inserts).toHaveLength(1);
  });

  it('does not let an update move a row under a different parent', async () => {
    const crudRoutes = await factory();
    crudRoutes({ ...options, itemRoute: true });
    await expect(captured.handlers.get('Update')!(ctx({ body: { title: 'renamed', negotiationId: FOREIGN_NEGOTIATION } })))
      .rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(captured.sets).toHaveLength(0);
    // Valid amendments remain possible without permitting parent reassignment.
    await captured.handlers.get('Update')!(ctx({ body: { title: 'renamed' } }));
    expect(captured.sets).toHaveLength(1);
    expect(captured.sets[0]).toMatchObject({ title: 'renamed' });
    expect(captured.sets[0]).not.toHaveProperty('negotiationId');
  });
  it('refuses a collection read without a resolved organizational context before querying', async () => {
    const crudRoutes = await factory();
    crudRoutes(options);
    await expect(captured.handlers.get('List')!(ctx({ organizationId: null }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(captured.wheres).toHaveLength(0);
  });

  it('refuses a direct organization-scoped item read without an organization', async () => {
    const crudRoutes = await factory();
    const directlyScoped = pgTable('scoped_proposals', { id: uuid('id').primaryKey(), organizationId: uuid('organization_id').notNull() });
    crudRoutes({ table: directlyScoped, tags: ['t'], orgScoped: true, itemRoute: true });
    await expect(captured.handlers.get('Get')!(ctx({ organizationId: null }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(captured.wheres).toHaveLength(0);
  });

  it('refuses an owner-scoped read with no authenticated subject', async () => {
    const crudRoutes = await factory();
    const owned = pgTable('owned_proposals', { id: uuid('id').primaryKey(), createdBy: text('created_by') });
    crudRoutes({ table: owned, tags: ['t'], orgScoped: false, ownerColumn: 'createdBy', itemRoute: true });
    await expect(captured.handlers.get('Get')!(ctx({ userId: null }))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(captured.wheres).toHaveLength(0);
  });

});
