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
  trainingCourses: { id: 'tc.id', organizationId: 'tc.organizationId', isActive: 'tc.isActive', courseFee: 'tc.courseFee' },
  courseSessions: { id: 'cs.id', courseId: 'cs.courseId', organizationId: 'cs.organizationId' },
}));
vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and, count: vi.fn(() => 'count') }));
vi.mock('@/db/db', () => ({
  db: { select: (...args: unknown[]) => { m.select(...args); return { from: m.from }; } },
}));

describe('education/registrations: self-enrollment and cross-tenant FK protections', () => {
  let routeOptions: Record<string, unknown>;
  let beforeCreate: (
    values: Record<string, unknown>,
    ctx: { organizationId?: string | null; userId?: string | null },
  ) => Promise<Record<string, unknown>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    m.crudRoutes.mockImplementation((opts: Record<string, unknown>) => {
      routeOptions = opts;
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

  it('declares an enrollment-only write allowlist, excluding payment, approval and achievement fields', () => {
    expect(routeOptions.writableFields).toEqual([
      'courseId', 'sessionId', 'travelRequired', 'travelSubsidyRequested',
      'accommodationRequired', 'notes',
    ]);
    for (const key of ['memberId', 'feePaid', 'feeWaived', 'courseFee', 'registrationStatus',
      'completed', 'attended', 'passed', 'certificateIssued', 'requiresApproval']) {
      expect(routeOptions.writableFields).not.toContain(key);
    }
  });

  // DEF-0B6-EDU-UI-CALLS-OPERATIONS-THE-ROUTES-DO-NOT-EXPORT: a staff caller (staffReadsAll) reads
  // every member's registrations; without these, nothing narrows that organization-wide list to one
  // member or one registration status, so a staff screen's own filter controls were silently ignored.
  it('honours memberId and registrationStatus list filters for a staff caller reading every member\'s registrations', () => {
    expect(routeOptions.listFilters).toEqual({
      equals: { memberId: 'memberId', registrationStatus: 'registrationStatus' },
    });
  });


  it.each(['memberId', 'feePaid', 'feeWaived', 'courseFee', 'registrationStatus',
    'completed', 'attended', 'passed', 'certificateIssued', 'requiresApproval', 'unexpected'])(
    'refuses forged enrollment field %s before any database read', async (field) => {
      await expect(beforeCreate({ courseId: 'course-1', sessionId: 'session-1', [field]: true },
        { organizationId: 'org-real', userId: 'caller-own-id' })).rejects.toMatchObject({ status: 400 });
      expect(m.select).not.toHaveBeenCalled();
    },
  );

  it('rejects tenant or creator identity mismatches before database access', async () => {
    await expect(beforeCreate({ courseId: 'course-1', sessionId: 'session-1', organizationId: 'foreign' },
      { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 403 });
    await expect(beforeCreate({ courseId: 'course-1', sessionId: 'session-1', createdBy: 'someone-else' },
      { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 403 });
    expect(m.select).not.toHaveBeenCalled();
  });

  it.each([
    ['travelRequired', 'true'], ['travelSubsidyRequested', 1],
    ['accommodationRequired', null], ['notes', 123], ['notes', 'x'.repeat(2001)],
  ])('rejects malformed preference %s without silently coercing or truncating', async (field, value) => {
    await expect(beforeCreate({ courseId: 'course-1', sessionId: 'session-1', [field]: value },
      { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 400 });
    expect(m.select).not.toHaveBeenCalled();
  });

  it('preserves exactly 2000 characters of legitimate notes without truncation', async () => {
    m.limit.mockResolvedValueOnce([{ id: 'course-1', courseFee: '0.00' }])
      .mockResolvedValueOnce([{ id: 'session-1', sessionStatus: 'scheduled', endDate: '2999-12-31' }]).mockResolvedValueOnce([]);
    const notes = 'n'.repeat(2000);
    const result = await beforeCreate({
      courseId: 'course-1', sessionId: 'session-1', notes,
    }, { organizationId: 'org-real', userId: 'member' });
    expect(result.notes).toBe(notes);
    expect(result.memberId).toBe('member');
    expect(result.feePaid).toBe(false);
  });

  it('rejects a course outside the caller organization', async () => {
    m.limit.mockResolvedValueOnce([]);
    await expect(beforeCreate({
      courseId: 'foreign-course', sessionId: 'foreign-session',
    }, { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 400 });
    expect(m.select).toHaveBeenCalledTimes(1);
  });

  it('rejects a session outside the caller course or organization', async () => {
    m.limit.mockResolvedValueOnce([{ id: 'course-1', courseFee: '0.00' }]).mockResolvedValueOnce([]);
    await expect(beforeCreate({
      courseId: 'course-1', sessionId: 'foreign-session',
    }, { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 400 });
    expect(m.select).toHaveBeenCalledTimes(2);
  });

  it('rejects a duplicate self-registration for the same session', async () => {
    m.limit.mockResolvedValueOnce([{ id: 'course-1', courseFee: '0.00' }])
      .mockResolvedValueOnce([{ id: 'session-1', sessionStatus: 'scheduled', endDate: '2999-12-31' }]).mockResolvedValueOnce([{ id: 'existing' }]);
    await expect(beforeCreate({
      courseId: 'course-1', sessionId: 'session-1',
    }, { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 409 });
  });

  const open = (extra: Record<string, unknown>) => {
    m.limit.mockResolvedValueOnce([{ id: 'course-1', courseFee: '0.00' }]).mockResolvedValueOnce([{ id: 'session-1', sessionStatus: 'scheduled', endDate: '2999-12-31', ...extra }]);
  };

  it.each([
    ['a cancelled session', { sessionStatus: 'cancelled' }],
    ['a session with missing status', { sessionStatus: null }],
    ['a session with unknown status', { sessionStatus: 'unknown' }],
    ['an already ended session', { endDate: '2000-01-01' }],
    ['a session with missing end date', { endDate: null }],
    ['a session whose registration has not opened', { registrationOpenDate: '2999-01-01' }],
    ['a session whose registration has closed', { registrationCloseDate: '2000-01-01' }],
  ])('refuses registration for %s (DEF-0B6-EDU-REGISTRATION-NO-CAPACITY-DUPLICATE-OR-SESSION-COURSE-CHECK)', async (_name, extra) => {
    open(extra);
    await expect(beforeCreate({ courseId: 'course-1', sessionId: 'session-1' }, { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 409 });
  });

  it('permits registration through the scheduled session end date, inclusively', async () => {
    const today = new Date().toISOString().slice(0, 10);
    open({ endDate: today });
    m.limit.mockResolvedValueOnce([]);
    await expect(beforeCreate({
      courseId: 'course-1', sessionId: 'session-1',
    }, { organizationId: 'org-real', userId: 'member' })).resolves.toMatchObject({
      registrationStatus: 'registered', memberId: 'member',
    });
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

  it('records authoritative paid fees with no client-supplied payment or waiver authority', async () => {
    m.limit.mockResolvedValueOnce([{ id: 'course-1', courseFee: '49.95' }])
      .mockResolvedValueOnce([{ id: 'session-1', sessionStatus: 'scheduled', endDate: '2999-12-31' }]).mockResolvedValueOnce([]);
    const result = await beforeCreate({
      courseId: 'course-1', sessionId: 'session-1',
      travelRequired: true, travelSubsidyRequested: false,
      accommodationRequired: true, notes: 'Accessibility needs',
    }, { organizationId: 'org-real', userId: 'member' });
    expect(result).toMatchObject({
      courseFee: '49.95', feePaid: false, feeWaived: false,
      travelRequired: true, travelSubsidyRequested: false,
      accommodationRequired: true, notes: 'Accessibility needs',
      memberId: 'member', organizationId: 'org-real',
    });
  });

  it.each([null, undefined, 'invalid', '-1', '1e2', '10.999'])(
    'refuses unavailable or malformed server course fee %s without registering', async fee => {
      m.limit.mockResolvedValueOnce([{ id: 'course-1', courseFee: fee }]);
      await expect(beforeCreate({ courseId: 'course-1', sessionId: 'session-1' },
        { organizationId: 'org-real', userId: 'member' })).rejects.toMatchObject({ status: 409 });
      expect(m.select).toHaveBeenCalledTimes(1);
    },
  );

  it('allows enrollment when both foreign keys belong to the caller organization', async () => {
    m.limit.mockResolvedValueOnce([{ id: 'course-1', courseFee: '0.00' }])
      .mockResolvedValueOnce([{ id: 'session-1', sessionStatus: 'scheduled', endDate: '2999-12-31' }]).mockResolvedValueOnce([]);
    const result = await beforeCreate({
      courseId: 'course-1', sessionId: 'session-1',
    }, { organizationId: 'org-real', userId: 'member' });
    expect(result).toMatchObject({
      organizationId: 'org-real', memberId: 'member',
      courseId: 'course-1', sessionId: 'session-1',
    });
  });
});
