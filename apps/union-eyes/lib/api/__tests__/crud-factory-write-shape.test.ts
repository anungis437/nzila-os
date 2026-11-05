import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

// What the generic CRUD routes did with the first real table behind them (the CNESST filings and refusal events): a JSON timestamp reached the driver as text and
// crashed it, a missing required field or a malformed value answered as a server fault, and a steward could not name the member a filing concerns.
// The native proof (db/__tests__/health-safety-routes.postgres.test.ts) runs the same routes against PostgreSQL; this pins the factory's own decisions.
const state = vi.hoisted(() => ({
  handlers: new Map<string, (ctx: Record<string, unknown>) => Promise<unknown>>(),
  role: 'steward',
  inserts: [] as Array<Record<string, unknown>>,
  sets: [] as Array<Record<string, unknown>>,
  transactions: 0,
  insertFault: null as unknown,
  auditFault: null as unknown,
}));

vi.mock('../with-api', () => ({
  withApi: (config: { openapi: { summary: string } }, handler: (ctx: Record<string, unknown>) => Promise<unknown>) => {
    state.handlers.set(config.openapi.summary.split(' ')[0], handler);
    return vi.fn();
  },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({
  persistAtomicAudit: vi.fn(async () => {
    if (state.auditFault) throw state.auditFault;
  }),
}));
vi.mock('@/lib/organization-utils', () => ({ getUserRoleInOrganization: vi.fn(async () => state.role) }));
vi.mock('@/db/db', () => ({ db: {} }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_context: unknown, operation: (tx: unknown) => Promise<unknown>) => {
    state.transactions += 1;
    return operation({
      insert: () => ({
        values: (values: Record<string, unknown>) => {
          state.inserts.push(values);
          return { returning: () => (state.insertFault ? Promise.reject(state.insertFault) : Promise.resolve([{ id: 'new', ...values }])) };
        },
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          state.sets.push(values);
          return { where: () => ({ returning: () => (state.insertFault ? Promise.reject(state.insertFault) : Promise.resolve([{ id: 'row', ...values }])) }) };
        },
      }),
    });
  },
}));

// A name the CRUD governance lists as an ordinary operational record, so writes are permitted.
const filings = pgTable('cnesst_filings', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull(),
  memberId: uuid('member_id'),
  title: text('title').notNull(),
  filedAt: timestamp('filed_at', { withTimezone: true }),
  createdBy: text('created_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }),
});

const ORG = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';
const ctx = (body: Record<string, unknown>) => ({ organizationId: ORG, userId: 'user-1', params: { id: 'row' }, body, request: new Request('http://localhost/api/x') });

// The driver's error as Drizzle reports it: a wrapper whose cause is the database's.
const databaseError = (code: string, extra: Record<string, unknown> = {}) =>
  Object.assign(new Error('Failed query: insert into "cnesst_filings" ...'), { cause: Object.assign(new Error('driver message'), { code, ...extra }) });

async function routes(options: Record<string, unknown> = {}, item = false) {
  state.handlers.clear();
  const { crudRoutes } = await import('../crud-factory');
  crudRoutes({ table: filings, tags: ['t'], orgScoped: true, writeRole: 'steward', ...(item ? { itemRoute: true } : {}), ...options } as never);
  return { create: state.handlers.get('Create')!, update: state.handlers.get('Update')! };
}

