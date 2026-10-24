import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cancelOnMatterClose,
  cancelTask,
  claimForDelivery,
  completeFromReceipt,
  computeFollowUpDue,
  confirmTaskDueDate,
  decideDelivery,
  escalateTaskException,
  followUpKey,
  generateReceiptFollowUp,
  isUndelivered,
  overdueState,
  reassignTask,
  recordDeliveryOutcome,
  reminderInstantForDueDate,
  scheduleReminder,
  snoozeTask,
  supersedeRemindersOnReassign,
} from '../src/followup.ts';
import type { DueDateRule, ReceiptFollowUpTask, TaskOfRecord } from '../src/followup.ts';
import { applySubmissionEvent } from '../src/submission.ts';
import type { Submission } from '../src/submission.ts';
import { asReminderId, asTaskId, asUserId } from '../src/ids.ts';
import { PRINCIPAL_1, SPEC_1, SPEC_2, REP_A, allowDecision, policyForSubmissions, submissionAt, MATTER_ID } from './helpers.ts';

const TORONTO = 'America/Toronto';
const cal = (holidays: string[] = []) => ({ timeZone: TORONTO, holidays });
const BUSINESS: DueDateRule = { kind: 'NEXT_BUSINESS_DAY', calendar: cal() };
const CALENDAR: DueDateRule = { kind: 'NEXT_CALENDAR_DAY', calendar: cal() };

const sent = (dispatchedAt = '2026-10-23T14:00:00Z', version = 1): Submission => {
  const s = submissionAt('DISPATCHED', 'WRF', version);
  return { ...s, dispatch: { ...s.dispatch!, at: dispatchedAt } };
};
const gen = (sub: Submission, existing: ReceiptFollowUpTask[] = [], sor: TaskOfRecord = 'UNION_EYES', rule: DueDateRule | null = BUSINESS) =>
  generateReceiptFollowUp({ submission: sub, existingTasks: existing, taskOfRecord: sor, rule, owner: SPEC_1.userId, newTaskId: asTaskId(`T-${existing.length + 1}`) });
const taskOf = (r: ReturnType<typeof gen>): ReceiptFollowUpTask => {
  assert.equal(r.ok, true, JSON.stringify(r));
  const v = (r as { value: { kind: string; task?: ReceiptFollowUpTask } }).value;
  assert.equal(v.kind, 'TASK');
  return v.task!;
};

describe('receipt follow-up generation', () => {
  it('[WA-T037] a dispatched submission yields exactly one task carrying submission, matter, claim and owner context', () => {
    const t = taskOf(gen(sent()));
    assert.equal(t.matterId, MATTER_ID);
    assert.equal(t.submissionKind, 'WRF');
    assert.ok(t.claimId);
    assert.equal(t.owner, SPEC_1.userId);
    assert.equal(t.state, 'OPEN');
    assert.equal(t.idempotencyKey, followUpKey(sent()));
  });

  it('[WA-T038][WA-ADV-10] replays and racing workers resolve to the same single task', () => {
    const first = gen(sent());
    const t1 = taskOf(first);
    const replay = gen(sent(), [t1]);
    assert.equal((replay as { value: { created: boolean } }).value.created, false);
    assert.equal(taskOf(replay).id, t1.id);
    const raced = gen(sent(), [t1], 'UNION_EYES');
    assert.equal(taskOf(raced).id, t1.id);
  });

  it('[WA-T039] draft, reviewed and approved documents never start a receipt follow-up', () => {
    for (const s of ['DRAFT', 'REVIEWED', 'APPROVED'] as const) {
      const r = gen(submissionAt(s, 'WRF'));
      assert.equal((r as { code?: string }).code, 'NOT_DISPATCHED');
    }
  });

  it('a new submission version gets its own follow-up; an earlier version does not block it', () => {
    const t1 = taskOf(gen(sent('2026-10-23T14:00:00Z', 1)));
    const t2 = taskOf(gen(sent('2026-10-24T14:00:00Z', 2), [t1]));
    assert.notEqual(t1.idempotencyKey, t2.idempotencyKey);
  });

  it('an already receipt-confirmed submission needs no follow-up', () => {
    const r = gen(submissionAt('RECEIPT_CONFIRMED', 'WRF'));
    assert.equal((r as { code?: string }).code, 'RECEIPT_ALREADY_CONFIRMED');
  });

  it('a named owner is required', () => {
    const r = generateReceiptFollowUp({ submission: sent(), existingTasks: [], taskOfRecord: 'UNION_EYES', rule: BUSINESS, owner: null, newTaskId: asTaskId('T') });
    assert.equal((r as { code?: string }).code, 'OWNER_REQUIRED');
  });
});

