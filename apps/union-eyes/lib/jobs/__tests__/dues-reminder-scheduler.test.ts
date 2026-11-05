import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { duesTransactions } from '@/db/schema/domains/finance/dues';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { systemContext } from './system-context-double';

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/db/with-rls-context', async () => (await import('./system-context-double')).systemContextModule);

const notificationService = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('@/lib/services/notification-service', () => ({
  getNotificationService: () => notificationService,
}));

import { DuesReminderScheduler, runDuesReminders, manualTriggerReminders } from '../dues-reminder-scheduler';

const dialect = new PgDialect();
const render = (condition: SQL) => dialect.sqlToQuery(condition);

const ORG = '11111111-1111-4111-8111-111111111111';
const MEMBER = '22222222-2222-4222-8222-222222222222';

type Rendered = { sql: string; params: unknown[] };
type DueRow = {
  id: string;
  memberId: string;
  organizationId: string;
  totalAmount: string;
  duesAmount: string;
  copeAmount: string | null;
  pacAmount: string | null;
  strikeFundAmount: string | null;
  dueDate: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  metadata: Record<string, unknown>;
};

const due = (overrides: Partial<DueRow> = {}): DueRow => ({
  id: 'txn-1',
  memberId: MEMBER,
  organizationId: ORG,
  totalAmount: '50.00',
  duesAmount: '45.00',
  copeAmount: '2.50',
  pacAmount: null,
  strikeFundAmount: '2.50',
  dueDate: '2026-02-01',
  periodStart: '2026-01-01',
  periodEnd: '2026-01-31',
  status: 'pending',
  metadata: {},
  ...overrides,
});

const member = (metadata: Record<string, unknown> = {}) => [{ name: 'Alice Member', email: 'alice@example.org', metadata }];

interface World {
  /** The answers of the three scans, in the order the job runs them: 7 days ahead, 1 day ahead, overdue. */
  scans?: Array<DueRow[] | Error>;
  /** The answer of each member lookup in turn. */
  members?: Array<unknown[] | Error>;
  organizationName?: string;
}

/** The handle of the system context: records each statement with its table, rendered condition and the context depth it ran at. */
function installTransaction(world: World = {}) {
  const scans = [...(world.scans ?? [[], [], []])];
  const members = [...(world.members ?? [])];
  const lookups: Rendered[] = [];
  const updates: Array<{ values: Record<string, unknown>; where: Rendered }> = [];
  const depths = { scan: [] as number[], member: [] as number[], organization: [] as number[], update: [] as number[] };

  const answer = (outcome: unknown[] | Error) => ({
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      (outcome instanceof Error ? Promise.reject(outcome) : Promise.resolve(outcome)).then(resolve, reject),
    limit: async () => {
      if (outcome instanceof Error) throw outcome;
      return outcome;
    },
  });

  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: SQL) => {
          if (table === duesTransactions) {
            depths.scan.push(systemContext.depth);
            return answer(scans.shift() ?? []);
          }
          if (table === organizationMembers) {
            depths.member.push(systemContext.depth);
            systemContext.note('read member');
            lookups.push(render(condition));
            return answer(members.shift() ?? []);
          }
          if (table === organizations) {
            depths.organization.push(systemContext.depth);
            return answer([{ name: world.organizationName ?? 'CUPE Local 7' }]);
          }
          throw new Error('unexpected table read');
        },
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => ({
        where: async (condition: SQL) => {
          depths.update.push(systemContext.depth);
          systemContext.note('mark');
          updates.push({ values, where: render(condition) });
        },
      }),
    }),
  };
  systemContext.reset(tx);
  return { lookups, updates, depths };
}

const sent: Array<{ payload: Record<string, unknown>; depth: number }> = [];

beforeEach(() => {
  vi.clearAllMocks();
  sent.length = 0;
  notificationService.send.mockImplementation(async (payload: Record<string, unknown>) => {
    sent.push({ payload, depth: systemContext.depth });
    systemContext.note(`send ${String(payload.type)}`);
    return { id: 'notification-1', status: 'sent' };
  });
});

