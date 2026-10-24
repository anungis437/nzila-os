import type { ClaimId, MatterId, ReminderId, SubmissionId, TaskId, UserId } from './ids.ts';
import type { Decision } from './authorization.ts';
import type { Principal } from './principal.ts';
import { hasAnyRole, WORKAID_ROLES } from './principal.ts';
import { err, ok } from './result.ts';
import type { Result } from './result.ts';
import type { Submission, SubmissionKind } from './submission.ts';
import type { BusinessCalendar } from './time.ts';
import { addCalendarDays, isBusinessDay, localDateInZone, parseIsoDate, toIsoDate, zonedWallTimeToInstant } from './time.ts';

/**
 * WorkAid receipt follow-up. This module deliberately does NOT use the grievance
 * deadline engine, its recipient resolver or its tables: those are
 * grievance-specific (recipient-resolver.ts rejects claim_deadlines). Only the
 * transport pattern (durable schedule, idempotent key, snapshot, observed
 * outcome) is mirrored.
 */

export type TaskOfRecord = 'UNRESOLVED' | 'UNION_EYES' | 'CLIO';

export type DueDateRule = { readonly kind: 'NEXT_CALENDAR_DAY' | 'NEXT_BUSINESS_DAY'; readonly calendar: BusinessCalendar };

export interface DueDateCandidate {
  readonly date: string;
  /** True when a calendar-day rule lands on a weekend or holiday; surfaced, never silently shifted. */
  readonly fallsOnNonBusinessDay: boolean;
}

export function computeFollowUpDue(dispatchedAt: Date, rule: DueDateRule): DueDateCandidate {
  const local = localDateInZone(dispatchedAt, rule.calendar.timeZone);
  let d = addCalendarDays(local, 1);
  if (rule.kind === 'NEXT_BUSINESS_DAY') {
    while (!isBusinessDay(d, rule.calendar)) d = addCalendarDays(d, 1);
  }
  return { date: toIsoDate(d), fallsOnNonBusinessDay: !isBusinessDay(d, rule.calendar) };
}

export type TaskState =
  | 'OPEN'
  | 'SNOOZED_WITH_REASON'
  | 'IN_PROGRESS'
  | 'RECEIPT_CONFIRMED'
  | 'EXCEPTION_ESCALATED'
  | 'CANCELLED_SUPERSEDED'
  | 'CANCELLED_MATTER_CLOSED';

const TERMINAL_TASK_STATES: readonly TaskState[] = ['RECEIPT_CONFIRMED', 'CANCELLED_SUPERSEDED', 'CANCELLED_MATTER_CLOSED'];
export const isTerminalTask = (s: TaskState) => TERMINAL_TASK_STATES.includes(s);

export interface ReceiptFollowUpTask {
  readonly id: TaskId;
  readonly idempotencyKey: string;
  readonly submissionId: SubmissionId;
  readonly submissionVersion: number;
  readonly submissionKind: SubmissionKind;
  readonly matterId: MatterId;
  readonly claimId: ClaimId | null;
  readonly owner: UserId;
  /** Bumped on every reassignment so stale reminders can be recognized. */
  readonly ownerEpoch: number;
  readonly state: TaskState;
  readonly dueDate: string | null;
  readonly dueDateState: 'NEEDS_OWNER_CONFIRMATION' | 'CANDIDATE_FROM_CONFIGURED_RULE' | 'CONFIRMED_BY_OWNER';
  readonly originalDueDate: string | null;
  readonly fallsOnNonBusinessDay: boolean;
  /** Only an authoritative task may drive reminders. See task-of-record. */
  readonly authoritative: boolean;
  readonly snoozes: readonly { readonly reason: string; readonly until: string; readonly by: UserId }[];
  readonly provenance: readonly { readonly event: string; readonly by: string; readonly at: string; readonly note?: string }[];
}

