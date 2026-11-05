import { ApiShapeError, envelopeData } from '@/lib/client/api-envelope';
import { asRecord, optionalString, requiredString } from '@/lib/client/row-fields';

/**
 * Reading what the messaging routes answer. Handlers answer { success, data: { ... } } through withApi, or { data: { ... } } where they build
 * the response themselves; either way the payload is `data`. An answer that is not the shape a route promises is an error for the screen to
 * show, never an empty list or a half-filled conversation.
 */

export type ThreadSummary = {
  id: string;
  subject: string;
  status: string;
  isArchived: boolean;
  lastMessageAt: string | null;
  createdAt: string;
  representativeAssigned: boolean;
  viewerRole: 'member' | 'assignee';
};

export type QueueEntry = { id: string; subject: string; category: string | null; priority: string | null; createdAt: string };

export type MessageRecord = {
  id: string;
  fromMe: boolean;
  senderKind: 'member' | 'union' | 'system';
  content: string | null;
  createdAt: string;
  readByCounterpart: boolean;
};

export type MemberRetention = 'not_closed' | 'policy_not_adopted' | 'retained';
export type StaffRetention = 'legal_hold' | 'not_closed' | 'policy_not_adopted' | 'closure_unrecorded' | 'retained' | 'retention_elapsed';
export type Retention =
  | { audience: 'member'; state: MemberRetention }
  | { audience: 'staff'; state: StaffRetention; retainedUntil?: string };

export type ThreadDetail = {
  id: string;
  subject: string;
  status: string;
  isArchived: boolean;
  representativeAssigned: boolean;
  viewerRole: 'member' | 'assignee';
  canReply: boolean;
  canClose: boolean;
  canArchive: boolean;
  retention?: Retention;
};

const MEMBER_RETENTION: readonly string[] = ['not_closed', 'policy_not_adopted', 'retained'];
const STAFF_RETENTION: readonly string[] = ['legal_hold', 'not_closed', 'policy_not_adopted', 'closure_unrecorded', 'retained', 'retention_elapsed'];
const isMemberRetention = (state: unknown): state is MemberRetention => typeof state === 'string' && MEMBER_RETENTION.includes(state);
const isStaffRetention = (state: unknown): state is StaffRetention => typeof state === 'string' && STAFF_RETENTION.includes(state);

function flag(row: Record<string, unknown>, key: string): boolean {
  const value = row[key];
  if (typeof value !== 'boolean') throw new ApiShapeError(`${key} is not a boolean`);
  return value;
}

// A time that cannot be read would throw when the screen formats it; it is refused here instead.
function timestamp(row: Record<string, unknown>, key: string): string {
  const value = requiredString(row, key);
  if (Number.isNaN(new Date(value).getTime())) throw new ApiShapeError(`${key} is not a date`);
  return value;
}

function optionalTimestamp(row: Record<string, unknown>, key: string): string | null {
  return row[key] === null || row[key] === undefined ? null : timestamp(row, key);
}

function viewerRole(row: Record<string, unknown>): 'member' | 'assignee' {
  const role = row.viewerRole;
  if (role !== 'member' && role !== 'assignee') throw new ApiShapeError('viewerRole is not a role');
  return role;
}

function listOf(body: unknown, key: string): unknown[] {
  const list = envelopeData(body)[key];
  if (!Array.isArray(list)) throw new ApiShapeError(`no ${key}`);
  return list;
}

function threadFrom(value: unknown): ThreadSummary {
  const row = asRecord(value, 'conversation');
  return {
    id: requiredString(row, 'id'),
    subject: requiredString(row, 'subject'),
    status: requiredString(row, 'status'),
    isArchived: flag(row, 'isArchived'),
    lastMessageAt: optionalTimestamp(row, 'lastMessageAt'),
    createdAt: timestamp(row, 'createdAt'),
    representativeAssigned: flag(row, 'representativeAssigned'),
    viewerRole: viewerRole(row),
  };
}

