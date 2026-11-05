import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect, boolean, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import { eq, type SQL } from 'drizzle-orm';

// F07: an owner-scoped read hid every member's record from the staff who administer them, and a draft or archived row
// was served to any member. staffReadsAll and belowStaffReadCondition scope GET by the caller's role without touching writes.
const state = vi.hoisted(() => ({
  handlers: new Map<string, (ctx: Record<string, unknown>) => Promise<unknown>>(),
  wheres: [] as unknown[],
  role: 'member',
}));

vi.mock('../with-api', () => ({
  withApi: (config: { openapi: { summary: string } }, handler: (ctx: Record<string, unknown>) => Promise<unknown>) => {
    state.handlers.set(config.openapi.summary.split(' ')[0], handler);
    return vi.fn();
  },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }));
vi.mock('@/lib/organization-utils', () => ({ getUserRoleInOrganization: vi.fn(async () => state.role) }));
vi.mock('@/db/db', () => ({
  db: {
    select: () => {
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = (clause: unknown) => { state.wheres.push(clause); return chain; };
      chain.orderBy = () => chain;
      chain.limit = () => chain;
      chain.offset = () => Promise.resolve([]);
      chain.then = (resolve: (value: unknown[]) => unknown) => resolve([{ total: 0 }]);
      return chain;
    },
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: (_c: unknown, op: (tx: unknown) => Promise<unknown>) => op({}) }));

const courses = pgTable('training_courses', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  memberId: text('member_id'),
  isActive: boolean('is_active'),
});
const ORG = '11111111-1111-4111-8111-111111111111';
const ctx = () => ({ organizationId: ORG, userId: 'user-1', params: { id: 'row' }, request: new Request('http://localhost/api/x') });
const sqlOf = (clause: unknown) => new PgDialect().sqlToQuery(clause as SQL).sql;

async function listWith(options: Record<string, unknown>) {
  state.handlers.clear();
  const { crudRoutes } = await import('../crud-factory');
  crudRoutes({ table: courses, tags: ['t'], orgScoped: true, ...options });
  await state.handlers.get('List')!(ctx());
  return state.wheres.map(sqlOf).join(' | ');
}

describe('crud-factory role-dependent read scope', () => {
  beforeEach(() => {
    vi.resetModules();
    state.wheres.length = 0;
    state.role = 'member';
  });

  it('keeps a member to their own rows', async () => {
    expect(await listWith({ ownerColumn: 'memberId', staffReadsAll: true })).toContain('"member_id"');
  });

  it('lets a steward read every member row when staffReadsAll is declared', async () => {
    state.role = 'steward';
    expect(await listWith({ ownerColumn: 'memberId', staffReadsAll: true })).not.toContain('"member_id"');
  });

  it('keeps the owner scope for a steward when staffReadsAll is not declared', async () => {
    state.role = 'steward';
    expect(await listWith({ ownerColumn: 'memberId' })).toContain('"member_id"');
  });

  // DEF-0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT
  it('applies readCondition to every caller, staff included', async () => {
    const condition = eq(courses.isActive, true);
    expect(await listWith({ readCondition: condition })).toContain('"is_active"');
    state.wheres.length = 0;
    state.role = 'steward';
    expect(await listWith({ readCondition: condition, staffReadsAll: true })).toContain('"is_active"');
  });

  it('applies belowStaffReadCondition to a member and not to a steward', async () => {
    const condition = eq(courses.isActive, true);
    expect(await listWith({ belowStaffReadCondition: condition })).toContain('"is_active"');
    state.wheres.length = 0;
    state.role = 'steward';
    expect(await listWith({ belowStaffReadCondition: condition })).not.toContain('"is_active"');
  });
});
