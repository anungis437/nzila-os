import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  crudRoutes: vi.fn(), select: vi.fn(), from: vi.fn(), where: vi.fn(), limit: vi.fn(),
  eq: vi.fn((column: unknown, value: unknown) => ({ op: 'eq', column, value })),
  isNull: vi.fn((column: unknown) => ({ op: 'isNull', column })),
  and: vi.fn((...conditions: unknown[]) => ({ conditions })),
}));
vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/lib/api/errors', () => {
  const error = (status: number, message: string) => Object.assign(new Error(message), { status });
  return { ApiError: {
    forbidden: (s: string) => error(403, s),
    badRequest: (s: string) => error(400, s),
  } };
});
vi.mock('drizzle-orm', () => ({ eq: m.eq, and: m.and, isNull: m.isNull }));
vi.mock('@/db/db', () => ({
  db: { select: (...args: unknown[]) => { m.select(...args); return { from: m.from }; } },
}));
vi.mock('@/db/schema', () => ({
  memberCertifications: { id: 'cert.id', memberId: 'cert.memberId' },
  courseRegistrations: {
    id: 'reg.id', organizationId: 'reg.org', completed: 'reg.completed',
    passed: 'reg.passed', registrationStatus: 'reg.status',
    cancellationDate: 'reg.cancelled',
  },
  trainingCourses: {
    id: 'course.id', organizationId: 'course.org',
    providesCertification: 'course.certifies',
  },
}));
const registrationId = '11111111-1111-4111-8111-111111111111';
const ctx = { organizationId: 'org-a', userId: 'steward-a' };

describe('education certification candidate: evidence and mass-assignment boundary', () => {
  let options: Record<string, any>;
  let beforeCreate: (v: Record<string, unknown>, c: typeof ctx) => Promise<Record<string, unknown>>;
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    m.crudRoutes.mockImplementation((opts: Record<string, any>) => {
      options = opts;
      beforeCreate = opts.beforeCreate;
      return { GET: vi.fn(), POST: vi.fn() };
    });
    m.from.mockReturnValue({ where: m.where });
    m.where.mockReturnValue({ limit: m.limit });
    await import('../route');
  });

  it('accepts only registrationId as client input, with steward floor and owner-scoped reads', () => {
    expect(options.writableFields).toEqual(['registrationId']);
    expect(options.writeRole).toBe('steward');
    expect(options.ownerColumn).toBe('memberId');
    expect(options.staffReadsAll).toBe(true);
  });

  it.each(['verified', 'verifiedBy', 'verificationDate', 'certificateUrl',
    'digitalBadgeUrl', 'certificationStatus', 'revoked', 'clcRegistered',
    'memberId', 'courseId', 'sessionId', 'issueDate', 'unexpected'])(
    'refuses forged %s before querying', async (field) => {
      await expect(beforeCreate({ registrationId, [field]: true }, ctx))
        .rejects.toMatchObject({ status: 400 });
      expect(m.select).not.toHaveBeenCalled();
    },
  );

  it('refuses tenant, creator and missing identity before querying', async () => {
    await expect(beforeCreate({ registrationId, organizationId: 'org-b' }, ctx))
      .rejects.toMatchObject({ status: 403 });
    await expect(beforeCreate({ registrationId, createdBy: 'other' }, ctx))
      .rejects.toMatchObject({ status: 403 });
    await expect(beforeCreate({ registrationId }, { ...ctx, userId: '' }))
      .rejects.toMatchObject({ status: 403 });
    expect(m.select).not.toHaveBeenCalled();
  });

  it.each(['', 'not-a-guid', '11111111-1111-1111-1111-zzzzzzzzzzzz',
    '11111111----------------------------'])(
    'rejects malformed registration identifier %s before database access', async (id) => {
      await expect(beforeCreate({ registrationId: id }, ctx))
        .rejects.toMatchObject({ status: 400 });
      expect(m.select).not.toHaveBeenCalled();
    },
  );

  it('requires completed, passed, non-cancelled registration in the same tenant', async () => {
    m.limit.mockResolvedValueOnce([]);
    await expect(beforeCreate({ registrationId }, ctx)).rejects.toMatchObject({ status: 400 });
    expect(m.where).toHaveBeenCalledWith({ conditions: expect.arrayContaining([
      { op: 'eq', column: 'reg.id', value: registrationId },
      { op: 'eq', column: 'reg.org', value: 'org-a' },
      { op: 'eq', column: 'reg.completed', value: true },
      { op: 'eq', column: 'reg.passed', value: true },
      { op: 'eq', column: 'reg.status', value: 'completed' },
      { op: 'isNull', column: 'reg.cancelled' },
    ]) });
  });

  it('refuses a completed course that does not issue certification', async () => {
    m.limit.mockResolvedValueOnce([{
      id: registrationId, memberId: 'member-a', courseId: 'course-a', sessionId: 'session-a',
    }]).mockResolvedValueOnce([]);
    await expect(beforeCreate({ registrationId }, ctx)).rejects.toMatchObject({ status: 400 });
    expect(m.select).toHaveBeenCalledTimes(2);
  });

  it('derives a pending candidate solely from completed training evidence', async () => {
    m.limit.mockResolvedValueOnce([{
      id: registrationId, memberId: 'member-a', courseId: 'course-a', sessionId: 'session-a',
    }]).mockResolvedValueOnce([{
      id: 'course-a', certificationName: 'Safety', courseName: 'Safety 101',
    }]);
    const result = await beforeCreate({ registrationId, organizationId: 'org-a', createdBy: 'steward-a' }, ctx);
    expect(result).toMatchObject({
      organizationId: 'org-a', memberId: 'member-a', courseId: 'course-a',
      sessionId: 'session-a', registrationId, certificationName: 'Safety',
      certificationStatus: 'pending_verification', verified: false,
      revoked: false, clcRegistered: false, verifiedBy: null,
      verificationDate: null, certificateUrl: null, digitalBadgeUrl: null,
    });
    expect(m.where).toHaveBeenCalledWith({ conditions: expect.arrayContaining([
      { op: 'eq', column: 'course.org', value: 'org-a' },
      { op: 'eq', column: 'course.certifies', value: true },
    ]) });
  });
});
