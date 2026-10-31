import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  crudRoutes: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
  badRequest: vi.fn((message: string) => ({ apiError: true, status: 400, message })),
  forbidden: vi.fn((message: string) => ({ apiError: true, status: 403, message })),
  conflict: vi.fn((message: string) => ({ apiError: true, status: 409, message })),
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/lib/api/errors', () => ({ ApiError: {
  badRequest: m.badRequest, forbidden: m.forbidden, conflict: m.conflict,
} }));
vi.mock('@/db/schema', () => ({
  courseRegistrations: {
    id: 'cr.id', organizationId: 'cr.organizationId', memberId: 'cr.memberId',
    courseId: 'cr.courseId', sessionId: 'cr.sessionId',
  },
  trainingCourses: { id: 'tc.id', organizationId: 'tc.organizationId', isActive: 'tc.isActive' },
  courseSessions: { id: 'cs.id', courseId: 'cs.courseId', organizationId: 'cs.organizationId' },
}));
vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and, count: vi.fn(() => 'count') }));
vi.mock('@/db/db', () => ({
  db: { select: (...args: unknown[]) => { m.select(...args); return { from: m.from }; } },
}));

describe('education/registrations: self-enrollment and cross-tenant FK protections', () => {
  let beforeCreate: (
    values: Record<string, unknown>,
    ctx: { organizationId?: string | null; userId?: string | null },
  ) => Promise<Record<string, unknown>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    m.crudRoutes.mockImplementation((opts: Record<string, unknown>) => {
      beforeCreate = opts.beforeCreate as typeof beforeCreate;
      return { GET: vi.fn(), POST: vi.fn() };
    });
    m.from.mockReturnValue({ where: m.where });
    m.where.mockReturnValue({ limit: m.limit });
    await import('../route');
  });

  it('rejects missing organization or authenticated user before querying', async () => {
    await expect(beforeCreate({ courseId: 'c', sessionId: 's' }, {
      organizationId: null, userId: 'member',
    })).rejects.toMatchObject({ status: 403 });
    expect(m.select).not.toHaveBeenCalled();
  });

  it('forces the member identity and ignores all client-controlled achievement/payment fields', async () => {
    m.limit.mockResolvedValueOnce([{ id: 'course-1' }])
      .mockResolvedValueOnce([{ id: 'session-1' }]).mockResolvedValueOnce([]);
    const result = await beforeCreate({
      courseId: 'course-1', sessionId: 'session-1', memberId: 'victim',
      completed: true, attended: true, passed: true, feePaid: true,
      certificateIssued: true, registrationStatus: 'completed',
    }, { organizationId: 'org-real', userId: 'caller-own-id' });
    expect(result).toMatchObject({
      memberId: 'caller-own-id', organizationId: 'org-real',
      completed: false, attended: false, passed: null, feePaid: false,
      certificateIssued: false, registrationStatus: 'registered',
    });
    expect(m.select).toHaveBeenCalledTimes(3);
  });

  it('rejects a course outside the caller organization', async () => {
    m.limit.mockResolvedValueOnce([]);
    await expect(beforeCreate({
      courseId: 'foreign-course', sessionId: 'foreign-session',
    }, { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 400 });
    expect(m.select).toHaveBeenCalledTimes(1);
  });

  it('rejects a session outside the caller course or organization', async () => {
    m.limit.mockResolvedValueOnce([{ id: 'course-1' }]).mockResolvedValueOnce([]);
    await expect(beforeCreate({
      courseId: 'course-1', sessionId: 'foreign-session',
    }, { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 400 });
    expect(m.select).toHaveBeenCalledTimes(2);
  });

  it('rejects a duplicate self-registration for the same session', async () => {
    m.limit.mockResolvedValueOnce([{ id: 'course-1' }])
      .mockResolvedValueOnce([{ id: 'session-1' }]).mockResolvedValueOnce([{ id: 'existing' }]);
    await expect(beforeCreate({
      courseId: 'course-1', sessionId: 'session-1',
    }, { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 409 });
  });

  const open = (extra: Record<string, unknown>) => {
    m.limit.mockResolvedValueOnce([{ id: 'course-1' }]).mockResolvedValueOnce([{ id: 'session-1', ...extra }]);
  };

  it.each([
    ['a cancelled session', { sessionStatus: 'cancelled' }],
    ['a session whose registration has not opened', { registrationOpenDate: '2999-01-01' }],
    ['a session whose registration has closed', { registrationCloseDate: '2000-01-01' }],
  ])('refuses registration for %s (DEF-0B6-EDU-REGISTRATION-NO-CAPACITY-DUPLICATE-OR-SESSION-COURSE-CHECK)', async (_name, extra) => {
    open(extra);
    await expect(beforeCreate({ courseId: 'course-1', sessionId: 'session-1' }, { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 409 });
  });

  it('refuses registration for a session that is full, and allows one with room', async () => {
    open({ maxEnrollment: 2 });
    m.where.mockReturnValueOnce({ limit: m.limit }).mockReturnValueOnce({ limit: m.limit }).mockResolvedValueOnce([{ registered: 2 }]);
    await expect(beforeCreate({ courseId: 'course-1', sessionId: 'session-1' }, { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 409 });

    open({ maxEnrollment: 2 });
    m.where.mockReturnValueOnce({ limit: m.limit }).mockReturnValueOnce({ limit: m.limit }).mockResolvedValueOnce([{ registered: 1 }]).mockReturnValueOnce({ limit: m.limit });
    m.limit.mockResolvedValueOnce([]);
    await expect(beforeCreate({ courseId: 'course-1', sessionId: 'session-1' }, { organizationId: 'org-real', userId: 'member' })).resolves.toMatchObject({ registrationStatus: 'registered' });
  });

  it('allows enrollment when both foreign keys belong to the caller organization', async () => {
    m.limit.mockResolvedValueOnce([{ id: 'course-1' }])
      .mockResolvedValueOnce([{ id: 'session-1' }]).mockResolvedValueOnce([]);
    const result = await beforeCreate({
      courseId: 'course-1', sessionId: 'session-1',
    }, { organizationId: 'org-real', userId: 'member' });
    expect(result).toMatchObject({
      organizationId: 'org-real', memberId: 'member',
      courseId: 'course-1', sessionId: 'session-1',
    });
  });
});
