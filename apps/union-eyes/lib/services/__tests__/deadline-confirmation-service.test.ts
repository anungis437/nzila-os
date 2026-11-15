import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';

/**
 * Overriding a grievance deadline: a calendar day falls due at 23:59 that day in the organization's zone (read inside the same
 * tenant transaction as the write); a datetime is stored as given.
 */
const mocks = vi.hoisted(() => ({
  loadZone: vi.fn(),
  audit: vi.fn(),
  set: vi.fn(),
  decide: vi.fn(),
  filing: vi.fn(),
  authorize: vi.fn(),
  schedule: vi.fn(),
  execute: vi.fn(),
  lockParent: vi.fn(),
  lockDeadline: vi.fn(),
  current: null as Record<string, unknown> | null,
}));

vi.mock('@/lib/cases/case-authorization', () => ({ requireCaseFilingCapacity: mocks.filing, requireKernelCaseAction: mocks.authorize }));
vi.mock('@/lib/authority/store/route-adapter', () => ({ decideCase: mocks.decide }));
vi.mock('@/lib/deadline-engine/reminder-scheduler', () => ({ scheduleGrievanceDeadlineReminders: mocks.schedule }));
vi.mock('@/lib/deadline-engine/organization-time-zone', () => ({ loadOrganizationTimeZone: mocks.loadZone }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.audit }));
vi.mock('@/lib/deadline-engine/deadline-scope', () => ({ deadlineInOrganization: () => undefined }));
vi.mock('@/db/schema/domains/claims/workflows', () => ({ grievanceDeadlines: { id: 'id', grievanceId: 'grievance_id', deadlineType: 'deadline_type', dueDate: 'due_date', calculatedDueDate: 'calculated_due_date', status: 'status' } }));
vi.mock('@/db/schema/domains/claims/grievances', () => ({ grievances: { id: 'parent_id', organizationId: 'organization_id' } }));
vi.mock('drizzle-orm', () => ({ and: () => undefined, eq: () => undefined, sql: () => undefined }));

const tx = {
  execute: mocks.execute,
  select: () => ({ from: (table: { id: string }) => ({ where: () => ({ limit: () => Object.assign(Promise.resolve(mocks.current ? [mocks.current] : []), {
    for: (mode: string) => table.id === 'parent_id' ? mocks.lockParent(mode) : mocks.lockDeadline(mode),
  }) }) }) }),
  update: () => ({
    set: (values: Record<string, unknown>) => {
      mocks.set(values);
      return { where: () => ({ returning: async () => [{ ...mocks.current, id: 'd-1', calculatedDueDate: values.calculatedDueDate, ...values }] }) };
    },
  }),
};
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_context: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
}));

const { confirmDeadline, overrideDeadline, supersedeDeadline } = await import('@/lib/services/deadline-confirmation-service');

const base = { organizationId: 'org-1', deadlineId: 'd-1', actorId: 'user-1', overrideReason: 'extension agreed' };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.current = { id: 'd-1', grievanceId: 'g-1', status: 'pending', dueDate: new Date('2026-03-10T03:59:00.000Z'), calculatedDueDate: null };
  mocks.lockParent.mockImplementation(async () => [{ id: 'g-1' }]);
  mocks.lockDeadline.mockImplementation(async () => mocks.current ? [{ ...mocks.current }] : []);
  mocks.decide.mockResolvedValue({ effect: 'allow' }); mocks.filing.mockResolvedValue(undefined); mocks.authorize.mockResolvedValue(undefined); mocks.schedule.mockResolvedValue(undefined); mocks.audit.mockResolvedValue(undefined);
  mocks.loadZone.mockResolvedValue({ timeZone: 'America/St_Johns', source: 'province_territory' });
});

describe('overrideDeadline', () => {
  it('stores a calendar day as 23:59 that day in the organization zone, in both due columns', async () => {
    await overrideDeadline({ ...base, overrideDueDate: '2026-03-20' });
    expect(mocks.loadZone).toHaveBeenCalledWith('org-1');
    const written = mocks.set.mock.calls[0][0];
    const due = new Date('2026-03-21T02:29:00.000Z'); // 23:59 NDT (UTC-2:30)
    expect(written.overrideDueDate).toEqual(due);
    expect(written.dueDate).toEqual(due);
    expect(mocks.audit.mock.calls[0][1].details.overrideDueDate).toBe(due.toISOString());
  });

  it('stores a datetime as given and does not read the organization', async () => {
    const instant = new Date('2026-03-20T15:30:00.000Z');
    await overrideDeadline({ ...base, overrideDueDate: instant });
    expect(mocks.loadZone).not.toHaveBeenCalled();
    expect(mocks.set.mock.calls[0][0].dueDate).toBe(instant);
  });

  it('refuses a day that does not exist', async () => {
    await expect(overrideDeadline({ ...base, overrideDueDate: '2026-02-30' })).rejects.toThrow(RangeError);
    expect(mocks.set).not.toHaveBeenCalled();
  });
});


