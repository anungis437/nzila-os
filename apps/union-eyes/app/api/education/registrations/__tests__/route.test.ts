import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  crudRoutes: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  badRequest: vi.fn((message: string) => ({ apiError: true, status: 400, message })),
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/lib/api/errors', () => ({ ApiError: { badRequest: m.badRequest } }));
vi.mock('@/db/schema', () => ({
  courseRegistrations: { id: 'cr.id' },
  trainingCourses: { id: 'tc.id', organizationId: 'tc.organizationId' },
  courseSessions: { id: 'cs.id', organizationId: 'cs.organizationId' },
}));
vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and }));
vi.mock('@/db/db', () => ({
  db: {
    select: (...args: unknown[]) => { m.select(...args); return { from: m.from }; },
  },
}));

async function loadRoute() {
  return import('../route');
}

describe('education/registrations route (round 53 — memberId spoofing + cross-org course/session FK injection fix)', () => {
  let beforeCreate: (
    values: Record<string, unknown>,
    ctx: { organizationId?: string | null; userId?: string | null },
  ) => Promise<Record<string, unknown>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    let capturedOptions: Record<string, unknown> | undefined;
    m.crudRoutes.mockImplementation((opts: Record<string, unknown>) => {
      capturedOptions = opts;
      return { GET: vi.fn(), POST: vi.fn() };
    });
    m.from.mockReturnValue({ where: m.where });
    await loadRoute();
    beforeCreate = capturedOptions!.beforeCreate as typeof beforeCreate;
  });

  it('forces memberId to the caller\'s own id, ignoring a client-supplied memberId', async () => {
    m.where.mockResolvedValue([{ id: 'course-1' }]);

    const result = await beforeCreate(
      { courseId: 'course-1', memberId: 'attacker-supplied-victim-id' },
      { organizationId: 'org-real', userId: 'caller-own-id' },
    );

    expect(result.memberId).toBe('caller-own-id');
    expect(result.memberId).not.toBe('attacker-supplied-victim-id');
  });

  it('rejects a courseId that does not belong to the caller\'s organization', async () => {
    m.where.mockResolvedValue([]); // no matching course in caller's org

    await expect(
      beforeCreate({ courseId: 'other-org-course' }, { organizationId: 'org-real', userId: 'caller-own-id' }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('rejects a sessionId that does not belong to the caller\'s organization', async () => {
    m.where
      .mockResolvedValueOnce([{ id: 'course-1' }]) // courseId check passes
      .mockResolvedValueOnce([]); // sessionId check fails

    await expect(
      beforeCreate(
        { courseId: 'course-1', sessionId: 'other-org-session' },
        { organizationId: 'org-real', userId: 'caller-own-id' },
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('allows a registration when courseId and sessionId both belong to the caller\'s organization', async () => {
    m.where.mockResolvedValue([{ id: 'matched' }]);

    const result = await beforeCreate(
      { courseId: 'course-1', sessionId: 'session-1' },
      { organizationId: 'org-real', userId: 'caller-own-id' },
    );

    expect(result.memberId).toBe('caller-own-id');
  });
});