export type GenerateOutcome =
  | { readonly kind: 'TASK'; readonly task: ReceiptFollowUpTask; readonly created: boolean }
  | { readonly kind: 'NOT_GENERATED'; readonly reason: 'CLIO_IS_TASK_OF_RECORD' };

export type FollowUpError = 'NOT_DISPATCHED' | 'RECEIPT_ALREADY_CONFIRMED' | 'OWNER_REQUIRED' | 'NOT_PROFESSIONAL' | 'REASON_REQUIRED' | 'ILLEGAL_TRANSITION' | 'NOT_AUTHORIZED' | 'BAD_DATE';

export const followUpKey = (s: Pick<Submission, 'id' | 'version'>) => `receipt-followup:${s.id}:v${s.version}`;

/**
 * Exactly one task per submission version. Replays, retries and racing workers
 * resolve to the existing task through the idempotency key.
 */
export function generateReceiptFollowUp(input: {
  submission: Submission;
  existingTasks: readonly ReceiptFollowUpTask[];
  taskOfRecord: TaskOfRecord;
  rule: DueDateRule | null;
  owner: UserId | null;
  newTaskId: TaskId;
}): Result<GenerateOutcome, FollowUpError> {
  const { submission } = input;
  if (input.taskOfRecord === 'CLIO') return ok({ kind: 'NOT_GENERATED', reason: 'CLIO_IS_TASK_OF_RECORD' }, false);
  const existing = input.existingTasks.find((t) => t.idempotencyKey === followUpKey(submission));
  if (existing) return ok({ kind: 'TASK', task: existing, created: false }, false);
  if (submission.state === 'RECEIPT_CONFIRMED') return err('RECEIPT_ALREADY_CONFIRMED', 'receipt already confirmed; no follow-up needed');
  if (!submission.dispatch || (submission.state !== 'DISPATCHED' && submission.state !== 'DELIVERY_ACK')) {
    return err('NOT_DISPATCHED', 'a follow-up exists only for a dispatched submission; drafts and approvals do not start one');
  }
  if (!input.owner) return err('OWNER_REQUIRED', 'a named owner is required');
  const candidate = input.rule ? computeFollowUpDue(new Date(submission.dispatch.at), input.rule) : null;
  const task: ReceiptFollowUpTask = {
    id: input.newTaskId,
    idempotencyKey: followUpKey(submission),
    submissionId: submission.id,
    submissionVersion: submission.version,
    submissionKind: submission.kind,
    matterId: submission.matterId,
    claimId: submission.claimId,
    owner: input.owner,
    ownerEpoch: 1,
    state: 'OPEN',
    dueDate: candidate?.date ?? null,
    dueDateState: candidate ? 'CANDIDATE_FROM_CONFIGURED_RULE' : 'NEEDS_OWNER_CONFIRMATION',
    originalDueDate: candidate?.date ?? null,
    fallsOnNonBusinessDay: candidate?.fallsOnNonBusinessDay ?? false,
    authoritative: input.taskOfRecord === 'UNION_EYES',
    snoozes: [],
    provenance: [{ event: 'GENERATED', by: 'system:receipt-follow-up', at: submission.dispatch.at }],
  };
  return ok({ kind: 'TASK', task, created: true });
}

const record = (t: ReceiptFollowUpTask, event: string, by: string, at: string, note?: string) => [
  ...t.provenance,
  { event, by, at, ...(note ? { note } : {}) },
];

export function confirmTaskDueDate(task: ReceiptFollowUpTask, principal: Principal, isoDate: string, now: string): Result<ReceiptFollowUpTask, FollowUpError> {
  if (!hasAnyRole(principal, WORKAID_ROLES) || principal.userId !== task.owner) return err('NOT_AUTHORIZED', 'only the task owner may confirm the date');
  try {
    parseIsoDate(isoDate);
  } catch {
    return err('BAD_DATE', 'invalid date');
  }
  return ok({
    ...task,
    dueDate: isoDate,
    originalDueDate: task.originalDueDate ?? isoDate,
    dueDateState: 'CONFIRMED_BY_OWNER',
    provenance: record(task, 'DUE_DATE_CONFIRMED', principal.userId, now),
  });
}

