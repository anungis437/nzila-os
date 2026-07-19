import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  queue: [] as unknown[],
  createAuditLog: vi.fn(),
}));

function makeChain() {
  const c: Record<string, unknown> = {};
  for (const m of [
    'select', 'from', 'where', 'orderBy', 'limit', 'offset', 'leftJoin', 'groupBy',
    'insert', 'update', 'delete', 'values', 'set', 'returning',
  ]) {
    c[m] = vi.fn(() => c);
  }
  (c as { then: (resolve: (v: unknown) => void) => void }).then = (resolve) => {
    resolve(h.queue.shift() ?? []);
  };
  return c;
}

const chain = makeChain();

vi.mock('@/db', () => ({
  db: {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    delete: vi.fn(() => chain),
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(() => 'eq'),
  and: vi.fn(() => 'and'),
  desc: vi.fn(() => 'desc'),
  asc: vi.fn(() => 'asc'),
  sql: Object.assign(vi.fn(() => 'sql'), { raw: vi.fn(() => 'sql') }),
  inArray: vi.fn(() => 'inArray'),
  between: vi.fn(() => 'between'),
  relations: vi.fn(() => ({})),
}));

vi.mock('../audit-service', () => ({
  createAuditLog: h.createAuditLog,
}));

vi.mock('@/db/schema', () => {
  const t = (name: string) => new Proxy({}, { get: (_t, p) => `${name}.${String(p)}` });
  return {
    committeeMeetings: t('committeeMeetings'),
    committeeMeetingAttendees: t('committeeMeetingAttendees'),
    committeeActionItems: t('committeeActionItems'),
    committeeDocuments: t('committeeDocuments'),
    committeeIntelligenceSnapshots: t('committeeIntelligenceSnapshots'),
  };
});

import {
  createMeeting,
  getMeeting,
  listMeetings,
  updateMeeting,
  recordMinutes,
  approveMinutes,
  recordAttendance,
  getMeetingAttendees,
  createActionItem,
  listActionItems,
  updateActionItem,
  carryForwardActionItems,
  linkDocument,
  listCommitteeDocuments,
  removeDocument,
  createIntelligenceSnapshot,
  listIntelligenceSnapshots,
  gatherCrossCommitteeMinutes,
  getCommitteeStats,
} from '../committee-workspace-service';

beforeEach(() => {
  h.queue = [];
  h.createAuditLog.mockReset();
});

describe('committee-workspace-service', () => {
  it('createMeeting inserts and optionally attendees + audit', async () => {
    h.queue = [[{ id: 'm1', committeeId: 'c1', organizationId: 'o1' }], []];
    const result = await createMeeting({
      committeeId: 'c1',
      organizationId: 'o1',
      title: 'Weekly',
      meetingDate: new Date(),
      status: 'scheduled',
      createdBy: 'u1',
      attendeeIds: ['u2', 'u3'],
    } as never);
    expect(result.id).toBe('m1');
    expect(h.createAuditLog).toHaveBeenCalled();
  });

  it('getMeeting returns first or null', async () => {
    h.queue = [[{ id: 'm1' }]];
    expect(await getMeeting('m1')).toEqual({ id: 'm1' });
    h.queue = [[]];
    expect(await getMeeting('missing')).toBeNull();
  });

  it('listMeetings handles status/limit/offset', async () => {
    h.queue = [[{ id: 'm1' }]];
    expect(await listMeetings('c1', { status: 'scheduled', limit: 10, offset: 5 })).toEqual([{ id: 'm1' }]);
  });

  it('updateMeeting returns updated or null', async () => {
    h.queue = [[{ id: 'm1', title: 'Updated' }]];
    expect(await updateMeeting('m1', { title: 'Updated', updatedBy: 'u1' } as never)).toEqual({ id: 'm1', title: 'Updated' });
    h.queue = [[]];
    expect(await updateMeeting('m1', { title: 'x' } as never)).toBeNull();
  });

  it('recordMinutes updates, audits, and returns nullable', async () => {
    h.queue = [[{ id: 'm1', committeeId: 'c1', organizationId: 'o1' }]];
    expect(await recordMinutes('m1', 'minutes', 'u1')).toEqual({ id: 'm1', committeeId: 'c1', organizationId: 'o1' });
    expect(h.createAuditLog).toHaveBeenCalled();

    h.queue = [[]];
    expect(await recordMinutes('m2', 'minutes', 'u1')).toBeNull();
  });

  it('approveMinutes updates, audits, and returns nullable', async () => {
    h.queue = [[{ id: 'm1', committeeId: 'c1', organizationId: 'o1' }]];
    expect(await approveMinutes('m1', 'u1')).toEqual({ id: 'm1', committeeId: 'c1', organizationId: 'o1' });
    expect(h.createAuditLog).toHaveBeenCalled();

    h.queue = [[]];
    expect(await approveMinutes('m2', 'u1')).toBeNull();
  });

  it('recordAttendance upserts and updates meeting attendeeCount', async () => {
    // attendee1 existing select, attendee1 update, attendee2 missing select, attendee2 insert, update meeting
    h.queue = [
      [{ id: 'a1' }],
      [],
      [],
      [],
      [],
    ];
    await expect(recordAttendance('m1', [
      { memberId: 'u1', attended: true },
      { memberId: 'u2', attended: false, regrets: true },
    ])).resolves.toBeUndefined();
  });

  it('getMeetingAttendees returns rows', async () => {
    h.queue = [[{ id: 'a1' }]];
    expect(await getMeetingAttendees('m1')).toEqual([{ id: 'a1' }]);
  });

  it('createActionItem inserts and audits', async () => {
    h.queue = [[{ id: 'ai1' }]];
    const result = await createActionItem({
      committeeId: 'c1', organizationId: 'o1', meetingId: 'm1', title: 'Do thing',
      status: 'pending', priority: 'high', createdBy: 'u1',
    } as never);
    expect(result.id).toBe('ai1');
    expect(h.createAuditLog).toHaveBeenCalled();
  });

  it('listActionItems supports default and explicit filters', async () => {
    h.queue = [[{ id: 'ai1' }]];
    expect(await listActionItems('c1')).toEqual([{ id: 'ai1' }]);

    h.queue = [[{ id: 'ai2' }]];
    expect(await listActionItems('c1', { status: 'pending', assignedTo: 'u1', includeCompleted: true })).toEqual([{ id: 'ai2' }]);
  });

  it('updateActionItem sets completed fields for completed status', async () => {
    h.queue = [[{ id: 'ai1', status: 'completed' }]];
    expect(await updateActionItem('ai1', { status: 'completed', updatedBy: 'u1' } as never)).toEqual({ id: 'ai1', status: 'completed' });

    h.queue = [[]];
    expect(await updateActionItem('missing', { status: 'pending' } as never)).toBeNull();
  });

  it('carryForwardActionItems clones open items and defers originals', async () => {
    h.queue = [
      [
        { id: 'i1', committeeId: 'c1', organizationId: 'o1', title: 'T1', description: 'D1', status: 'pending', priority: 'high', assignedTo: 'u1', dueDate: new Date(), carryCount: 0 },
        { id: 'i2', committeeId: 'c1', organizationId: 'o1', title: 'T2', description: 'D2', status: 'in_progress', priority: 'medium', assignedTo: 'u2', dueDate: new Date(), carryCount: 2 },
      ],
      [{ id: 'n1' }],
      [],
      [{ id: 'n2' }],
      [],
    ];
    const carried = await carryForwardActionItems('m1', 'm2', 'u99');
    expect(carried).toHaveLength(2);
  });

  it('link/list/remove document', async () => {
    h.queue = [[{ id: 'd1' }]];
    expect(await linkDocument({ committeeId: 'c1', organizationId: 'o1', title: 'Doc', category: 'agenda', createdBy: 'u1' } as never)).toEqual({ id: 'd1' });

    h.queue = [[{ id: 'd1' }]];
    expect(await listCommitteeDocuments('c1', { category: 'agenda', meetingId: 'm1' })).toEqual([{ id: 'd1' }]);

    h.queue = [[]];
    await expect(removeDocument('d1')).resolves.toBeUndefined();
  });

  it('create and list intelligence snapshots', async () => {
    h.queue = [[{ id: 's1' }]];
    const snap = await createIntelligenceSnapshot({
      committeeId: 'c1', organizationId: 'o1', title: 'S', generatedBy: 'u1',
    } as never);
    expect(snap.id).toBe('s1');
    expect(h.createAuditLog).toHaveBeenCalled();

    h.queue = [[{ id: 's1' }]];
    expect(await listIntelligenceSnapshots('o1', { committeeId: 'c1', limit: 5 })).toEqual([{ id: 's1' }]);
  });

  it('gatherCrossCommitteeMinutes works with and without committeeIds', async () => {
    h.queue = [[{ id: 'm1' }]];
    expect(await gatherCrossCommitteeMinutes('o1', new Date('2026-01-01'), new Date('2026-01-31'))).toEqual([{ id: 'm1' }]);

    h.queue = [[{ id: 'm2' }]];
    expect(await gatherCrossCommitteeMinutes('o1', new Date('2026-01-01'), new Date('2026-01-31'), ['c1', 'c2'])).toEqual([{ id: 'm2' }]);
  });

  it('getCommitteeStats aggregates counts', async () => {
    h.queue = [[{ count: 10 }], [{ count: 3 }], [{ count: 7 }], [{ count: 2 }], [{ count: 9 }]];
    expect(await getCommitteeStats('c1')).toEqual({
      totalMeetings: 10,
      upcomingMeetings: 3,
      openActionItems: 7,
      overdueActionItems: 2,
      totalDocuments: 9,
    });
  });
});