function queueEntryFrom(value: unknown): QueueEntry {
  const row = asRecord(value, 'queue entry');
  return {
    id: requiredString(row, 'id'),
    subject: requiredString(row, 'subject'),
    category: optionalString(row, 'category'),
    priority: optionalString(row, 'priority'),
    createdAt: timestamp(row, 'createdAt'),
  };
}

function messageFrom(value: unknown): MessageRecord {
  const row = asRecord(value, 'message');
  const { senderKind, content } = row;
  if (senderKind !== 'member' && senderKind !== 'union' && senderKind !== 'system') throw new ApiShapeError('senderKind is not a sender');
  if (content !== null && typeof content !== 'string') throw new ApiShapeError('content is not text');
  return {
    id: requiredString(row, 'id'),
    fromMe: flag(row, 'fromMe'),
    senderKind,
    content,
    createdAt: timestamp(row, 'createdAt'),
    readByCounterpart: flag(row, 'readByCounterpart'),
  };
}

function retentionFrom(value: unknown): Retention | undefined {
  if (value === undefined || value === null) return undefined;
  const row = asRecord(value, 'retention');
  if (row.audience === 'member' && isMemberRetention(row.state)) return { audience: 'member', state: row.state };
  if (row.audience === 'staff' && isStaffRetention(row.state)) {
    const retainedUntil = optionalTimestamp(row, 'retainedUntil');
    return retainedUntil === null ? { audience: 'staff', state: row.state } : { audience: 'staff', state: row.state, retainedUntil };
  }
  throw new ApiShapeError('retention is not a known position');
}

/** GET /api/messages/threads: { threads }. */
export const threadsFrom = (body: unknown): ThreadSummary[] => listOf(body, 'threads').map(threadFrom);

/** GET /api/messages/queue: { queue }. */
export const queueFrom = (body: unknown): QueueEntry[] => listOf(body, 'queue').map(queueEntryFrom);

/** GET /api/messages/threads/[threadId]/messages: { messages }. */
export const messagesFrom = (body: unknown): MessageRecord[] => listOf(body, 'messages').map(messageFrom);

/** GET /api/messages/threads/[threadId]: { thread }. */
export function threadDetailFrom(body: unknown): ThreadDetail {
  const row = asRecord(envelopeData(body).thread, 'conversation');
  return {
    id: requiredString(row, 'id'),
    subject: requiredString(row, 'subject'),
    status: requiredString(row, 'status'),
    isArchived: flag(row, 'isArchived'),
    representativeAssigned: flag(row, 'representativeAssigned'),
    viewerRole: viewerRole(row),
    canReply: flag(row, 'canReply'),
    canClose: flag(row, 'canClose'),
    canArchive: flag(row, 'canArchive'),
    retention: retentionFrom(row.retention),
  };
}

/** POST /api/messages/threads: { data: { id } }. */
export const createdThreadId = (body: unknown): string => requiredString(envelopeData(body), 'id');

/** The machine-readable code of an error response, when it has one. */
export async function errorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as { error?: { code?: string } | string; code?: string } | null;
    if (body && typeof body.error === 'object' && body.error?.code) return body.error.code;
    return typeof body?.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
}

export type AssignmentProblem = 'assignmentGone' | 'assignmentClosed' | 'assignmentIneligible' | 'assignmentConflict' | 'assignmentFailed';

/** Maps a failed assignment response to copy; a 404 means the authority or the conversation is gone, not "not found". */
export async function assignmentProblem(response: Response): Promise<AssignmentProblem> {
  if (response.status === 404 || response.status === 403) return 'assignmentGone';
  const code = await errorCode(response);
  if (code === 'THREAD_CLOSED') return 'assignmentClosed';
  if (code === 'ASSIGNEE_NOT_ELIGIBLE') return 'assignmentIneligible';
  if (response.status === 409) return 'assignmentConflict';
  return 'assignmentFailed';
}

export const MAX_SUBJECT = 200;
export const MAX_BODY = 5000;