describe('DuesReminderScheduler.runReminderJob', () => {
  it('sends nothing when no dues are pending, after reading them as the system role', async () => {
    const { depths } = installTransaction();

    const result = await DuesReminderScheduler.runReminderJob();

    expect(result).toMatchObject({ totalProcessed: 0, remindersSent: 0, remindersFailed: 0, results: [] });
    expect(depths.scan).toEqual([1, 1, 1]);
    expect(systemContext.contexts.map((context) => context.committed)).toEqual([true, true, true]);
    expect(notificationService.send).not.toHaveBeenCalled();
  });

  it('delivers a 7-day reminder and marks it, member lookup included, in one system transaction of its own', async () => {
    const { lookups, updates, depths } = installTransaction({ scans: [[due()], [], []], members: [member()] });

    const result = await DuesReminderScheduler.runReminderJob();

    expect(result).toMatchObject({ totalProcessed: 1, remindersSent: 1, remindersFailed: 0 });
    expect(result.breakdown).toEqual({ sevenDayReminders: 1, oneDayReminders: 0, overdueNotices: 0 });
    expect(result.results).toEqual([{ transactionId: 'txn-1', memberId: MEMBER, reminderType: '7day', result: 'sent' }]);

    expect(sent).toHaveLength(1);
    expect(sent[0].payload).toMatchObject({ organizationId: ORG, recipientId: MEMBER, recipientEmail: 'alice@example.org', type: 'email' });
    // The scans are contexts 1-3; the reminder is context 4 and holds the lookup, the notification and the mark
    expect(systemContext.events.slice(systemContext.events.indexOf('open 4'))).toEqual([
      'open 4', 'read member', 'send email', 'mark', 'commit 4',
    ]);
    expect([...depths.member, ...depths.organization, ...depths.update, sent[0].depth]).toEqual([1, 1, 1, 1]);

    // The member must belong to the organization of the transaction: the system role has no row-level filter of its own
    expect(lookups[0].sql).toContain('"id" =');
    expect(lookups[0].sql).toContain('"organization_id" =');
    expect(lookups[0].params).toEqual([MEMBER, ORG]);

    expect(updates).toHaveLength(1);
    expect(updates[0].where.sql).toContain('"organization_id" =');
    expect(updates[0].where.params).toEqual(['txn-1', ORG]);
  });

  it('reports a transaction whose member does not exist as failed, without notifying or marking anything', async () => {
    const { updates } = installTransaction({ scans: [[due()], [], []], members: [[]] });

    const result = await DuesReminderScheduler.runReminderJob();

    expect(result).toMatchObject({ totalProcessed: 1, remindersSent: 0, remindersFailed: 1 });
    expect(result.results).toEqual([{ transactionId: 'txn-1', memberId: MEMBER, reminderType: '7day', result: 'failed' }]);
    expect(notificationService.send).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });

  it('never looks up a member id that is not a uuid (the organization members table is keyed by uuid)', async () => {
    const { lookups } = installTransaction({ scans: [[due({ memberId: 'legacy-member-17' })], [], []] });

    const result = await DuesReminderScheduler.runReminderJob();

    expect(result.remindersFailed).toBe(1);
    expect(lookups).toEqual([]);
    expect(notificationService.send).not.toHaveBeenCalled();
  });

  it('rolls back only the reminder whose statement failed and still delivers the one after it', async () => {
    const { updates } = installTransaction({
      scans: [[due({ id: 'txn-a' }), due({ id: 'txn-b' })], [], []],
      members: [new Error('canceling statement due to statement timeout'), member()],
    });

    const result = await DuesReminderScheduler.runReminderJob();

    expect(result).toMatchObject({ totalProcessed: 2, remindersSent: 1, remindersFailed: 1 });
    expect(result.results.map((entry) => [entry.transactionId, entry.result])).toEqual([
      ['txn-a', 'failed'],
      ['txn-b', 'sent'],
    ]);
    // Contexts 1-3 are the scans; 4 is the reminder that failed, 5 the one that committed
    expect(systemContext.contexts[3]).toMatchObject({ rolledBack: true, committed: false });
    expect(systemContext.contexts[4]).toMatchObject({ rolledBack: false, committed: true });
    expect(updates.map((update) => update.where.params)).toEqual([['txn-b', ORG]]);
  });

  it('does not mark a reminder whose notification could not be sent', async () => {
    const { updates } = installTransaction({ scans: [[due()], [], []], members: [member()] });
    notificationService.send.mockRejectedValueOnce(new Error('smtp down'));

    const result = await DuesReminderScheduler.runReminderJob();

    expect(result).toMatchObject({ remindersSent: 0, remindersFailed: 1 });
    expect(updates).toEqual([]);
    expect(systemContext.contexts[3].rolledBack).toBe(true);
  });

  it('sends the 1-day reminder by email and, when the member has a device, by push', async () => {
    const { updates } = installTransaction({ scans: [[], [due()], []], members: [member({ firebaseToken: 'device-token' })] });

    const result = await DuesReminderScheduler.runReminderJob();

    expect(result.breakdown).toEqual({ sevenDayReminders: 0, oneDayReminders: 1, overdueNotices: 0 });
    expect(sent.map((entry) => [entry.payload.type, entry.payload.priority, entry.depth])).toEqual([
      ['email', 'high', 1],
      ['push', 'high', 1],
    ]);
    expect(updates).toHaveLength(1);
  });

  it('sends the overdue notice and moves the transaction to overdue', async () => {
    const { updates } = installTransaction({ scans: [[], [], [due({ dueDate: '2025-12-01' })]], members: [member()] });

    const result = await DuesReminderScheduler.runReminderJob();

    expect(result.breakdown).toEqual({ sevenDayReminders: 0, oneDayReminders: 0, overdueNotices: 1 });
    expect(sent[0].payload).toMatchObject({ type: 'email', priority: 'urgent', organizationId: ORG });
    expect(updates[0].values).toMatchObject({ status: 'overdue' });
    expect(updates[0].where.params).toEqual(['txn-1', ORG]);
  });

  it('skips a reminder that was already sent', async () => {
    installTransaction({ scans: [[due({ metadata: { sevenDayReminderSent: true } })], [due({ metadata: { oneDayReminderSent: true } })], []] });

    const result = await DuesReminderScheduler.runReminderJob();

    expect(result.totalProcessed).toBe(0);
    expect(notificationService.send).not.toHaveBeenCalled();
  });

  it('fails the job when a scan fails, instead of reporting that there is nothing to do', async () => {
    installTransaction({ scans: [new Error('db down')] });

    await expect(DuesReminderScheduler.runReminderJob()).rejects.toThrow('db down');
    expect(systemContext.contexts[0].rolledBack).toBe(true);
  });
});

describe('job entry points', () => {
  it.each([
    ['runDuesReminders', runDuesReminders],
    ['manualTriggerReminders', manualTriggerReminders],
  ])('%s runs the reminder job', async (_name, run) => {
    installTransaction();

    const result = await run();

    expect(result.totalProcessed).toBe(0);
    expect(systemContext.contexts).toHaveLength(3);
  });
});
