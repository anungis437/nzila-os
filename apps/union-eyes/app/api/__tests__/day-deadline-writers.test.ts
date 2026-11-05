import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The generic deadline writers (claim_deadlines through POST /api/deadlines and POST /api/deadlines/compliance; arbitration deadlines
 * through POST /api/arbitrations and PATCH /api/arbitrations/{id}): a due date sent as a calendar day falls due at 23:59 that day in the
 * organization's zone, and a datetime is stored as sent. The crud factory is replaced by a recorder so each route's hook runs as written.
 */
const mocks = vi.hoisted(() => ({
  options: new Map<string, Record<string, any>>(),
  current: '',
  /** Records each read of the organization row. */
  loadZone: vi.fn(),
  assertOrganizationOwns: vi.fn(),
  mayWriteArbitrationFor: vi.fn(),
}));

vi.mock('@/lib/api/crud-factory', () => ({
  crudRoutes: (options: Record<string, unknown>) => {
    mocks.options.set(mocks.current, options);
    return { GET: vi.fn(), POST: vi.fn(), PATCH: vi.fn(), DELETE: vi.fn() };
  },
}));
// The real resolver runs against a database stub that returns the organization row: no settings.timezone, province BC.
vi.mock('@/db', () => ({
  db: {
    select: (columns: Record<string, unknown>) => ({
      from: () => ({
        where: (condition: unknown) => ({
          limit: async () => {
            mocks.loadZone(columns, condition);
            return [{ settings: {}, provinceTerritory: 'BC', address: null }];
          },
        }),
      }),
    }),
  },
}));
vi.mock('@/db/schema', () => ({ deadlines: {}, arbitrations: {}, grievances: {} }));
vi.mock('@/lib/api/org-references', () => ({ assertOrganizationOwns: mocks.assertOrganizationOwns }));
vi.mock('@/lib/arbitration/arbitration-case-authority', () => ({ mayWriteArbitrationFor: mocks.mayWriteArbitrationFor }));

async function load(route: string): Promise<Record<string, any>> {
  mocks.current = route;
  if (route === 'deadlines') await import('@/app/api/deadlines/route');
  if (route === 'compliance') await import('@/app/api/deadlines/compliance/route');
  if (route === 'arbitrations') await import('@/app/api/arbitrations/route');
  if (route === 'arbitration') await import('@/app/api/arbitrations/[id]/route');
  const options = mocks.options.get(route);
  if (!options) throw new Error(`no crud options recorded for ${route}`);
  return options;
}

const ORG = '00000000-0000-0000-0000-0000000000aa';

beforeEach(() => {
  mocks.loadZone.mockReset();
  mocks.assertOrganizationOwns.mockResolvedValue(undefined);
  mocks.mayWriteArbitrationFor.mockResolvedValue(true);
});

describe.each(['deadlines', 'compliance'])('POST claim deadline (%s route)', (route) => {
  it('stores a calendar-day due date at 23:59 that day in the organization zone', async () => {
    const { beforeCreate } = await load(route);
    const values = await beforeCreate(
      { dueDate: '2026-03-04', originalDeadline: '2026-03-02', eventDate: '2026-02-20', deadlineName: 'Step 1 reply' },
      { organizationId: ORG, userId: 'u-1' },
    );
    expect(mocks.loadZone).toHaveBeenCalledTimes(1);
    expect(values.dueDate).toEqual(new Date('2026-03-05T07:59:00.000Z')); // 23:59 PST
    expect(values.originalDeadline).toEqual(new Date('2026-03-03T07:59:00.000Z'));
    expect(values.eventDate).toBe('2026-02-20'); // the triggering event is not a deadline
  });

  it('keeps a datetime as sent and does not read the organization when no field is a bare day', async () => {
    const { beforeCreate } = await load(route);
    const sent = { dueDate: '2026-03-04T17:00:00.000Z', originalDeadline: '2026-03-04T17:00:00.000Z' };
    expect(await beforeCreate(sent, { organizationId: ORG, userId: 'u-1' })).toEqual(sent);
    expect(mocks.loadZone).not.toHaveBeenCalled();
  });

  it('leaves a day that does not exist for the write path to refuse', async () => {
    const { beforeCreate } = await load(route);
    const values = await beforeCreate({ dueDate: '2026-02-30', originalDeadline: '2026-02-27' }, { organizationId: ORG, userId: 'u-1' });
    expect(values.dueDate).toBe('2026-02-30');
    expect(values.originalDeadline).toEqual(new Date('2026-02-28T07:59:00.000Z'));
  });
});

describe('arbitration deadlines', () => {
  it('POST: a calendar-day deadline falls due at 23:59 in the organization zone after the case checks pass', async () => {
    const { beforeCreate } = await load('arbitrations');
    const values = await beforeCreate(
      { grievanceId: 'g-1', submissionDeadline: '2026-07-10', awardDeadline: '2026-08-01T16:00:00Z', scheduledDate: '2026-07-20' },
      { organizationId: ORG, userId: 'u-1' },
    );
    expect(mocks.mayWriteArbitrationFor).toHaveBeenCalled();
    expect(values.submissionDeadline).toEqual(new Date('2026-07-11T06:59:00.000Z')); // 23:59 PDT
    expect(values.awardDeadline).toBe('2026-08-01T16:00:00Z');
    expect(values.scheduledDate).toBe('2026-07-20'); // a hearing is an appointment, not a deadline
  });

  it('PATCH: a calendar-day deadline falls due at 23:59 in the organization zone', async () => {
    const { beforeUpdate } = await load('arbitration');
    const updates = await beforeUpdate({ replyDeadline: '2026-06-15' }, { id: 'a-1', organizationId: ORG, userId: 'u-1', existing: {} });
    expect(updates.replyDeadline).toEqual(new Date('2026-06-16T06:59:00.000Z')); // 23:59 PDT
  });
});