describe('confirmation routes share case-specific management authority', () => {
  it.each(['confirm', 'override', 'supersede'])('refuses unreadable cases through %s before any mutation', async action => {
    mocks.decide.mockResolvedValue({ effect: 'deny' });
    const result = action === 'confirm' ? await confirmDeadline(base) : action === 'supersede' ? await supersedeDeadline(base) : await overrideDeadline({ ...base, overrideDueDate: '2026-03-20' });
    expect(result).toBeNull(); expect(mocks.set).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it('a role title or readable case does not replace explicit internal and draft-action authority', async () => {
    mocks.authorize.mockRejectedValueOnce(ApiError.forbidden());
    await expect(confirmDeadline(base)).rejects.toMatchObject({ code: 'FORBIDDEN' }); expect(mocks.set).not.toHaveBeenCalled();
  });
  it('requires canonical handler eligibility and both kernel actions on the owning grievance', async () => {
    await confirmDeadline(base);
    expect(mocks.filing).toHaveBeenCalledWith(tx, { organizationId: 'org-1', userId: 'user-1' }, 'handler');
    expect(mocks.authorize.mock.calls.map(call => call.slice(1))).toEqual([
      [{ organizationId: 'org-1', userId: 'user-1' }, 'g-1', 'case:read_internal'],
      [{ organizationId: 'org-1', userId: 'user-1' }, 'g-1', 'case:draft_action'],
    ]);
  });
  it('does not override a completed or cancelled record', async () => {
    mocks.current!.status = 'completed';
    await expect(overrideDeadline({ ...base, overrideDueDate: '2026-03-20' })).rejects.toMatchObject({ code: 'CONFLICT' }); expect(mocks.set).not.toHaveBeenCalled();
  });
  it('reschedules existing reminders on override and propagates scheduling failure', async () => {
    mocks.schedule.mockRejectedValueOnce(new Error('schedule unavailable'));
    await expect(overrideDeadline({ ...base, overrideDueDate: '2026-03-20' })).rejects.toThrow('schedule unavailable');
    expect(mocks.schedule).toHaveBeenCalledWith(expect.objectContaining({ sourceDeadlineId: 'd-1', grievanceId: 'g-1' }));
  });
  it('retires reminder leases on supersession while retaining the source record', async () => {
    await supersedeDeadline(base); expect(mocks.execute).toHaveBeenCalled(); expect(mocks.audit).toHaveBeenCalled();
  });
});


it('requires separate disclosure authority before changing a member-visible manual deadline', async () => {
  mocks.current = { id: 'd-1', grievanceId: 'g-1', status: 'pending', deadlineType: 'ue_case_member_deadline_v1' };
  mocks.decide.mockResolvedValueOnce({ effect: 'allow' }).mockResolvedValueOnce({ effect: 'deny' });
  await expect(confirmDeadline(base)).rejects.toMatchObject({ code: 'FORBIDDEN' }); expect(mocks.set).not.toHaveBeenCalled();
});

describe('parent locking and authoritative reread', () => {
  async function whileParentLocked(change: () => void, run = () => confirmDeadline(base)) {
    let release!: () => void;
    let entered!: () => void;
    const blocked = new Promise<void>(resolve => { entered = resolve; });
    const released = new Promise<void>(resolve => { release = resolve; });
    mocks.lockParent.mockImplementationOnce(async () => { entered(); await released; return [{ id: 'g-1' }]; });
    const pending = run();
    // Attach a rejection handler before releasing a conflicting state change.
    const result = pending.then(value => ({ value }), error => ({ error }));
    try {
      await blocked;
      expect(mocks.lockParent).toHaveBeenCalledWith('update');
      for (const action of [mocks.lockDeadline, mocks.decide, mocks.filing, mocks.authorize, mocks.set, mocks.audit, mocks.schedule]) expect(action).not.toHaveBeenCalled();
      change();
    } finally { release(); }
    return result;
  }

  it('decides authority after a competing reassignment has released the parent', async () => {
    const result = await whileParentLocked(() => { mocks.decide.mockResolvedValue({ effect: 'deny' }); });
    expect(result).toEqual({ value: null });
    expect(mocks.lockDeadline).toHaveBeenCalledWith('update');
    expect(mocks.lockParent.mock.invocationCallOrder[0]).toBeLessThan(mocks.lockDeadline.mock.invocationCallOrder[0]);
    expect(mocks.lockDeadline.mock.invocationCallOrder[0]).toBeLessThan(mocks.decide.mock.invocationCallOrder[0]);
    expect(mocks.set).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('uses the locked terminal state rather than the discovery snapshot', async () => {
    const result = await whileParentLocked(() => { mocks.current!.status = 'completed'; });
    expect(result).toMatchObject({ error: { code: 'CONFLICT' } });
    expect(mocks.set).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('checks member disclosure using the classification reread after waiting', async () => {
    const result = await whileParentLocked(() => {
      mocks.current!.deadlineType = 'ue_case_member_deadline_v1';
      mocks.decide.mockResolvedValueOnce({ effect: 'allow' }).mockResolvedValueOnce({ effect: 'deny' });
    });
    expect(result).toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(mocks.set).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });

  it('returns not found if the scoped parent disappears before its lock is obtained', async () => {
    mocks.lockParent.mockResolvedValueOnce([]);
    expect(await confirmDeadline(base)).toBeNull();
    expect(mocks.lockDeadline).not.toHaveBeenCalled(); expect(mocks.decide).not.toHaveBeenCalled(); expect(mocks.set).not.toHaveBeenCalled();
  });

  it('returns not found for an absent or foreign-organization discovery before taking locks or deciding authority', async () => {
    mocks.current = null;
    expect(await confirmDeadline(base)).toBeNull();
    expect(mocks.lockParent).not.toHaveBeenCalled(); expect(mocks.lockDeadline).not.toHaveBeenCalled(); expect(mocks.decide).not.toHaveBeenCalled(); expect(mocks.set).not.toHaveBeenCalled();
  });

  it('returns not found if the deadline disappears or changes parent while waiting', async () => {
    const result = await whileParentLocked(() => { mocks.lockDeadline.mockResolvedValueOnce([]); });
    expect(result).toEqual({ value: null });
    expect(mocks.decide).not.toHaveBeenCalled(); expect(mocks.set).not.toHaveBeenCalled();
  });
});
