import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  handlers: [] as Array<(ctx: any) => Promise<any>>,
  options: [] as Array<Record<string, any>>,
  rls: vi.fn(), audit: vi.fn(), select: vi.fn(), update: vi.fn(),
  readBuilder: {} as any, updateBuilder: {} as any,
  eq: vi.fn((column: unknown, value: unknown) => ({ op: 'eq', column, value })),
  isNull: vi.fn((column: unknown) => ({ op: 'isNull', column })),
  and: vi.fn((...conditions: unknown[]) => ({ conditions })),
}));
vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  const error = (status: number, message: string) => Object.assign(new Error(message), { status });
  return { z, withApi: (opts: Record<string, any>, handler: any) => {
    m.options.push(opts); m.handlers.push(handler); return handler;
  }, ApiError: {
    forbidden: (s: string) => error(403, s),
    conflict: (s: string) => error(409, s),
    notFound: (s: string) => error(404, s),
  } };
});
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.rls }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('drizzle-orm', () => ({
  eq: m.eq, and: m.and, isNull: m.isNull, desc: vi.fn((x: unknown) => x),
}));
vi.mock('@/db/schema', () => ({
  courseRegistrations: {
    id: 'reg.id', organizationId: 'reg.org', attended: 'reg.attended',
    passed: 'reg.passed', completed: 'reg.completed', memberId: 'reg.member',
    courseId: 'reg.course', registrationStatus: 'reg.status',
    cancellationDate: 'reg.cancelled', completionDate: 'reg.completionDate',
    certificateIssued: 'reg.certIssued',
  },
}));
const registrationId = '11111111-1111-4111-8111-111111111111';
const ctx = { organizationId: 'org-a', userId: 'steward-a', body: { registrationId } };
const good = () => ({
  id: registrationId, attended: true, passed: true, completed: false,
  registrationStatus: 'registered', cancellationDate: null,
  memberId: 'member-a', courseId: 'course-a',
});
describe('education completion attestation lifecycle', () => {
  let post: (ctx: typeof ctx) => Promise<any>;
  beforeEach(async () => {
    vi.clearAllMocks(); vi.resetModules(); m.options.length = 0; m.handlers.length = 0;
    m.readBuilder = { from: vi.fn(), where: vi.fn(), limit: vi.fn(), for: vi.fn() };
    m.readBuilder.from.mockReturnValue(m.readBuilder);
    m.readBuilder.where.mockReturnValue(m.readBuilder);
    m.readBuilder.limit.mockReturnValue(m.readBuilder);
    m.readBuilder.for.mockResolvedValue([good()]);
    m.updateBuilder = { set: vi.fn(), where: vi.fn(), returning: vi.fn() };
    m.updateBuilder.set.mockReturnValue(m.updateBuilder);
    m.updateBuilder.where.mockReturnValue(m.updateBuilder);
    m.updateBuilder.returning.mockResolvedValue([{ id: registrationId, completed: true }]);
    m.select.mockReturnValue(m.readBuilder);
    m.update.mockReturnValue(m.updateBuilder);
    m.audit.mockResolvedValue(undefined);
    m.rls.mockImplementation(async (_context: unknown, fn: (tx: any) => Promise<any>) =>
      fn({ select: m.select, update: m.update }));
    await import('../route');
    post = m.handlers[1];
  });

  it('requires steward role and a tenant context', async () => {
    expect(m.options[1]).toMatchObject({
      auth: { required: true, minRole: 'steward' }, requireOrg: true,
    });
    await expect(post({ ...ctx, organizationId: '' })).rejects.toMatchObject({ status: 403 });
    expect(m.rls).not.toHaveBeenCalled();
  });

  it.each([
    ['cancelled', { cancellationDate: '2026-11-01' }],
    ['waitlisted', { registrationStatus: 'waitlisted' }],
    ['unknown status', { registrationStatus: null }],
    ['withdrawn', { registrationStatus: 'cancelled' }],
    ['already completed', { completed: true, registrationStatus: 'completed' }],
  ])('refuses %s registration before mutation or audit', async (_label, override) => {
    m.readBuilder.for.mockResolvedValueOnce([{ ...good(), ...override }]);
    await expect(post(ctx)).rejects.toMatchObject({ status: 409 });
    expect(m.update).not.toHaveBeenCalled();
    expect(m.audit).not.toHaveBeenCalled();
  });

  it('does not turn an unattended or failed registration into a completion', async () => {
    m.readBuilder.for.mockResolvedValueOnce([{ ...good(), attended: false }]);
    await expect(post(ctx)).rejects.toMatchObject({ status: 403 });
    expect(m.update).not.toHaveBeenCalled();
  });

  it('updates only a still-active registration and audits within the tenant transaction', async () => {
    const result = await post(ctx);
    expect(result).toEqual({ data: { id: registrationId, completed: true } });
    expect(m.rls.mock.calls[0][0]).toEqual({ organizationId: 'org-a', userId: 'steward-a' });
    expect(m.readBuilder.for).toHaveBeenCalledWith('update');
    expect(m.updateBuilder.where).toHaveBeenCalledWith({ conditions: expect.arrayContaining([
      { op: 'eq', column: 'reg.org', value: 'org-a' },
      { op: 'eq', column: 'reg.id', value: registrationId },
      { op: 'eq', column: 'reg.status', value: 'registered' },
      { op: 'isNull', column: 'reg.cancelled' },
    ]) });
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({ select: m.select, update: m.update }),
      expect.objectContaining({
        action: 'education.registration.complete', organizationId: 'org-a',
        userId: 'steward-a', resourceId: registrationId,
      }),
    );
  });

  it('fails closed when atomic audit fails', async () => {
    m.audit.mockRejectedValueOnce(new Error('audit unavailable'));
    await expect(post(ctx)).rejects.toThrow('audit unavailable');
  });
});
