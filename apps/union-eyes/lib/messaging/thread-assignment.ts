import { and, asc, eq, isNull, sql } from 'drizzle-orm'
import { inAppNotifications } from '@/db/schema'
import { messageThreads, messageThreadAssignments } from '@/db/schema/messages-schema'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { hasLiveDesignation, liveDesignees } from '@/lib/triage/designations'
import { staffMembershipLive } from '@/lib/messaging/staff-liveness'

/**
 * Staff assignment of member conversations.
 *
 * Authority is never derived from rank. A person acts on a conversation as
 *   - the current assignee (reply, reassign, release), or
 *   - the holder of a live `messages` triage designation (lib/triage/designations: see the unassigned queue's
 *     metadata, assign, reassign, release). A designation never exposes message content.
 *
 * Every decision is recorded twice, inside the caller's transaction: the append-only assignment history and the
 * mandatory audit. The thread change is a conditional UPDATE, so concurrent decisions cannot both win and no row
 * lock is required.
 */
export interface MessageActor {
  userId: string
  organizationId: string
}

export const MAX_REASON = 1000

export interface QueueItem {
  id: string
  subject: string
  category: string | null
  priority: string | null
  createdAt: string
}

type Dependencies = {
  /** True only for a live, active staff member of the actor's organization (eligibility, not access). */
  assigneeEligible: (userId: string) => Promise<boolean>
  notifyAllowed?: (recipientId: string) => Promise<boolean>
  now?: () => Date
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null)
const clock = (deps: { now?: () => Date }) => (deps.now ?? (() => new Date()))()

export const hasLiveTriageDesignation = async (tx: RLSTx, actor: MessageActor, now = new Date()) =>
  // A designation is held by a person; it works only while that person is still an active staff member.
  (await staffMembershipLive(tx, actor)) && hasLiveDesignation(tx, actor, 'messages', now)

/** Unassigned open conversations, metadata only. `null` when the caller holds no live designation. */
export async function listTriageQueue(tx: RLSTx, actor: MessageActor, now = new Date()): Promise<QueueItem[] | null> {
  if (!(await hasLiveTriageDesignation(tx, actor, now))) return null
  const rows = await tx
    .select({
      id: messageThreads.id,
      subject: messageThreads.subject,
      category: messageThreads.category,
      priority: messageThreads.priority,
      createdAt: messageThreads.createdAt,
    })
    .from(messageThreads)
    .where(
      and(
        eq(messageThreads.organizationId, actor.organizationId),
        isNull(messageThreads.staffId),
        eq(messageThreads.status, 'open'),
        eq(messageThreads.isArchived, false),
        // A person never triages their own conversation.
        sql`${messageThreads.memberId} <> ${actor.userId}`,
      ),
    )
    .orderBy(asc(messageThreads.createdAt))
    .limit(100)
  return rows.map((r) => ({ ...r, createdAt: iso(r.createdAt)! }))
}

/** Tells every live triager that a conversation is waiting; the notice carries no content. */
export async function notifyTriagers(tx: RLSTx, organizationId: string, threadId: string, exceptUserId: string, now = new Date()): Promise<number> {
  const recipients = await liveDesignees(tx, organizationId, 'messages', exceptUserId, now)
  if (recipients.length === 0) return 0
  await tx.insert(inAppNotifications).values(
    recipients.map((userId) => ({
      userId,
      organizationId,
      title: 'Conversation waiting for assignment',
      message: 'A member conversation is waiting in the triage queue.',
      type: 'info',
      data: { event: 'thread_triage_waiting', threadId },
    })),
  )
  return recipients.length
}

export type AssignInput =
  | { threadId: string; action: 'assign' | 'reassign'; toStaffId: string; reason?: string }
  | { threadId: string; action: 'release'; reason?: string }