export function snoozeTask(task: ReceiptFollowUpTask, principal: Principal, input: { reason: string; until: string }, now: string): Result<ReceiptFollowUpTask, FollowUpError> {
  if (isTerminalTask(task.state)) return err('ILLEGAL_TRANSITION', 'task is closed');
  if (!hasAnyRole(principal, WORKAID_ROLES) || principal.userId !== task.owner) return err('NOT_AUTHORIZED', 'only the owner may snooze');
  if (input.reason.trim().length < 5) return err('REASON_REQUIRED', 'a reason is required to snooze');
  return ok({
    ...task,
    state: 'SNOOZED_WITH_REASON',
    // The original due date is preserved; snoozing never rewrites history.
    originalDueDate: task.originalDueDate ?? task.dueDate,
    snoozes: [...task.snoozes, { reason: input.reason, until: input.until, by: principal.userId }],
    provenance: record(task, 'SNOOZED', principal.userId, now, input.reason),
  });
}

export function escalateTaskException(task: ReceiptFollowUpTask, principal: Principal, reason: string, now: string): Result<ReceiptFollowUpTask, FollowUpError> {
  if (isTerminalTask(task.state)) return err('ILLEGAL_TRANSITION', 'task is closed');
  if (!hasAnyRole(principal, WORKAID_ROLES)) return err('NOT_PROFESSIONAL', 'professionals only');
  if (reason.trim().length < 5) return err('REASON_REQUIRED', 'reason required');
  return ok({ ...task, state: 'EXCEPTION_ESCALATED', provenance: record(task, 'ESCALATED', principal.userId, now, reason) });
}

/**
 * The only way a task completes. There is no "done without receipt": an owner
 * cannot erase a failure, only escalate it.
 */
export function completeFromReceipt(task: ReceiptFollowUpTask, submission: Submission, now: string): Result<ReceiptFollowUpTask, FollowUpError> {
  if (submission.id !== task.submissionId || submission.version !== task.submissionVersion) return err('ILLEGAL_TRANSITION', 'receipt belongs to a different submission version');
  if (submission.state !== 'RECEIPT_CONFIRMED' || !submission.receipt) return err('ILLEGAL_TRANSITION', 'receipt is not confirmed');
  if (isTerminalTask(task.state)) return ok(task, false);
  return ok({ ...task, state: 'RECEIPT_CONFIRMED', provenance: record(task, 'RECEIPT_CONFIRMED', submission.receipt.confirmedBy, now) });
}

export function cancelTask(task: ReceiptFollowUpTask, reason: 'SUPERSEDED' | 'MATTER_CLOSED', now: string): ReceiptFollowUpTask {
  if (isTerminalTask(task.state)) return task;
  return {
    ...task,
    state: reason === 'SUPERSEDED' ? 'CANCELLED_SUPERSEDED' : 'CANCELLED_MATTER_CLOSED',
    provenance: record(task, `CANCELLED_${reason}`, 'system:lifecycle', now),
  };
}

export function reassignTask(
  task: ReceiptFollowUpTask,
  principal: Principal,
  newOwner: UserId,
  authorization: Decision,
  now: string,
): Result<ReceiptFollowUpTask, FollowUpError> {
  if (isTerminalTask(task.state)) return err('ILLEGAL_TRANSITION', 'task is closed');
  if (!hasAnyRole(principal, ['WORKAID_PRINCIPAL']) || !authorization.allow) return err('NOT_AUTHORIZED', 'reassignment is reserved to the principal');
  if (newOwner === task.owner) return ok(task, false);
  return ok({
    ...task,
    owner: newOwner,
    ownerEpoch: task.ownerEpoch + 1,
    provenance: record(task, 'REASSIGNED', principal.userId, now, `${task.owner} -> ${newOwner}`),
  });
}