describe('task-of-record is unresolved until Domenic validates it', () => {
  it('UNRESOLVED: a task record exists but is non-authoritative and schedules no reminders', () => {
    const t = taskOf(gen(sent(), [], 'UNRESOLVED'));
    assert.equal(t.authoritative, false);
    const r = scheduleReminder({ task: t, existing: [], offsetKey: 'due', fireAtMs: 1, newId: asReminderId('R1') });
    assert.equal((r as { code?: string }).code, 'TASK_NOT_AUTHORITATIVE');
  });

  it('CLIO as task-of-record: Union Eyes generates no competing task (no dual OPEN receipt tasks)', () => {
    const r = gen(sent(), [], 'CLIO');
    assert.equal((r as { value: { kind: string } }).value.kind, 'NOT_GENERATED');
  });

  it('UNION_EYES as task-of-record: the task is authoritative and may schedule reminders', () => {
    const t = taskOf(gen(sent(), [], 'UNION_EYES'));
    assert.equal(t.authoritative, true);
    assert.equal(scheduleReminder({ task: t, existing: [], offsetKey: 'due', fireAtMs: 1, newId: asReminderId('R1') }).ok, true);
  });
});

describe('due-date rules (decision D-01 unresolved)', () => {
  it('[WA-T042] with no configured rule the task is created without a fabricated date', () => {
    const t = taskOf(gen(sent(), [], 'UNION_EYES', null));
    assert.equal(t.dueDate, null);
    assert.equal(t.dueDateState, 'NEEDS_OWNER_CONFIRMATION');
    assert.equal(overdueState(t, new Date('2030-01-01T00:00:00Z'), TORONTO), 'NO_DUE_DATE');
  });

  it('[WA-T042] Friday 23:59 local: calendar rule lands on Saturday and says so; business rule gives Monday', () => {
    const fri2359 = new Date('2026-10-24T03:59:00Z');
    assert.deepEqual(computeFollowUpDue(fri2359, CALENDAR), { date: '2026-10-24', fallsOnNonBusinessDay: true });
    assert.deepEqual(computeFollowUpDue(fri2359, BUSINESS), { date: '2026-10-26', fallsOnNonBusinessDay: false });
  });

  it('[WA-T042] holidays are skipped only when configured', () => {
    const fri = new Date('2026-10-23T14:00:00Z');
    assert.equal(computeFollowUpDue(fri, { kind: 'NEXT_BUSINESS_DAY', calendar: cal() }).date, '2026-10-26');
    assert.equal(computeFollowUpDue(fri, { kind: 'NEXT_BUSINESS_DAY', calendar: cal(['2026-10-26']) }).date, '2026-10-27');
  });

  it('[WA-T043] daylight-saving changes use local dates, not 24-hour arithmetic', () => {
    const beforeSpringForward = new Date('2026-03-08T04:30:00Z'); // Sat 2026-03-07 23:30 EST
    assert.equal(computeFollowUpDue(beforeSpringForward, CALENDAR).date, '2026-03-08');
    assert.notEqual(new Date(beforeSpringForward.getTime() + 86_400_000).toISOString().slice(0, 10), '2026-03-08', 'naive +24h would skip the day');
    assert.equal(new Date(reminderInstantForDueDate('2026-03-08', TORONTO)).toISOString(), '2026-03-08T13:00:00.000Z');
    assert.equal(new Date(reminderInstantForDueDate('2026-11-01', TORONTO)).toISOString(), '2026-11-01T14:00:00.000Z');
    assert.equal(new Date(reminderInstantForDueDate('2026-03-07', TORONTO)).toISOString(), '2026-03-07T14:00:00.000Z');
  });

  it('[WA-ADV-12] the matter calendar zone, not any viewer zone, decides the local date', () => {
    const d = new Date('2026-10-24T03:59:00Z'); // 23:59 Friday in Toronto, 20:59 Friday in Vancouver
    assert.equal(computeFollowUpDue(d, BUSINESS).date, '2026-10-26');
    assert.equal(computeFollowUpDue(new Date('2026-10-24T05:30:00Z'), CALENDAR).date, '2026-10-25', 'after local midnight in the matter zone the local date has advanced');
    assert.equal(computeFollowUpDue(new Date('2026-10-24T05:30:00Z'), { kind: 'NEXT_CALENDAR_DAY', calendar: { timeZone: 'America/Vancouver', holidays: [] } }).date, '2026-10-24', 'only a different matter zone changes the answer');
  });

  it('the owner can confirm or edit the date; the candidate stays visible in provenance', () => {
    const t = taskOf(gen(sent()));
    const edited = confirmTaskDueDate(t, SPEC_1, '2026-10-28', '2026-10-23T15:00:00Z');
    assert.equal(edited.ok, true);
    assert.equal((edited as { value: ReceiptFollowUpTask }).value.dueDateState, 'CONFIRMED_BY_OWNER');
    assert.equal((edited as { value: ReceiptFollowUpTask }).value.originalDueDate, '2026-10-26');
    assert.equal(confirmTaskDueDate(t, SPEC_2, '2026-10-28', 'x').ok, false);
    assert.equal((confirmTaskDueDate(t, SPEC_1, '2026-02-31', 'x') as { code?: string }).code, 'BAD_DATE');
  });
});

