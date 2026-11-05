import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect, pgTable, text, uuid } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

// Mass assignment, credential disclosure and owner-scoped removal through the generic CRUD factory
// (Gate 0 mobile device, push device, negotiation and push campaign defects).
const captured = vi.hoisted(() => ({
  handlers: new Map<string, (ctx: Record<string, unknown>) => Promise<unknown>>(),
  floors: new Map<string, string>(),
  inserts: [] as Array<Record<string, unknown>>,
  sets: [] as Array<Record<string, unknown>>,
  wheres: [] as unknown[],
  rows: [] as Array<Record<string, unknown>>,
}));

vi.mock('../with-api', () => ({
  withApi: (config: { auth: { minRole: string }; openapi: { summary: string } }, handler: (ctx: Record<string, unknown>) => Promise<unknown>) => {
    const verb = config.openapi.summary.split(' ')[0];
    captured.handlers.set(verb, handler);
    captured.floors.set(verb, config.auth.minRole);
    return vi.fn();
  },
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn() }));
vi.mock('@/lib/organization-utils', () => ({ getUserRoleInOrganization: vi.fn().mockResolvedValue('steward') }));
vi.mock('@/db/db', () => ({
  db: {
    select: () => {
      const chain: Record<string, unknown> = {};
      chain.from = () => chain;
      chain.where = (clause: unknown) => { captured.wheres.push(clause); return chain; };
      chain.orderBy = () => chain;
      chain.limit = () => chain;
      chain.offset = () => Promise.resolve(captured.rows);
      chain.then = (resolve: (value: unknown[]) => unknown) => resolve(captured.rows.length ? captured.rows : [{ total: 0 }]);
      return chain;
    },
  },
}));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: (_ctx: unknown, operation: (tx: unknown) => Promise<unknown>) => operation({
    insert: () => ({ values: (values: Record<string, unknown>) => { captured.inserts.push(values); return { returning: () => Promise.resolve([{ id: 'new', deviceToken: 'secret-token-value', ...values }]) }; } }),
    update: () => ({ set: (values: Record<string, unknown>) => { captured.sets.push(values); return { where: () => ({ returning: () => Promise.resolve([{ id: 'row', deviceToken: 'secret-token-value' }]) }) }; } }),
    delete: () => ({ where: (clause: unknown) => { captured.wheres.push(clause); return { returning: () => Promise.resolve([{ id: 'row', deviceToken: 'secret-token-value' }]) }; } }),
  }),
}));

// push_devices is an ordinary operational record under CRUD governance; the owner column is profileId.
const devices = pgTable('push_devices', {
  id: uuid('id').primaryKey(),
  organizationId: uuid('organization_id').notNull(),
  profileId: text('profile_id').notNull(),
  deviceToken: text('device_token').notNull(),
  platform: text('platform').notNull(),
  enabled: text('enabled'),
});
const ctx = (extra: Record<string, unknown> = {}) => ({ organizationId: '11111111-1111-4111-8111-111111111111', userId: 'user-1', params: { id: 'row' }, request: new Request('http://localhost/api/x'), ...extra });

async function factory() {
  captured.handlers.clear();
  captured.floors.clear();
  return (await import('../crud-factory')).crudRoutes;
}