export type AssignResult =
  | { kind: 'ok'; action: 'assign' | 'reassign' | 'release'; staffId: string | null }
  | { kind: 'not_found' }
  | { kind: 'forbidden' }
  | { kind: 'closed' }
  | { kind: 'ineligible_assignee' }
  | { kind: 'conflict'; code: 'ALREADY_ASSIGNED' | 'NOT_ASSIGNED' | 'SAME_ASSIGNEE' | 'CHANGED_CONCURRENTLY' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function assignThread(tx: RLSTx, actor: MessageActor, input: AssignInput, deps: Dependencies): Promise<AssignResult> {
  const now = clock(deps)
  if (!UUID.test(input.threadId)) return { kind: 'not_found' }
  const [thread] = await tx
    .select()
    .from(messageThreads)
    .where(and(eq(messageThreads.id, input.threadId), eq(messageThreads.organizationId, actor.organizationId)))
    .limit(1)
  if (!thread) return { kind: 'not_found' }

  const isAssignee = thread.staffId !== null && thread.staffId === actor.userId && (await staffMembershipLive(tx, actor))
  const isTriager = await hasLiveTriageDesignation(tx, actor, now)
  // Authority comes from holding the thread or a live designation. Anyone else cannot even tell the thread exists.
  if (!isAssignee && !isTriager) return { kind: 'not_found' }
  // Nobody decides who serves their own conversation.
  if (thread.memberId === actor.userId) return { kind: 'forbidden' }
  if (thread.status !== 'open' || thread.isArchived) return { kind: 'closed' }

  const from = thread.staffId
  let to: string | null = null
  if (input.action === 'assign') {
    if (from !== null) return { kind: 'conflict', code: 'ALREADY_ASSIGNED' }
    if (!isTriager) return { kind: 'forbidden' }
  } else {
    if (from === null) return { kind: 'conflict', code: 'NOT_ASSIGNED' }
  }
  if (input.action !== 'release') {
    to = input.toStaffId
    if (to === from) return { kind: 'conflict', code: 'SAME_ASSIGNEE' }
    if (to === thread.memberId || !(await deps.assigneeEligible(to))) return { kind: 'ineligible_assignee' }
  }

  const updated = await tx
    .update(messageThreads)
    .set({ staffId: to, updatedAt: now })
    .where(
      and(
        eq(messageThreads.id, thread.id),
        eq(messageThreads.organizationId, actor.organizationId),
        from === null ? isNull(messageThreads.staffId) : eq(messageThreads.staffId, from),
      ),
    )
    .returning({ id: messageThreads.id })
  if (updated.length === 0) return { kind: 'conflict', code: 'CHANGED_CONCURRENTLY' }

  const reason = input.reason?.trim().slice(0, MAX_REASON) || null
  const [record] = await tx
    .insert(messageThreadAssignments)
    .values({
      organizationId: actor.organizationId,
      threadId: thread.id,
      action: input.action,
      fromStaffId: from,
      toStaffId: to,
      actedBy: actor.userId,
      actedVia: isAssignee ? 'current_assignee' : 'triage_designation',
      reason,
      createdAt: now,
    })
    .returning({ id: messageThreadAssignments.id })

  if (to && to !== actor.userId && (deps.notifyAllowed ? await deps.notifyAllowed(to) : true)) {
    await tx.insert(inAppNotifications).values({
      userId: to,
      organizationId: actor.organizationId,
      title: 'Conversation assigned to you',
      message: 'A member conversation has been assigned to you.',
      type: 'info',
      actionLabel: 'Open conversation',
      actionUrl: `/dashboard/messages/staff?thread=${thread.id}`,
      data: { event: 'thread_assigned', threadId: thread.id },
    })
  }

  await persistAtomicAudit(tx, {
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: `messages.thread.${input.action}`,
    resourceType: 'message_threads',
    resourceId: thread.id,
    details: { assignmentId: record?.id ?? null, from, to, via: isAssignee ? 'current_assignee' : 'triage_designation' },
  })
  return { kind: 'ok', action: input.action, staffId: to }
}
