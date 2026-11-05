import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  crudRoutes: vi.fn(),
  assertOrganizationOwns: vi.fn(),
}));

vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: m.crudRoutes }));
vi.mock('@/lib/api/org-references', () => ({ assertOrganizationOwns: m.assertOrganizationOwns }));
vi.mock('@/lib/api/errors', () => ({
  ApiError: {
    badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }),
    forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }),
  },
}));
vi.mock('@/db/schema', () => ({
  courseSessions: { id: 'session.id' },
  trainingCourses: { id: 'course.id' },
}));

const valid = () => ({
  courseId: 'course-a',
  sessionCode: 'SESSION-1',
  startDate: '2026-11-05',
  endDate: '2026-11-06',
  deliveryMethod: 'virtual',
  registrationOpenDate: '2026-10-01',
  registrationCloseDate: '2026-11-05',
  maxEnrollment: 25,
  virtualMeetingUrl: 'https://meet.example.test/room?token=PRIVATE',
});

describe('education session creation integrity', () => {
  let beforeCreate: (values: Record<string, unknown>, ctx: { organizationId: string }) => Promise<Record<string, unknown>>;
  let options: Record<string, any>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    m.assertOrganizationOwns.mockResolvedValue(undefined);
    m.crudRoutes.mockImplementation((opts: Record<string, any>) => {
      options = opts;
      beforeCreate = opts.beforeCreate;
      return { GET: vi.fn(), POST: vi.fn() };
    });
    await import('../route');
  });

  it('enforces a tenant-owned course and preserves legitimate scheduling details', async () => {
    const values = valid();
    expect(await beforeCreate(values, { organizationId: 'org-a' })).toEqual(values);
    expect(m.assertOrganizationOwns).toHaveBeenCalledWith([
      { field: 'courseId', value: 'course-a', table: { id: 'course.id' } },
    ], 'org-a');
    expect(options.writableFields).not.toContain('sessionStatus');
    for (const field of ['sessionBudget', 'actualCost', 'registrationCount', 'attendeesCount']) {
      expect(options.writableFields).not.toContain(field);
    }
  });

  it.each([
    ['missing start date', { startDate: undefined }],
    ['impossible date', { startDate: '2026-02-30' }],
    ['non-leap February 29', { endDate: '2027-02-29' }],
    ['ambiguous timestamp', { startDate: '2026-11-05T10:00:00' }],
    ['numeric date', { startDate: 20261105 }],
    ['reversed session dates', { endDate: '2026-11-04' }],
    ['reversed registration window', { registrationOpenDate: '2026-11-06' }],
    ['registration after session', { registrationCloseDate: '2026-11-07' }],
    ['zero capacity', { maxEnrollment: 0 }],
    ['negative capacity', { maxEnrollment: -1 }],
    ['fractional capacity', { maxEnrollment: 1.5 }],
    ['string capacity', { maxEnrollment: '10' }],
    ['oversized capacity', { maxEnrollment: 100001 }],
    ['javascript meeting URL', { virtualMeetingUrl: 'javascript:alert(1)' }],
    ['HTTP meeting URL', { virtualMeetingUrl: 'http://meet.example.test/room' }],
    ['URL embedded credentials', { virtualMeetingUrl: 'https://user:pass@meet.example.test/room' }],
    ['malformed meeting URL', { virtualMeetingUrl: 'not a url' }],
    ['blank session code', { sessionCode: ' ' }],
    ['oversized session code', { sessionCode: 'x'.repeat(51) }],
    ['blank delivery method', { deliveryMethod: '' }],
    ['oversized access code', { virtualMeetingAccessCode: 'x'.repeat(51) }],
  ])('refuses %s before tenant lookup or insertion', async (_name, override) => {
    await expect(beforeCreate({ ...valid(), ...override }, { organizationId: 'org-a' }))
      .rejects.toMatchObject({ status: 400 });
    expect(m.assertOrganizationOwns).not.toHaveBeenCalled();
  });

  it('accepts leap days, single-day sessions, optional null dates and unlimited capacity', async () => {
    const values = {
      ...valid(),
      startDate: '2028-02-29',
      endDate: '2028-02-29',
      registrationOpenDate: null,
      registrationCloseDate: null,
      maxEnrollment: null,
      virtualMeetingUrl: null,
    };
    await expect(beforeCreate(values, { organizationId: 'org-a' })).resolves.toEqual(values);
    expect(m.assertOrganizationOwns).toHaveBeenCalledTimes(1);
  });

  it('does not treat a missing organization as authorization to inspect another tenant course', async () => {
    await expect(beforeCreate(valid(), { organizationId: '' })).rejects.toMatchObject({ status: 403 });
    expect(m.assertOrganizationOwns).not.toHaveBeenCalled();
  });
});
