import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  select: vi.fn(),
  update: vi.fn(),
  updateSet: vi.fn(),
  updateWhere: vi.fn(),
  updateReturning: vi.fn(),
  eq: vi.fn((column: unknown, value: unknown) => ({ column, value })),
}));

vi.mock('@/lib/api/framework', async () => {
  const { z } = await import('zod');
  return {
    z,
    zUUID: z.string().uuid(),
    withApi: (_options: unknown, handler: unknown) => handler,
    ApiError: {
      forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }),
      badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }),
      notFound: (message: string) => Object.assign(new Error(message), { status: 404 }),
      conflict: (message: string) => Object.assign(new Error(message), { status: 409 }),
      notImplemented: (message: string) => Object.assign(new Error(message), { status: 501 }),
    },
  };
});
vi.mock('drizzle-orm', () => ({
  eq: m.eq,
  and: (...conditions: unknown[]) => conditions,
}));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));
vi.mock('@/db/schema', () => ({
  courseSessions: { id: 'sessions.id', organizationId: 'sessions.org' },
  courseRegistrations: {
    id: 'registrations.id', organizationId: 'registrations.org',
    sessionId: 'registrations.session', registrationStatus: 'registrations.status',
    memberId: 'registrations.member', attended: 'registrations.attended',
    attendanceHours: 'registrations.hours', completed: 'registrations.completed',
    cancellationDate: 'registrations.cancelled', requiresApproval: 'registrations.requires_approval',
    approvedBy: 'registrations.approved_by', updatedAt: 'registrations.updated',
  },
}));

const sessionId = 'e4e3e1cc-735e-4dc6-9100-74c1ce204b2d';
const registrationId = '8f5b2e6b-7b6d-4fb8-9f9c-33bbfe9825e1';
const active = {
  id: registrationId, registrationStatus: 'registered', completed: false,
  cancellationDate: null, requiresApproval: false, approvedBy: null,
  attendanceHours: '4.00',
};
const ctx = (body: unknown) => ({
  organizationId: 'org-a', userId: 'steward-a', params: { id: sessionId }, body,
});

function arrangeRead(registration: Record<string, unknown>) {
  m.select.mockImplementationOnce(() => ({
    from: () => ({ where: () => ({ limit: async () => [{ id: sessionId }] }) }),
  })).mockImplementationOnce(() => ({
    from: () => ({ where: () => ({
      limit: () => ({ for: async () => [registration] }),
    }) }),
  }));
}

describe('education attendance route authorization and transaction', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    m.withRLSContext.mockImplementation(async (_context: unknown, handler: (tx: unknown) => Promise<unknown>) =>
      handler({ select: m.select, update: m.update }));
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.update.mockReturnValue({ set: m.updateSet });
    m.updateSet.mockReturnValue({ where: m.updateWhere });
    m.updateWhere.mockReturnValue({ returning: m.updateReturning });
    m.updateReturning.mockResolvedValue([{ id: registrationId, attended: true }]);
  });

  it.each([
    { registrationStatus: 'cancelled' },
    { registrationStatus: 'waitlisted' },
    { registrationStatus: null },
    { completed: true },
    { completed: null },
    { cancellationDate: '2026-11-02' },
    { requiresApproval: true },
    { requiresApproval: null },
  ])('refuses ineligible registration before mutation and audit: %o', async override => {
    arrangeRead({ ...active, ...override });
    const { PATCH } = await import('../route');
    await expect((PATCH as any)(ctx({ registrationId, attended: true })))
      .rejects.toMatchObject({ status: 409 });
    expect(m.update).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('clears stale hours on absence and records mandatory tenant audit', async () => {
    arrangeRead(active);
    m.updateReturning.mockResolvedValue([{ id: registrationId, attended: false }]);
    const { PATCH } = await import('../route');
    const result = await (PATCH as any)(ctx({ registrationId, attended: false }));
    expect(result).toEqual({ data: { id: registrationId, attended: false } });
    expect(m.updateSet).toHaveBeenCalledWith(expect.objectContaining({
      attended: false, attendanceHours: null,
    }));
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(expect.anything(),
      expect.objectContaining({
        organizationId: 'org-a', userId: 'steward-a',
        resourceId: registrationId, action: 'education.attendance.record',
      }));
    expect(m.eq).toHaveBeenCalledWith('registrations.org', 'org-a');
    expect(m.eq).toHaveBeenCalledWith('registrations.session', sessionId);
  });

  it('refuses success when mandatory audit persistence fails', async () => {
    arrangeRead(active);
    m.persistAtomicAudit.mockRejectedValue(new Error('audit store unavailable'));
    const { PATCH } = await import('../route');
    await expect((PATCH as any)(ctx({ registrationId, attended: true })))
      .rejects.toThrow('audit store unavailable');
  });

  it('paginates a tenant-scoped roster without silently dropping the next page', async () => {
    const orderBy = vi.fn();
    const limit = vi.fn();
    const offset = vi.fn().mockResolvedValue(
      Array.from({ length: 101 }, (_, index) => ({
        id: `reg-${index}`, memberId: `member-${index}`,
        registrationStatus: 'registered', attended: false, completed: false,
      })),
    );
    m.select.mockImplementationOnce(() => ({
      from: () => ({ where: () => ({ limit: async () => [{ id: sessionId }] }) }),
    })).mockImplementationOnce(() => ({
      from: () => ({ where: () => ({ orderBy }) }),
    }));
    orderBy.mockReturnValue({ limit });
    limit.mockReturnValue({ offset });
    const { GET } = await import('../route');
    const result = await (GET as any)({ ...ctx(undefined), query: { page: 2 } });
    expect(limit).toHaveBeenCalledWith(101);
    expect(offset).toHaveBeenCalledWith(100);
    expect(result.registrations).toHaveLength(100);
    expect(result.pagination).toEqual({ page: 2, hasMore: true });
    expect(m.eq).toHaveBeenCalledWith('registrations.org', 'org-a');
    expect(m.eq).toHaveBeenCalledWith('registrations.session', sessionId);
  });
});
