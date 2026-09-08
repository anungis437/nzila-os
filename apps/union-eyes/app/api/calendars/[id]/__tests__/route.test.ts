import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  crudRoutes: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  notFound: vi.fn((resource: string) => ({ apiError: true, status: 404, resource })),
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

vi.mock('@/lib/api/with-api', () => ({ withApi: m.withApi }));
vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/lib/api/errors', () => ({ ApiError: { notFound: m.notFound } }));
vi.mock('@/db/schema', () => ({ calendars: { id: 'calendars.id', organizationId: 'calendars.organizationId', isPersonal: 'calendars.isPersonal', ownerId: 'calendars.ownerId' } }));
vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and }));
vi.mock('@/db/db', () => ({
  db: {
    select: (...args: unknown[]) => { m.select(...args); return { from: m.from }; },
  },
}));

async function loadRoute() {
  return import('../route');
}

describe('calendars item route (round 53 — same-org personal-calendar IDOR fix)', () => {
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
      return { PATCH: vi.fn(), DELETE: vi.fn() };
    });
    m.from.mockReturnValue({ where: m.where });
  });

  it('GET 404s a same-org personal calendar owned by a different user', async () => {
    m.where.mockResolvedValue([{ id: 'cal-1', isPersonal: true, ownerId: 'victim-user' }]);
    await loadRoute();

    await expect(
      capturedGetHandler!({ params: { id: 'cal-1' }, organizationId: 'org-real', userId: 'attacker-user' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('GET returns the row for its own owner', async () => {
    m.where.mockResolvedValue([{ id: 'cal-1', isPersonal: true, ownerId: 'caller-user' }]);
    await loadRoute();

    const result = await capturedGetHandler!({ params: { id: 'cal-1' }, organizationId: 'org-real', userId: 'caller-user' }) as { data: unknown };
    expect(result.data).toMatchObject({ id: 'cal-1' });
  });

  it('GET returns a shared (non-personal) calendar to any same-org caller', async () => {
    m.where.mockResolvedValue([{ id: 'cal-2', isPersonal: false, ownerId: 'someone-else' }]);
    await loadRoute();

    const result = await capturedGetHandler!({ params: { id: 'cal-2' }, organizationId: 'org-real', userId: 'any-member' }) as { data: unknown };
    expect(result.data).toMatchObject({ id: 'cal-2' });
  });

  it('GET 404s when no row matches (org/id mismatch)', async () => {
    m.where.mockResolvedValue([]);
    await loadRoute();

    await expect(
      capturedGetHandler!({ params: { id: 'cal-missing' }, organizationId: 'org-real', userId: 'any-member' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('PATCH/DELETE lockedAuthCheck rejects a same-org personal calendar owned by a different user', async () => {
    await loadRoute();
    const lockedAuthCheck = capturedCrudOptions!.lockedAuthCheck as (
      existing: Record<string, unknown>,
      ctx: { userId?: string | null },
    ) => Promise<{ ok: boolean; status?: number }>;

    const result = await lockedAuthCheck(
      { isPersonal: true, ownerId: 'victim-user' },
      { userId: 'attacker-steward' },
    );
    expect(result).toEqual({ ok: false, status: 403 });
  });

  it('PATCH/DELETE lockedAuthCheck allows the owner to mutate their own personal calendar', async () => {
    await loadRoute();
    const lockedAuthCheck = capturedCrudOptions!.lockedAuthCheck as (
      existing: Record<string, unknown>,
      ctx: { userId?: string | null },
    ) => Promise<{ ok: boolean; status?: number }>;

    const result = await lockedAuthCheck(
      { isPersonal: true, ownerId: 'caller-user' },
      { userId: 'caller-user' },
    );
    expect(result).toEqual({ ok: true });
  });

  it('PATCH/DELETE lockedAuthCheck allows any writer to mutate a shared (non-personal) calendar', async () => {
    await loadRoute();
    const lockedAuthCheck = capturedCrudOptions!.lockedAuthCheck as (
      existing: Record<string, unknown>,
      ctx: { userId?: string | null },
    ) => Promise<{ ok: boolean; status?: number }>;

    const result = await lockedAuthCheck(
      { isPersonal: false, ownerId: 'someone-else' },
      { userId: 'a-steward' },
    );
    expect(result).toEqual({ ok: true });
  });
});
