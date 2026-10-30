import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const m = vi.hoisted(() => ({
  members: [] as Array<{ id: string }>,
  reports: [] as Array<{ id: string }>,
  updated: [] as Array<{ id: string }>,
  predicates: [] as unknown[],
  updateCount: 0,
  audit: vi.fn(),
  scopes: [] as unknown[],
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_options: unknown, handler: unknown) => handler,
  ApiError: {
    forbidden: (msg: string) => Object.assign(new Error(msg), { code: 'FORBIDDEN' }),
    notFound: (msg: string) => Object.assign(new Error(msg), { code: 'NOT_FOUND' }),
  },
}));
vi.mock('@/db/schema', async () => {
  const { pgTable, uuid, text } = await import('drizzle-orm/pg-core');
  return {
    memberBreaks: pgTable('member_breaks', {
      id: uuid('id').primaryKey(),
      organizationId: uuid('organization_id').notNull(),
      memberId: uuid('member_id').notNull(),
      status: text('status'),
    }),
    organizationMembers: pgTable('organization_members', {
      id: uuid('id').primaryKey(),
      organizationId: uuid('organization_id').notNull(),
      userId: text('user_id').notNull(),
      status: text('status'),
    }),
  };
});
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: (...args: unknown[]) => m.audit(...args),
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (scope: unknown, cb: (tx: unknown) => Promise<unknown>) => {
    m.scopes.push(scope);
    let selects = 0;
    const tx = {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => (++selects === 1 ? m.members : m.reports),
          }),
        }),
      }),
      update: () => ({
        set: () => ({
          where: (predicate: unknown) => {
            m.predicates.push(predicate);
            return { returning: async () => {
              m.updateCount++;
              return m.updated;
            } };
          },
        }),
      }),
    };
    return cb(tx);
  },
}));

const org = '11111111-1111-4111-8111-111111111111';
const report = '22222222-2222-4222-8222-222222222222';
const member = '33333333-3333-4333-8333-333333333333';
const ctx = { organizationId: org, userId: 'member-user', params: { id: report }, body: { notes: 'corrected' } };

describe('break self-report item mutation boundary', () => {
  beforeEach(() => {
    m.members = [{ id: member }];
    m.reports = [{ id: report }];
    m.updated = [{ id: report }];
    m.predicates.length = 0;
    m.scopes.length = 0;
    m.updateCount = 0;
    m.audit.mockReset().mockResolvedValue(undefined);
  });

  it('puts report id, authenticated organization and authenticated member into the UPDATE predicate', async () => {
    const { PATCH } = await import('../breaks/[id]/route');
    await (PATCH as Function)(ctx);
    const query = new PgDialect().sqlToQuery(m.predicates[0] as SQL);
    expect(query.sql).toContain('"member_breaks"."organization_id"');
    expect(query.sql).toContain('"member_breaks"."member_id"');
    expect(query.sql).toContain('"member_breaks"."id"');
    expect(query.params).toEqual(expect.arrayContaining([org, member, report]));
    expect(m.scopes).toEqual([{ organizationId: org, userId: 'member-user' }]);
    expect(m.updateCount).toBe(1);
    expect(m.audit).toHaveBeenCalledOnce();
  });

  it('rejects an inactive or missing membership before touching the report or audit', async () => {
    m.members = [];
    const { PATCH } = await import('../breaks/[id]/route');
    await expect((PATCH as Function)(ctx)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(m.updateCount).toBe(0);
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('does not update or audit a report absent from the member-scoped read', async () => {
    m.reports = [];
    const { PATCH } = await import('../breaks/[id]/route');
    await expect((PATCH as Function)(ctx)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(m.updateCount).toBe(0);
    expect(m.audit).not.toHaveBeenCalled();
  });
});
