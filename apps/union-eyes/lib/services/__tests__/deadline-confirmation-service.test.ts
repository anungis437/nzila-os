import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Overriding a grievance deadline: a calendar day falls due at 23:59 that day in the organization's zone (read inside the same
 * tenant transaction as the write); a datetime is stored as given.
 */
const mocks = vi.hoisted(() => ({
  loadZone: vi.fn(),
  audit: vi.fn(),
  set: vi.fn(),
}));

vi.mock('@/lib/deadline-engine/organization-time-zone', () => ({ loadOrganizationTimeZone: mocks.loadZone }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.audit }));
vi.mock('@/lib/deadline-engine/deadline-scope', () => ({ deadlineInOrganization: () => undefined }));
vi.mock('@/db/schema/domains/claims/workflows', () => ({ grievanceDeadlines: { id: 'id', dueDate: 'due_date', calculatedDueDate: 'calculated_due_date', status: 'status' } }));
vi.mock('drizzle-orm', () => ({ and: () => undefined, eq: () => undefined, sql: () => undefined }));

const tx = {
  select: () => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 'd-1', dueDate: new Date('2026-03-10T03:59:00.000Z'), calculatedDueDate: null }] }) }) }),
  update: () => ({
    set: (values: Record<string, unknown>) => {
      mocks.set(values);
      return { where: () => ({ returning: async () => [{ id: 'd-1', calculatedDueDate: values.calculatedDueDate, ...values }] }) };
    },
  }),
};
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_context: unknown, fn: (t: typeof tx) => Promise<unknown>) => fn(tx),
}));

const { overrideDeadline } = await import('@/lib/services/deadline-confirmation-service');

const base = { organizationId: 'org-1', deadlineId: 'd-1', actorId: 'user-1', overrideReason: 'extension agreed' };

beforeEach(() => {
  vi.clearAllMocks();
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
