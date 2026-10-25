import { and, asc, desc, eq, isNull, ne, or } from 'drizzle-orm'
import { messageRetentionPolicies, messageThreadLifecycle, messageThreads } from '@/db/schema/messages-schema'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import type { CaseActor } from '@/lib/cases/case-authorization'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { findReadableThread } from '@/lib/messaging/thread-access'

/**
 * Conversation lifecycle, legal hold and retention.
 *
 *   close    the conversation's member or its current assignee ends it; nobody can reply afterwards and it cannot reopen.
 *   archive  a closed conversation is filed away by the same two people; the content is kept, readable by its
 *            participants, and counted by retention. Archiving is allowed under a legal hold because nothing is deleted.
 *   hold     an organization administrator places or releases a legal hold, naming only a reference to the matter.
 *
 * Each decision updates the thread, appends its own history row (message_thread_lifecycle) and writes the mandatory audit
 * in ONE transaction, and the database refuses a status or archive change that has no matching history row. Audit
 * details carry identifiers and the authorizing path, never message text, subject or a hold reference.
 *
 * Retention is a REPORT, never an action. An organization-adopted policy record (message_retention_policies) supplies
 * the period; there is no default and no hard-coded duration. Where none is adopted the position is
 * `policy_not_adopted` and nothing is ever eligible for disposition. This module and the application contain no
 * deletion of conversation content; `retention_elapsed` only says a human disposition review may now be scheduled.
 */
export type LifecycleVia = 'thread_member' | 'current_assignee' | 'organization_administrator'