describe('crud-factory write shaping', () => {
  beforeEach(() => {
    vi.resetModules();
    state.role = 'steward';
    state.inserts.length = 0;
    state.sets.length = 0;
    state.transactions = 0;
    state.insertFault = null;
    state.auditFault = null;
  });

  describe('naming the owner of a new row', () => {
    const owned = { ownerColumn: 'memberId', staffReadsAll: true };

    it('lets staff name the owner when staffMayNameOwner is declared, writing the member they named', async () => {
      const { create } = await routes({ ...owned, staffMayNameOwner: true });
      await create(ctx({ title: 'Fall', memberId: MEMBER }));
      expect(state.inserts[0]).toMatchObject({ memberId: MEMBER, organizationId: ORG, createdBy: 'user-1' });
    });

    it('still checks what staff named: a uuid column takes a uuid', async () => {
      const { create } = await routes({ ...owned, staffMayNameOwner: true });
      await expect(create(ctx({ title: 'Fall', memberId: 'not-a-uuid' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: 'memberId must be a UUID' });
      expect(state.transactions).toBe(0);
    });

    it('keeps the owner server-owned for a caller below the staff floor', async () => {
      state.role = 'member';
      const { create } = await routes({ ...owned, staffMayNameOwner: true });
      await expect(create(ctx({ title: 'Fall', memberId: MEMBER }))).rejects.toMatchObject({ message: 'Field memberId cannot be assigned through generic CRUD' });
      expect(state.inserts).toHaveLength(0);
    });

    it('keeps the owner server-owned for staff when the route does not declare it', async () => {
      const { create } = await routes(owned);
      await expect(create(ctx({ title: 'Fall', memberId: MEMBER }))).rejects.toMatchObject({ message: 'Field memberId cannot be assigned through generic CRUD' });
      expect(state.inserts).toHaveLength(0);
    });

    it('does not let an update name the owner', async () => {
      const { update } = await routes({ ...owned, staffMayNameOwner: true }, true);
      await expect(update(ctx({ memberId: MEMBER }))).rejects.toMatchObject({ message: 'Field memberId cannot be assigned through generic CRUD' });
    });
  });

  describe('timestamps and malformed values', () => {
    it('writes a JSON timestamp as a Date on create and on update, so the driver can serialize it', async () => {
      const { create } = await routes();
      await create(ctx({ title: 'Fall', filedAt: '2026-01-15T10:30:00.000Z' }));
      expect(state.inserts[0].filedAt).toEqual(new Date('2026-01-15T10:30:00.000Z'));
      const { update } = await routes({}, true);
      await update(ctx({ filedAt: '2026-02-01' }));
      expect(state.sets[0].filedAt).toEqual(new Date('2026-02-01T00:00:00.000Z'));
      expect(state.sets[0].updatedAt).toBeInstanceOf(Date);
    });

    it('refuses a malformed timestamp or uuid with a 400 that names the field, before any transaction opens', async () => {
      const { create } = await routes();
      await expect(create(ctx({ title: 'Fall', filedAt: 'yesterday' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining('filedAt') });
      await expect(create(ctx({ title: 'Fall', memberId: '123' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining('memberId') });
      const { update } = await routes({}, true);
      await expect(update(ctx({ filedAt: '2026-02-30' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining('filedAt') });
      expect(state.transactions).toBe(0);
      expect(state.inserts).toHaveLength(0);
      expect(state.sets).toHaveLength(0);
    });

    it('lets a hook see the body as it arrived, and shapes what the hook returns', async () => {
      const seen: unknown[] = [];
      const { create } = await routes({ beforeCreate: (values: Record<string, unknown>) => { seen.push(values.filedAt); return values; } });
      await create(ctx({ title: 'Fall', filedAt: '2026-01-15T10:30:00Z' }));
      expect(seen).toEqual(['2026-01-15T10:30:00Z']);
      expect(state.inserts[0].filedAt).toBeInstanceOf(Date);
    });
  });

  describe('database refusals the client caused', () => {
    it('answers a required column the body left out as a 400 that names the property', async () => {
      state.insertFault = databaseError('23502', { column: 'title' });
      const { create } = await routes();
      await expect(create(ctx({ filedAt: '2026-01-15' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: 'title is required' });
    });

    it('answers a duplicate as a conflict, and a value of the wrong type as a 400, on create and on update', async () => {
      const { create } = await routes();
      state.insertFault = databaseError('23505');
      await expect(create(ctx({ title: 'Fall' }))).rejects.toMatchObject({ code: 'CONFLICT' });
      state.insertFault = databaseError('22001');
      await expect(create(ctx({ title: 'Fall' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      const { update } = await routes({}, true);
      await expect(update(ctx({ title: 'Fall' }))).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      state.insertFault = databaseError('23505');
      await expect(update(ctx({ title: 'Fall' }))).rejects.toMatchObject({ code: 'CONFLICT' });
    });

    it('lets a route\'s own translation of a create answer first', async () => {
      state.insertFault = databaseError('23514');
      const { create } = await routes({ mapCreateError: (error: unknown) => ((error as { cause?: { code?: string } }).cause?.code === '23514' ? Object.assign(new Error('This session is full'), { code: 'CONFLICT' }) : null) });
      await expect(create(ctx({ title: 'Fall' }))).rejects.toMatchObject({ code: 'CONFLICT', message: 'This session is full' });
    });

    it('leaves a missing grant, a lost connection and a plain error as server faults', async () => {
      const { create } = await routes();
      for (const fault of [databaseError('42501'), databaseError('08006'), new Error('boom')]) {
        state.insertFault = fault;
        await expect(create(ctx({ title: 'Fall' }))).rejects.toBe(fault);
      }
    });

    it('does not translate a failure of the audit that commits with the write', async () => {
      const failure = databaseError('23503');
      state.auditFault = failure;
      const { create } = await routes();
      await expect(create(ctx({ title: 'Fall' }))).rejects.toBe(failure);
    });
  });
});