describe('crud-factory writableFields, omitFromResponse and ownerMayDelete', () => {
  beforeEach(() => {
    vi.resetModules();
    captured.inserts.length = 0;
    captured.sets.length = 0;
    captured.wheres.length = 0;
    captured.rows = [];
  });
  const base = { table: devices, tags: ['t'], orgScoped: true, ownerColumn: 'profileId', writableFields: ['deviceToken', 'platform', 'enabled'], omitFromResponse: ['deviceToken'] } as const;

  it('refuses a column the table has but the route does not allow, and a field the table does not have, writing nothing', async () => {
    const crudRoutes = await factory();
    crudRoutes({ ...base, writeRole: 'member', writableFields: ['platform'] });
    // a real column outside this route's allow-list: refused by the route's own allow-list
    await expect(captured.handlers.get('Create')!(ctx({ body: { platform: 'ios', deviceToken: 'tok-12345678' } }))).rejects.toMatchObject({ message: expect.stringContaining('Fields not allowed on this resource: deviceToken') });
    // a field that is no column at all (status, a delivery counter): refused by the generic payload guard
    await expect(captured.handlers.get('Create')!(ctx({ body: { platform: 'ios', status: 'sent', totalSent: 9000 } }))).rejects.toMatchObject({ message: expect.stringContaining('status') });
    expect(captured.inserts).toEqual([]);
  });

  it('refuses the factory-managed fields (id, organization, creator, owner) instead of trusting them', async () => {
    // assertGenericWritePayload (upstream) refuses these before the allow-list is consulted.
    const crudRoutes = await factory();
    crudRoutes({ ...base, writeRole: 'member' });
    for (const managed of ['id', 'organizationId', 'createdBy', 'profileId']) {
      await expect(captured.handlers.get('Create')!(ctx({ body: { deviceToken: 'tok-12345678', platform: 'ios', [managed]: 'forced' } }))).rejects.toMatchObject({ message: expect.stringContaining(managed) });
    }
    expect(captured.inserts).toEqual([]);
  });

  it('applies the same allow-list to an update', async () => {
    const crudRoutes = await factory();
    crudRoutes({ ...base, writeRole: 'member', itemRoute: true });
    await expect(captured.handlers.get('Update')!(ctx({ body: { enabled: 'no', platform: 'android', profileId: 'someone-else' } }))).rejects.toMatchObject({ message: expect.stringContaining('profileId') });
    expect(captured.sets).toEqual([]);
    await captured.handlers.get('Update')!(ctx({ body: { enabled: 'no' } }));
    expect(captured.sets).toHaveLength(1);
  });

  it('never returns an omitted column from create, list, get, update or delete', async () => {
    const crudRoutes = await factory();
    crudRoutes({ ...base, writeRole: 'member' });
    const created = await captured.handlers.get('Create')!(ctx({ body: { deviceToken: 'tok-12345678', platform: 'ios' } })) as { data: Record<string, unknown> };
    expect(created.data).not.toHaveProperty('deviceToken');
    captured.rows = [{ id: 'a', deviceToken: 'secret-token-value', platform: 'ios' }];
    const listed = await captured.handlers.get('List')!(ctx()) as { data: Array<Record<string, unknown>> };
    expect(JSON.stringify(listed)).not.toContain('secret-token-value');
    expect(listed.data[0]).toMatchObject({ platform: 'ios' });

    const items = await factory();
    items({ ...base, writeRole: 'member', itemRoute: true, ownerMayDelete: true });
    for (const verb of ['Get', 'Update', 'Delete']) {
      captured.rows = [{ id: 'a', deviceToken: 'secret-token-value', platform: 'ios' }];
      const result = await captured.handlers.get(verb)!(ctx({ body: { enabled: 'yes' } }));
      expect(JSON.stringify(result), verb).not.toContain('secret-token-value');
    }
  });

  it('lets the owner delete at the write floor only when the route is owner-scoped and opts in', async () => {
    let crudRoutes = await factory();
    crudRoutes({ ...base, writeRole: 'member', itemRoute: true, ownerMayDelete: true });
    expect(captured.floors.get('Delete')).toBe('member');
    // The row scope still pins the delete to the caller's own rows.
    await captured.handlers.get('Delete')!(ctx());
    expect(render(captured.wheres.at(-1) ?? captured.wheres[0]).sql).toContain('"profile_id"');

    crudRoutes = await factory();
    crudRoutes({ ...base, writeRole: 'member', itemRoute: true });
    expect(captured.floors.get('Delete')).toBe('admin');

    crudRoutes = await factory();
    crudRoutes({ table: devices, tags: ['t'], orgScoped: true, writeRole: 'member', itemRoute: true, ownerMayDelete: true });
    expect(captured.floors.get('Delete')).toBe('admin');
  });
});

const render = (clause: unknown) => new PgDialect().sqlToQuery(clause as SQL);