export type LifecycleResult =
  | { kind: 'ok'; action: 'close' | 'archive' }
  | { kind: 'not_found' }
  | { kind: 'conflict'; code: 'ALREADY_CLOSED' | 'NOT_CLOSED' | 'ALREADY_ARCHIVED' | 'CHANGED_CONCURRENTLY' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_HOLD_REFERENCE = 200
export const MAX_POLICY_REFERENCE = 200
export const MAX_RETENTION_DAYS = 36500

async function recordLifecycle(
  tx: RLSTx,
  actor: CaseActor,
  thread: { id: string },
  action: 'close' | 'archive' | 'hold_place' | 'hold_release',
  via: LifecycleVia,
  reference: string | null,
) {
  // created_at is left to the database default so it equals the transaction timestamp the thread guard checks.
  const [row] = await tx
    .insert(messageThreadLifecycle)
    .values({ organizationId: actor.organizationId, threadId: thread.id, action, actedBy: actor.userId, actedVia: via, reference })
    .returning({ id: messageThreadLifecycle.id })
  await persistAtomicAudit(tx, {
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: `messages.thread.${action}`,
    resourceType: 'message_threads',
    resourceId: thread.id,
    details: { lifecycleId: row?.id ?? null, via },
  })
}

/** Close or archive. Authority is being the conversation's member or its current, live assignee: exactly who can read it. */
export async function changeThreadLifecycle(tx: RLSTx, actor: CaseActor, threadId: string, action: 'close' | 'archive'): Promise<LifecycleResult> {
  const thread = await findReadableThread(tx, actor, threadId)
  if (!thread) return { kind: 'not_found' }
  const via: LifecycleVia = thread.memberId === actor.userId ? 'thread_member' : 'current_assignee'

  if (action === 'close') {
    if (thread.status === 'closed') return { kind: 'conflict', code: 'ALREADY_CLOSED' }
    const updated = await tx
      .update(messageThreads)
      .set({ status: 'closed', updatedAt: new Date() })
      .where(and(eq(messageThreads.id, thread.id), eq(messageThreads.organizationId, actor.organizationId), ne(messageThreads.status, 'closed')))
      .returning({ id: messageThreads.id })
    if (updated.length === 0) return { kind: 'conflict', code: 'CHANGED_CONCURRENTLY' }
  } else {
    if (thread.isArchived) return { kind: 'conflict', code: 'ALREADY_ARCHIVED' }
    if (thread.status !== 'closed') return { kind: 'conflict', code: 'NOT_CLOSED' }
    const updated = await tx
      .update(messageThreads)
      .set({ isArchived: true, updatedAt: new Date() })
      .where(
        and(
          eq(messageThreads.id, thread.id),
          eq(messageThreads.organizationId, actor.organizationId),
          eq(messageThreads.status, 'closed'),
          or(eq(messageThreads.isArchived, false), isNull(messageThreads.isArchived)),
        ),
      )
      .returning({ id: messageThreads.id })
    if (updated.length === 0) return { kind: 'conflict', code: 'CHANGED_CONCURRENTLY' }
  }
  await recordLifecycle(tx, actor, thread, action, via, null)
  return { kind: 'ok', action }
}

export type HoldResult =
  | { kind: 'ok'; held: boolean }
  | { kind: 'forbidden' }
  | { kind: 'not_found' }
  | { kind: 'invalid_reference' }
  | { kind: 'conflict'; code: 'ALREADY_HELD' | 'NOT_HELD' }

/**
 * An organization administrator places or releases a legal hold. The administrator learns that the conversation exists and
 * nothing of its content; a hold neither grants a read nor stops participants from using the conversation.
 */
export async function setLegalHold(tx: RLSTx, actor: CaseActor, threadId: string, action: 'place' | 'release', reference: string): Promise<HoldResult> {
  if (actor.role !== 'admin') return { kind: 'forbidden' }
  const trimmed = reference.trim()
  if (!trimmed || trimmed.length > MAX_HOLD_REFERENCE) return { kind: 'invalid_reference' }
  if (!UUID.test(threadId)) return { kind: 'not_found' }
  const [thread] = await tx
    .select({ id: messageThreads.id })
    .from(messageThreads)
    .where(and(eq(messageThreads.id, threadId), eq(messageThreads.organizationId, actor.organizationId)))
    .limit(1)
  if (!thread) return { kind: 'not_found' }

  const held = (await threadLifecycleFacts(tx, actor.organizationId, thread.id)).held
  if (action === 'place' && held) return { kind: 'conflict', code: 'ALREADY_HELD' }
  if (action === 'release' && !held) return { kind: 'conflict', code: 'NOT_HELD' }
  await recordLifecycle(tx, actor, thread, action === 'place' ? 'hold_place' : 'hold_release', 'organization_administrator', trimmed)
  return { kind: 'ok', held: action === 'place' }
}

export interface LifecycleFacts {
  closedAt: Date | null
  archivedAt: Date | null
  held: boolean
}

export async function threadLifecycleFacts(tx: RLSTx, organizationId: string, threadId: string): Promise<LifecycleFacts> {
  const rows = await tx
    .select({ action: messageThreadLifecycle.action, createdAt: messageThreadLifecycle.createdAt })
    .from(messageThreadLifecycle)
    .where(and(eq(messageThreadLifecycle.organizationId, organizationId), eq(messageThreadLifecycle.threadId, threadId)))
    .orderBy(asc(messageThreadLifecycle.seq))
  const facts: LifecycleFacts = { closedAt: null, archivedAt: null, held: false }
  for (const row of rows) {
    if (row.action === 'close') facts.closedAt = new Date(row.createdAt)
    else if (row.action === 'archive') facts.archivedAt = new Date(row.createdAt)
    else if (row.action === 'hold_place') facts.held = true
    else if (row.action === 'hold_release') facts.held = false
  }
  return facts
}

export interface RetentionPolicy {
  id: string
  policyReference: string
  authorityReference: string
  retentionDays: number
  adoptedBy: string
  adoptedAt: string
}

export async function liveRetentionPolicy(tx: RLSTx, organizationId: string): Promise<RetentionPolicy | null> {
  const [row] = await tx
    .select()
    .from(messageRetentionPolicies)
    .where(and(eq(messageRetentionPolicies.organizationId, organizationId), isNull(messageRetentionPolicies.supersededAt)))
    .orderBy(desc(messageRetentionPolicies.adoptedAt))
    .limit(1)
  return row
    ? {
        id: row.id,
        policyReference: row.policyReference,
        authorityReference: row.authorityReference,
        retentionDays: row.retentionDays,
        adoptedBy: row.adoptedBy,
        adoptedAt: new Date(row.adoptedAt).toISOString(),
      }
    : null
}

export type RetentionState =
  | { state: 'legal_hold' }
  | { state: 'not_closed' }
  | { state: 'policy_not_adopted' }
  | { state: 'closure_unrecorded' }
  | { state: 'retained'; retainedUntil: string }
  | { state: 'retention_elapsed'; retainedUntil: string }

/** Pure: where one conversation stands against the adopted policy. Never a decision to delete. */
export function evaluateRetention(
  thread: { status: string },
  facts: LifecycleFacts,
  policy: Pick<RetentionPolicy, 'retentionDays'> | null,
  now: Date,
): RetentionState {
  if (facts.held) return { state: 'legal_hold' }
  if (thread.status !== 'closed') return { state: 'not_closed' }
  if (!policy) return { state: 'policy_not_adopted' }
  if (!facts.closedAt) return { state: 'closure_unrecorded' }
  const until = new Date(facts.closedAt.getTime() + policy.retentionDays * 86_400_000)
  return now.getTime() < until.getTime()
    ? { state: 'retained', retainedUntil: until.toISOString() }
    : { state: 'retention_elapsed', retainedUntil: until.toISOString() }
}

export async function threadRetention(tx: RLSTx, thread: { id: string; organizationId: string; status: string }, now = new Date()): Promise<RetentionState> {
  const [facts, policy] = await Promise.all([threadLifecycleFacts(tx, thread.organizationId, thread.id), liveRetentionPolicy(tx, thread.organizationId)])
  return evaluateRetention(thread, facts, policy, now)
}

/** What a conversation's member may be told: never that a hold exists, nor a date. */
export type MemberRetention = 'not_closed' | 'policy_not_adopted' | 'retained'

export function memberRetentionView(state: RetentionState): MemberRetention {
  switch (state.state) {
    case 'not_closed':
      return 'not_closed'
    case 'policy_not_adopted':
      return 'policy_not_adopted'
    default:
      return 'retained'
  }
}

export type AdoptResult = { kind: 'ok'; policy: RetentionPolicy } | { kind: 'forbidden' } | { kind: 'invalid' }

/**
 * Records an organization's adopted retention period. The caller is an organization administrator, and the record names the
 * authority that adopted it; the system cannot verify that authority, so it stores the reference and who recorded it.
 * Adopting again supersedes the live policy. Nothing here changes any conversation.
 */
export async function adoptRetentionPolicy(
  tx: RLSTx,
  actor: CaseActor,
  input: { retentionDays: number; policyReference: string; authorityReference: string },
): Promise<AdoptResult> {
  if (actor.role !== 'admin') return { kind: 'forbidden' }
  const policyReference = input.policyReference.trim()
  const authorityReference = input.authorityReference.trim()
  if (
    !Number.isInteger(input.retentionDays) ||
    input.retentionDays < 1 ||
    input.retentionDays > MAX_RETENTION_DAYS ||
    !policyReference ||
    !authorityReference ||
    policyReference.length > MAX_POLICY_REFERENCE ||
    authorityReference.length > MAX_POLICY_REFERENCE
  ) {
    return { kind: 'invalid' }
  }
  const [superseded] = await tx
    .update(messageRetentionPolicies)
    .set({ supersededAt: new Date(), supersededBy: actor.userId })
    .where(and(eq(messageRetentionPolicies.organizationId, actor.organizationId), isNull(messageRetentionPolicies.supersededAt)))
    .returning({ id: messageRetentionPolicies.id })
  const [row] = await tx
    .insert(messageRetentionPolicies)
    .values({
      organizationId: actor.organizationId,
      policyReference,
      authorityReference,
      retentionDays: input.retentionDays,
      adoptedBy: actor.userId,
    })
    .returning()
  await persistAtomicAudit(tx, {
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: 'messages.retention.adopt',
    resourceType: 'message_retention_policies',
    resourceId: row.id,
    details: { retentionDays: input.retentionDays, supersededPolicyId: superseded?.id ?? null },
  })
  return {
    kind: 'ok',
    policy: {
      id: row.id,
      policyReference: row.policyReference,
      authorityReference: row.authorityReference,
      retentionDays: row.retentionDays,
      adoptedBy: row.adoptedBy,
      adoptedAt: new Date(row.adoptedAt).toISOString(),
    },
  }
}

export const LIFECYCLE_ACTIONS = ['close', 'archive'] as const
export const HOLD_ACTIONS = ['place', 'release'] as const
