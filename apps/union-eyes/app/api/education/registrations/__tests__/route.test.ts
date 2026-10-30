import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  crudRoutes: vi.fn(),
  select: vi.fn(),
  wherePredicates: [] as unknown[],
  responses: [] as unknown[][],
  badRequest: vi.fn((message: string) => Object.assign(new Error(message), { status: 400 })),
  forbidden: vi.fn((message: string) => Object.assign(new Error(message), { status: 403 })),
  conflict: vi.fn((message: string) => Object.assign(new Error(message), { status: 409 })),
  eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
  and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
}));

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/lib/api/errors', () => ({
  ApiError: { badRequest: m.badRequest, forbidden: m.forbidden, conflict: m.conflict },
}));
vi.mock('@/db/schema', () => ({
  courseRegistrations: {
    id: 'cr.id', organizationId: 'cr.organizationId', memberId: 'cr.memberId',
    courseId: 'cr.courseId', sessionId: 'cr.sessionId',
  },
  trainingCourses: { id: 'tc.id', organizationId: 'tc.organizationId', isActive: 'tc.isActive' },
  courseSessions: { id: 'cs.id', organizationId: 'cs.organizationId', courseId: 'cs.courseId' },
}));
vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and }));
vi.mock('@/db/db', () => ({
  db: {
    select: (...args: unknown[]) => {
      m.select(...args);
      return {
        from: () => ({
          where: (condition: unknown) => {
            m.wherePredicates.push(condition);
            return { limit: async () => m.responses.shift() ?? [] };
          },
        }),
      };
    },
  },
}));

describe('education/registrations — member-owned, tenant-bound enrollment', () => {
  let beforeCreate: (
    values: Record<string, unknown>,
    ctx: { organizationId?: string | null; userId?: string | null },
  ) => Promise<Record<string, unknown>>;

  const own = { organizationId: 'org-real', userId: 'caller-own-id' };
  const valid = { courseId: 'course-1', sessionId: 'session-1' };
  const allowEnrollment = () => { m.responses = [[{ id: valid.courseId }], [{ id: valid.sessionId }], []]; };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    m.wherePredicates = [];
    m.responses = [];
    let opts: Record<string, any> | undefined;
    m.crudRoutes.mockImplementation((received: Record<string, any>) => {
      opts = received;
      return { GET: vi.fn(), POST: vi.fn() };
    });
    await import('../route');
    expect(opts).toMatchObject({
      orgScoped: true, ownerColumn: 'memberId', readRole: 'member', writeRole: 'member',
    });
    beforeCreate = opts!.beforeCreate as typeof beforeCreate;
  });

  it('forces the caller identity and tenant, not a payload-supplied member or organization', async () => {
    allowEnrollment();
    const result = await beforeCreate({
      ...valid, memberId: 'victim-user', organizationId: 'other-org',
      completed: true, passed: true, certificateIssued: true, feePaid: true, registrationStatus: 'approved',
    }, own);
    expect(result).toMatchObject({
      organizationId: 'org-real', memberId: 'caller-own-id',
      courseId: 'course-1', sessionId: 'session-1', registrationStatus: 'registered',
      completed: false, attended: false, certificateIssued: false, feePaid: false,
    });
    expect(result.memberId).not.toBe('victim-user');
    expect(m.wherePredicates).toHaveLength(3);
    for (const predicate of m.wherePredicates) {
      expect(JSON.stringify(predicate)).toContain('org-real');
    }
    expect(JSON.stringify(m.wherePredicates[0])).toContain('tc.isActive');
    expect(JSON.stringify(m.wherePredicates[1])).toContain('cs.courseId');
    expect(JSON.stringify(m.wherePredicates[2])).toContain('caller-own-id');
  });

  it('rejects missing organization or authenticated user without querying', async () => {
    await expect(beforeCreate(valid, { organizationId: null, userId: 'u' })).rejects.toMatchObject({ status: 403 });
    await expect(beforeCreate(valid, { organizationId: 'org-real', userId: null })).rejects.toMatchObject({ status: 403 });
    expect(m.select).not.toHaveBeenCalled();
  });

  it('rejects a missing course or session, preventing partial enrollment', async () => {
    await expect(beforeCreate({ courseId: 'course-1' }, own)).rejects.toMatchObject({ status: 400 });
    await expect(beforeCreate({ sessionId: 'session-1' }, own)).rejects.toMatchObject({ status: 400 });
    expect(m.select).not.toHaveBeenCalled();
  });

  it('rejects a course that does not belong to the active organization', async () => {
    m.responses = [[]];
    await expect(beforeCreate(valid, own)).rejects.toMatchObject({ status: 400 });
    expect(m.select).toHaveBeenCalledTimes(1);
  });

  it('rejects a foreign session or one for another course', async () => {
    m.responses = [[{ id: valid.courseId }], []];
    await expect(beforeCreate(valid, own)).rejects.toMatchObject({ status: 400 });
    expect(m.select).toHaveBeenCalledTimes(2);
  });

  it('rejects duplicate registrations for the same member, course and session', async () => {
    m.responses = [[{ id: valid.courseId }], [{ id: valid.sessionId }], [{ id: 'existing' }]];
    await expect(beforeCreate(valid, own)).rejects.toMatchObject({ status: 409 });
    expect(m.select).toHaveBeenCalledTimes(3);
  });

  it('permits a valid registration and restricts all sensitive client-controlled fields', async () => {
    allowEnrollment();
    const result = await beforeCreate({
      ...valid, memberId: 'other', passed: true, feeWaived: true,
      notes: 'n'.repeat(2500), travelRequired: true, travelSubsidyRequested: 'true',
    }, own);
    expect(result).toMatchObject({
      memberId: own.userId, registrationStatus: 'registered', completed: false,
      passed: null, feeWaived: false, travelRequired: true, travelSubsidyRequested: false,
    });
    expect((result.notes as string).length).toBe(2000);
  });
});