describe('task lifecycle', () => {
  const open = () => taskOf(gen(sent()));

  it('[WA-T044] snoozing needs a reason, keeps the original due date, and cannot hide overdue', () => {
    const t = open();
    assert.equal((snoozeTask(t, SPEC_1, { reason: '', until: '2026-10-30' }, 'n') as { code?: string }).code, 'REASON_REQUIRED');
    const s = (snoozeTask(t, SPEC_1, { reason: 'WSIB closed for holiday', until: '2026-10-30' }, '2026-10-26T12:00:00Z') as { value: ReceiptFollowUpTask }).value;
    assert.equal(s.state, 'SNOOZED_WITH_REASON');
    assert.equal(s.originalDueDate, '2026-10-26');
    assert.equal(s.snoozes.length, 1);
    assert.equal(overdueState(s, new Date('2026-10-28T14:00:00Z'), TORONTO), 'OVERDUE');
    assert.equal(overdueState(s, new Date('2026-10-26T14:00:00Z'), TORONTO), 'DUE_TODAY');
    assert.equal(overdueState(s, new Date('2026-10-25T14:00:00Z'), TORONTO), 'NOT_DUE');
  });

  it('[WA-T041] a task completes only from a confirmed receipt of its own submission version; an owner cannot erase a failure', () => {
    const sub = sent();
    const t = taskOf(gen(sub));
    assert.equal((completeFromReceipt(t, sub, 'n') as { code?: string }).code, 'ILLEGAL_TRANSITION');
    const confirmed = applySubmissionEvent(sub, { type: 'CONFIRM_RECEIPT', method: 'PHONE_CALL', contactRef: 'FAKE CLERK', receivedAt: '2026-10-24T14:00:00Z' }, {
      actor: { kind: 'USER', principal: SPEC_1 },
      now: '2026-10-24T14:05:00Z',
      professionalAuth: allowDecision,
      policy: policyForSubmissions,
    });
    const done = completeFromReceipt(t, (confirmed as { value: Submission }).value, '2026-10-24T14:05:00Z');
    assert.equal((done as { value: ReceiptFollowUpTask }).value.state, 'RECEIPT_CONFIRMED');
    const otherVersion = { ...(confirmed as { value: Submission }).value, version: 2 };
    assert.equal((completeFromReceipt(t, otherVersion, 'n') as { code?: string }).code, 'ILLEGAL_TRANSITION');
    const esc = escalateTaskException(t, SPEC_1, 'WSIB did not answer after two calls', 'n');
    assert.equal((esc as { value: ReceiptFollowUpTask }).value.state, 'EXCEPTION_ESCALATED');
    assert.equal(escalateTaskException(t, REP_A, 'union attempt', 'n').ok, false);
  });

  it('[WA-T048] reassignment is reserved to the principal, preserves provenance and bumps the owner epoch', () => {
    const t = open();
    assert.equal((reassignTask(t, SPEC_1, SPEC_2.userId, allowDecision, 'n') as { code?: string }).code, 'NOT_AUTHORIZED');
    const r = reassignTask(t, PRINCIPAL_1, SPEC_2.userId, allowDecision, '2026-10-23T16:00:00Z') as { value: ReceiptFollowUpTask };
    assert.equal(r.value.owner, SPEC_2.userId);
    assert.equal(r.value.ownerEpoch, 2);
    assert.ok(r.value.provenance.some((p) => p.event === 'REASSIGNED' && p.note?.includes('FAKE-WORKAID-STAFF-1')));
  });
});

