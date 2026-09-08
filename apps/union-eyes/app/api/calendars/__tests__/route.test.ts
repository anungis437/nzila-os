import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  crudRoutes: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
  or: vi.fn((...args: unknown[]) => ({ op: 'or', args })),
  asc: vi.fn((col: unknown) => ({ op: 'asc', col })),
}));

vi.mock('@/lib/api/with-api', () => ({ withApi: m.withApi }));
vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/db/schema', () => ({ calendars: { id: 'calendars.id', organizationId: 'calendars.organizationId', isPersonal: 'calendars.isPersonal', ownerId: 'calendars.ownerId', name: 'calendars.name' } }));
vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and, or: m.or, asc: m.asc }));
vi.mock('@/db/db', () => ({
  db: {
    select: (...args: unknown[]) => { m.select(...args); return { from: m.from }; },
  },
}));

async function loadRoute() {
  return import('../route');
}

describe('calendars collection route (round 53 — personal-calendar visibility + ownerId spoofing fix)', () => {
  let capturedGetHandler: ((ctx: unknown) => unknown) | undefined;
  let capturedCrudOptions: Record<string, unknown> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_opts: unknown, handler: (ctx: unknown) => unknown) => {
      capturedGetHandler = handler;
      return handler;
    });
    m.crudRoutes.mockImplementation((opts: Record<string, unknown>) => {
      capturedCrudOptions = opts;
      return { POST: vi.fn() };
    });
    m.from.mockReturnValue({ where: m.where });
    m.where.mockReturnValue({ orderBy: m.orderBy });
    m.orderBy.mockResolvedValue([{ id: 'cal-shared' }, { id: 'cal-mine' }]);
  });

  it('GET queries scoped to the caller org plus (shared OR own) visibility, not the whole org', async () => {
    await loadRoute();
    expect(capturedGetHandler).toBeTruthy();

    await capturedGetHandler!({ organizationId: 'org-real', userId: 'user-real' });

    // and(eq(organizationId, org), or(eq(isPersonal, false), eq(ownerId, user)))
    expect(m.and).toHaveBeenCalledTimes(1);
    const andArgs = m.and.mock.calls[0] as unknown[];
    expect(andArgs).toEqual([
      { op: 'eq', col: 'calendars.organizationId', val: 'org-real' },
      { op: 'or', args: [
        { op: 'eq', col: 'calendars.isPersonal', val: false },
        { op: 'eq', col: 'calendars.ownerId', val: 'user-real' },
      ] },
    ]);
  });

  it('GET falls back to shared-only when userId is absent', async () => {
    await loadRoute();
    await capturedGetHandler!({ organizationId: 'org-real', userId: null });

    const andArgs = m.and.mock.calls[0] as unknown[];
    expect(andArgs).toEqual([
      { op: 'eq', col: 'calendars.organizationId', val: 'org-real' },
      { op: 'eq', col: 'calendars.isPersonal', val: false },
    ]);
  });

  it('POST beforeCreate forces ownerId to the caller\'s own id, ignoring a client-supplied ownerId', async () => {
    await loadRoute();
    expect(capturedCrudOptions?.beforeCreate).toBeTruthy();

    const beforeCreate = capturedCrudOptions!.beforeCreate as (
      values: Record<string, unknown>,
      ctx: { organizationId?: string | null; userId?: string | null },
    ) => Record<string, unknown>;

    const result = beforeCreate(
      { name: 'My Calendar', ownerId: 'attacker-supplied-victim-id' },
      { organizationId: 'org-real', userId: 'caller-own-id' },
    );

    expect(result.ownerId).toBe('caller-own-id');
    expect(result.ownerId).not.toBe('attacker-supplied-victim-id');
  });

  it('POST is orgScoped with a steward writeRole (unchanged product behavior)', async () => {
    await loadRoute();
    expect(capturedCrudOptions?.orgScoped).toBe(true);
    expect(capturedCrudOptions?.writeRole).toBe('steward');
  });
});