export type OverdueState = 'NOT_DUE' | 'DUE_TODAY' | 'OVERDUE' | 'NO_DUE_DATE';

/** Overdue is judged on the original due date, so snoozing cannot hide it. Uses the matter calendar zone, never the viewer's. */
export function overdueState(task: ReceiptFollowUpTask, now: Date, matterTimeZone: string): OverdueState {
  if (isTerminalTask(task.state)) return 'NOT_DUE';
  const due = task.originalDueDate ?? task.dueDate;
  if (!due) return 'NO_DUE_DATE';
  const today = toIsoDate(localDateInZone(now, matterTimeZone));
  return today > due ? 'OVERDUE' : today === due ? 'DUE_TODAY' : 'NOT_DUE';
}

/* ------------------------------------------------------------------ *
 * Reminders: durable, idempotent, snapshot recipient, observed outcome
 * ------------------------------------------------------------------ */

export type ReminderStatus =
  | 'SCHEDULED'
  | 'DELIVERED_SINK'
  | 'FAILED_RETRYABLE'
  | 'DEAD_LETTER'
  | 'CANCELLED_SUPERSEDED'
  | 'CANCELLED_TASK_CLOSED'
  | 'CANCELLED_MATTER_CLOSED';

export interface Reminder {
  readonly id: ReminderId;
  readonly taskId: TaskId;
  readonly dedupeKey: string;
  /** Recipient snapshot taken at schedule time. Delivery re-validates it against the task. */
  readonly recipient: UserId;
  readonly ownerEpoch: number;
  readonly fireAtMs: number;
  readonly status: ReminderStatus;
  readonly attempts: number;
  readonly lease: { readonly workerId: string; readonly untilMs: number } | null;
}

export const reminderKey = (task: Pick<ReceiptFollowUpTask, 'id' | 'ownerEpoch'>, offsetKey: string) => `reminder:${task.id}:e${task.ownerEpoch}:${offsetKey}`;

/** Fire at 09:00 local on the due date in the matter's zone, DST-safe. */
export function reminderInstantForDueDate(dueDate: string, timeZone: string, hour = 9): number {
  return zonedWallTimeToInstant(parseIsoDate(dueDate), hour, 0, timeZone).getTime();
}

export function scheduleReminder(input: {
  task: ReceiptFollowUpTask;
  existing: readonly Reminder[];
  offsetKey: string;
  fireAtMs: number;
  newId: ReminderId;
}): Result<Reminder, 'TASK_NOT_AUTHORITATIVE' | 'TASK_CLOSED'> {
  const { task } = input;
  if (!task.authoritative) return err('TASK_NOT_AUTHORITATIVE', 'task-of-record is unresolved or external; no reminders are scheduled');
  if (isTerminalTask(task.state)) return err('TASK_CLOSED', 'task is closed');
  const key = reminderKey(task, input.offsetKey);
  const dup = input.existing.find((r) => r.dedupeKey === key);
  if (dup) return ok(dup, false);
  return ok({ id: input.newId, taskId: task.id, dedupeKey: key, recipient: task.owner, ownerEpoch: task.ownerEpoch, fireAtMs: input.fireAtMs, status: 'SCHEDULED', attempts: 0, lease: null });
}

/** On reassignment: cancel the previous owner's pending reminders. The caller then schedules fresh ones for the new epoch. */
export function supersedeRemindersOnReassign(reminders: readonly Reminder[], task: ReceiptFollowUpTask): Reminder[] {
  return reminders.map((r) =>
    r.taskId === task.id && r.ownerEpoch < task.ownerEpoch && (r.status === 'SCHEDULED' || r.status === 'FAILED_RETRYABLE') ? { ...r, status: 'CANCELLED_SUPERSEDED', lease: null } : r,
  );
}

export type DeliveryDecision =
  | { readonly action: 'SEND' }
  | { readonly action: 'SKIP'; readonly reason: string; readonly nextStatus?: ReminderStatus };