describe('reminders', () => {
  const taskAndReminder = () => {
    const t = taskOf(gen(sent()));
    const r = (scheduleReminder({ task: t, existing: [], offsetKey: 'due', fireAtMs: 1_000, newId: asReminderId('R1') }) as { value: import('../src/followup.ts').Reminder }).value;
    return { t, r };
  };
  const decide = (over: Partial<Parameters<typeof decideDelivery>[0]>) => {
    const { t, r } = taskAndReminder();
    return decideDelivery({ reminder: r, task: t, matterStatus: 'OPEN', recipientAuth: allowDecision, nowMs: 2_000, ...over });
  };

  it('[WA-T038] scheduling is idempotent on (task, owner epoch, offset)', () => {
    const { t, r } = taskAndReminder();
    const again = scheduleReminder({ task: t, existing: [r], offsetKey: 'due', fireAtMs: 1_000, newId: asReminderId('R-dup') });
    assert.equal(again.ok && again.created, false);
    assert.equal((again as { value: { id: string } }).value.id, 'R1');
    const other = scheduleReminder({ task: t, existing: [r], offsetKey: 'plus1', fireAtMs: 5_000, newId: asReminderId('R2') });
    assert.equal(other.ok && other.created, true);
  });

  it('[WA-ADV-10] a reminder delivered once cannot fire a second time, and two workers cannot hold it together', () => {
    const { t, r } = taskAndReminder();
    const w1 = claimForDelivery(r, 'worker-1', 2_000, 30_000);
    assert.equal(w1.ok, true);
    const w2 = claimForDelivery((w1 as { value: typeof r }).value, 'worker-2', 3_000, 30_000);
    assert.equal((w2 as { code?: string }).code, 'LEASED');
    assert.equal(decideDelivery({ reminder: (w1 as { value: typeof r }).value, task: t, matterStatus: 'OPEN', recipientAuth: allowDecision, nowMs: 3_000 }).action, 'SKIP');
    const delivered = recordDeliveryOutcome((w1 as { value: typeof r }).value, 'SINK_ACCEPTED', 3);
    assert.equal(delivered.status, 'DELIVERED_SINK');
    assert.equal((claimForDelivery(delivered, 'worker-2', 40_000, 30_000) as { code?: string }).code, 'ALREADY_HANDLED');
    const d = decideDelivery({ reminder: delivered, task: t, matterStatus: 'OPEN', recipientAuth: allowDecision, nowMs: 40_000 });
    assert.deepEqual(d, { action: 'SKIP', reason: 'ALREADY_HANDLED' });
    assert.equal(recordDeliveryOutcome(delivered, 'FAILED', 3).status, 'DELIVERED_SINK', 'a late duplicate outcome cannot regress state');
  });

  it('[WA-T045][WA-T046] failures stay visible, retry, then dead-letter; they never count as notified', () => {
    const { r } = taskAndReminder();
    const f1 = recordDeliveryOutcome(r, 'FAILED', 3);
    assert.equal(f1.status, 'FAILED_RETRYABLE');
    assert.equal(isUndelivered(f1), true);
    const f3 = recordDeliveryOutcome(recordDeliveryOutcome(f1, 'FAILED', 3), 'FAILED', 3);
    assert.equal(f3.status, 'DEAD_LETTER');
    assert.equal(isUndelivered(f3), true);
    assert.equal(recordDeliveryOutcome(f1, 'SINK_ACCEPTED', 3).status, 'DELIVERED_SINK');
  });

  it('a reminder is not sent before it is due', () => {
    assert.deepEqual(decide({ nowMs: 500 }), { action: 'SKIP', reason: 'NOT_YET_DUE' });
    assert.deepEqual(decide({ nowMs: 1_000 }), { action: 'SEND' });
  });

  it('[WA-ADV-11][WA-T048] reassigning while a reminder is queued cancels the old recipient and never notifies the former assignee', () => {
    const { t, r } = taskAndReminder();
    const t2 = (reassignTask(t, PRINCIPAL_1, SPEC_2.userId, allowDecision, 'n') as { value: ReceiptFollowUpTask }).value;
    const [cancelled] = supersedeRemindersOnReassign([r], t2);
    assert.equal(cancelled?.status, 'CANCELLED_SUPERSEDED');
    // defence in depth: even if the cancellation was missed, delivery re-validates the snapshot against the task
    const missed = decideDelivery({ reminder: r, task: t2, matterStatus: 'OPEN', recipientAuth: allowDecision, nowMs: 2_000 });
    assert.deepEqual(missed, { action: 'SKIP', reason: 'RECIPIENT_SUPERSEDED', nextStatus: 'CANCELLED_SUPERSEDED' });
    const fresh = scheduleReminder({ task: t2, existing: [r], offsetKey: 'due', fireAtMs: 1_000, newId: asReminderId('R9') });
    assert.equal(fresh.ok && fresh.created, true, 'new epoch gets its own reminder');
    assert.equal((fresh as { value: { recipient: string } }).value.recipient, SPEC_2.userId);
  });

  it('[WA-ADV-18] closing a matter cancels its tasks and outstanding reminders, and delivery refuses a closed matter', () => {
    const { t, r } = taskAndReminder();
    const closed = cancelOnMatterClose([t], [r], MATTER_ID, 'now');
    assert.equal(closed.tasks[0]?.state, 'CANCELLED_MATTER_CLOSED');
    assert.equal(closed.reminders[0]?.status, 'CANCELLED_MATTER_CLOSED');
    assert.deepEqual(decide({ matterStatus: 'CLOSED' }), { action: 'SKIP', reason: 'MATTER_CLOSED', nextStatus: 'CANCELLED_MATTER_CLOSED' });
    const terminalTask = cancelTask(t, 'SUPERSEDED', 'n');
    assert.deepEqual(decide({ task: terminalTask }), { action: 'SKIP', reason: 'TASK_CLOSED', nextStatus: 'CANCELLED_TASK_CLOSED' });
  });

  it('[WA-T047][WA-T100] a reminder deep link rechecks current authorization at delivery', () => {
    const denied = { allow: false as const, publicOutcome: 'NOT_FOUND' as const, reason: 'removed from matter' };
    assert.deepEqual(decide({ recipientAuth: denied }), { action: 'SKIP', reason: 'RECIPIENT_NOT_AUTHORIZED' });
  });

  it('a task whose recipient is a different user than the snapshot is refused', () => {
    const { t, r } = taskAndReminder();
    const tampered = { ...r, recipient: asUserId('FAKE-INTRUDER') };
    assert.equal(decideDelivery({ reminder: tampered, task: t, matterStatus: 'OPEN', recipientAuth: allowDecision, nowMs: 2_000 }).action, 'SKIP');
  });
});
