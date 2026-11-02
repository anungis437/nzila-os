import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({
  options: [] as Array<Record<string, any>>, rls: vi.fn(), audit: vi.fn(),
  select: vi.fn(), builder: {} as any, rows: [] as any[],
}));
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  const err = (status: number, message: string) => Object.assign(new Error(message), { status });
  return { z, withApi: (opts: Record<string, any>, handler: unknown) => { m.options.push(opts); return handler; },
    ApiError: { forbidden: (s: string) => err(403, s), notFound: (s: string) => err(404, s) } };
});
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.rls }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/db/schema', () => ({
  courseRegistrations: { id: 'r.id', organizationId: 'r.org', memberId: 'r.member', courseId: 'r.course',
    sessionId: 'r.session', registrationStatus: 'r.status', requiresApproval: 'r.approval',
    approvedBy: 'r.approvedBy', cancellationDate: 'r.cancelled' },
  courseSessions: { id: 's.id', courseId: 's.course', organizationId: 's.org', sessionStatus: 's.status',
    startDate: 's.start', endDate: 's.end', virtualMeetingUrl: 's.url', virtualMeetingAccessCode: 's.code' },
}));
vi.mock('drizzle-orm', () => ({ eq: (column: unknown, value: unknown) => ({ column, value }),
  and: (...conditions: unknown[]) => ({ conditions }) }));
const sessionId = '11111111-1111-4111-8111-111111111111';
const good = () => ({ registrationId: '22222222-2222-4222-8222-222222222222',
  registrationStatus: 'registered', requiresApproval: false, approvedBy: null, cancellationDate: null,
  sessionStatus: 'scheduled', startDate: '2026-11-02', endDate: '2026-11-03',
  virtualMeetingUrl: 'https://meet.example.test/room?token=PRIVATE', virtualMeetingAccessCode: 'SECRET' });
const ctx = () => ({ organizationId: 'org-a', userId: 'member-a', query: { sessionId } });
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-02T14:00:00Z'));
  m.options.length = 0; m.rows = [good()]; m.audit.mockReset().mockResolvedValue(undefined);
  m.builder = { from: vi.fn(), innerJoin: vi.fn(), where: vi.fn(), limit: vi.fn() };
  m.builder.from.mockReturnValue(m.builder); m.builder.innerJoin.mockReturnValue(m.builder);
  m.builder.where.mockReturnValue(m.builder); m.builder.limit.mockImplementation(async () => m.rows);
  m.select.mockReset().mockReturnValue(m.builder);
  m.rls.mockReset().mockImplementation(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({ select: m.select }));
});
afterEach(() => vi.useRealTimers());
describe('registration-scoped education join credentials', () => {
  it('requires identity and tenant; rejects malformed or extra query fields', async () => {
    const { GET } = await import('../route');
    expect(m.options[0]).toMatchObject({ auth: { required: true, minRole: 'member' }, requireOrg: true });
    for (const bad of [{}, { sessionId: 'invalid' }, { sessionId, organizationId: 'foreign' }])
      expect(m.options[0].query.safeParse(bad).success).toBe(false);
    expect(m.options[0].query.safeParse({ sessionId }).success).toBe(true);
    await expect((GET as any)({ ...ctx(), userId: null })).rejects.toMatchObject({ status: 403 });
    await expect((GET as any)({ ...ctx(), organizationId: null })).rejects.toMatchObject({ status: 403 });
    expect(m.rls).not.toHaveBeenCalled();
  });
  it('requires exact tenant, registrant, session and course join; audits before release', async () => {
    const { GET } = await import('../route');
    expect(await (GET as any)(ctx())).toEqual({ sessionId, joinUrl: good().virtualMeetingUrl, accessCode: 'SECRET' });
    expect(m.rls.mock.calls[0][0]).toEqual({ organizationId: 'org-a', userId: 'member-a' });
    expect(m.builder.where).toHaveBeenCalledWith({ conditions: [
      { column: 'r.org', value: 'org-a' }, { column: 's.org', value: 'org-a' },
      { column: 'r.member', value: 'member-a' }, { column: 'r.session', value: sessionId },
    ] });
    expect(m.builder.innerJoin).toHaveBeenCalledWith(expect.anything(), { conditions: [
      { column: 's.id', value: 'r.session' }, { column: 's.course', value: 'r.course' },
      { column: 's.org', value: 'r.org' },
    ] });
    expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({ select: m.select }),
      { organizationId: 'org-a', userId: 'member-a', action: 'education.session.join_credentials_read',
        resourceType: 'course_sessions', resourceId: sessionId, details: { registrationId: good().registrationId } });
    expect(JSON.stringify(m.audit.mock.calls)).not.toContain('PRIVATE');
    expect(JSON.stringify(m.audit.mock.calls)).not.toContain('SECRET');
  });
  it.each([
    ['foreign or missing registration', null], ['cancelled registration', { cancellationDate: '2026-11-01' }],
    ['waitlisted', { registrationStatus: 'waitlisted' }], ['completed', { registrationStatus: 'completed' }],
    ['unapproved', { requiresApproval: true, approvedBy: null }],
    ['cancelled session', { sessionStatus: 'cancelled' }],
    ['early', { startDate: '2026-11-03' }], ['expired', { endDate: '2026-11-01' }],
    ['no URL', { virtualMeetingUrl: null }], ['HTTP URL', { virtualMeetingUrl: 'http://meet.example.test' }],
    ['URL credentials', { virtualMeetingUrl: 'https://u:p@meet.example.test' }],
    ['invalid URL', { virtualMeetingUrl: 'bad' }],
  ])('refuses %s without disclosing or auditing', async (_name, override) => {
    m.rows = override === null ? [] : [{ ...good(), ...override }];
    const { GET } = await import('../route');
    await expect((GET as any)(ctx())).rejects.toMatchObject({ status: 404 });
    expect(m.audit).not.toHaveBeenCalled();
  });
  it('permits approved registrants on the final UTC date', async () => {
    m.rows = [{ ...good(), requiresApproval: true, approvedBy: 'officer' }];
    vi.setSystemTime(new Date('2026-11-03T23:59:59Z'));
    const { GET } = await import('../route');
    await expect((GET as any)(ctx())).resolves.toHaveProperty('accessCode', 'SECRET');
  });
  it('fails closed on audit storage error', async () => {
    m.audit.mockRejectedValueOnce(new Error('audit unavailable'));
    const { GET } = await import('../route');
    await expect((GET as any)(ctx())).rejects.toThrow('audit unavailable');
  });
});