export function decideDelivery(input: {
  reminder: Reminder;
  task: ReceiptFollowUpTask;
  matterStatus: 'OPEN' | 'CLOSED';
  /** Fresh authorization of the recipient for the task's matter at delivery time. */
  recipientAuth: Decision;
  nowMs: number;
}): DeliveryDecision {
  const { reminder, task } = input;
  if (reminder.status !== 'SCHEDULED' && reminder.status !== 'FAILED_RETRYABLE') return { action: 'SKIP', reason: 'ALREADY_HANDLED' };
  if (input.matterStatus === 'CLOSED') return { action: 'SKIP', reason: 'MATTER_CLOSED', nextStatus: 'CANCELLED_MATTER_CLOSED' };
  if (isTerminalTask(task.state)) return { action: 'SKIP', reason: 'TASK_CLOSED', nextStatus: 'CANCELLED_TASK_CLOSED' };
  if (reminder.ownerEpoch !== task.ownerEpoch || reminder.recipient !== task.owner) return { action: 'SKIP', reason: 'RECIPIENT_SUPERSEDED', nextStatus: 'CANCELLED_SUPERSEDED' };
  if (!input.recipientAuth.allow) return { action: 'SKIP', reason: 'RECIPIENT_NOT_AUTHORIZED' };
  if (!task.authoritative) return { action: 'SKIP', reason: 'TASK_NOT_AUTHORITATIVE' };
  if (input.nowMs < reminder.fireAtMs) return { action: 'SKIP', reason: 'NOT_YET_DUE' };
  if (reminder.lease && reminder.lease.untilMs > input.nowMs) return { action: 'SKIP', reason: 'LEASED_BY_ANOTHER_WORKER' };
  return { action: 'SEND' };
}

/** Compare-and-set style lease: the second worker racing for the same reminder loses. */
export function claimForDelivery(reminder: Reminder, workerId: string, nowMs: number, leaseMs: number): Result<Reminder, 'ALREADY_HANDLED' | 'LEASED'> {
  if (reminder.status !== 'SCHEDULED' && reminder.status !== 'FAILED_RETRYABLE') return err('ALREADY_HANDLED', 'reminder is not pending');
  if (reminder.lease && reminder.lease.untilMs > nowMs && reminder.lease.workerId !== workerId) return err('LEASED', 'another worker holds the lease');
  return ok({ ...reminder, lease: { workerId, untilMs: nowMs + leaseMs } });
}

export function recordDeliveryOutcome(reminder: Reminder, outcome: 'SINK_ACCEPTED' | 'FAILED', maxAttempts: number): Reminder {
  if (reminder.status === 'DELIVERED_SINK') return reminder;
  const attempts = reminder.attempts + 1;
  if (outcome === 'SINK_ACCEPTED') return { ...reminder, attempts, status: 'DELIVERED_SINK', lease: null };
  return { ...reminder, attempts, status: attempts >= maxAttempts ? 'DEAD_LETTER' : 'FAILED_RETRYABLE', lease: null };
}

/** A reminder that is not delivered must stay visible; it never counts as notified. */
export const isUndelivered = (r: Reminder) => r.status === 'FAILED_RETRYABLE' || r.status === 'DEAD_LETTER';

/** Closing a matter cancels everything still pending for it. */
export function cancelOnMatterClose(tasks: readonly ReceiptFollowUpTask[], reminders: readonly Reminder[], matterId: MatterId, now: string) {
  const closedTasks = tasks.map((t) => (t.matterId === matterId ? cancelTask(t, 'MATTER_CLOSED', now) : t));
  const affected = new Set(tasks.filter((t) => t.matterId === matterId).map((t) => t.id));
  const closedReminders = reminders.map((r) =>
    affected.has(r.taskId) && (r.status === 'SCHEDULED' || r.status === 'FAILED_RETRYABLE') ? { ...r, status: 'CANCELLED_MATTER_CLOSED' as const, lease: null } : r,
  );
  return { tasks: closedTasks, reminders: closedReminders };
}
