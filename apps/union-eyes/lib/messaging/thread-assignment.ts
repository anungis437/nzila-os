import { and, asc, desc, eq, gt, isNull, lte, sql } from 'drizzle-orm'
import { inAppNotifications } from '@/db/schema'
import { messageThreads, messageThreadAssignments, messageTriageDesignations } from '@/db/schema/messages-schema'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import type { RLSTx } from '@/lib/db/with-rls-context'

/**
 * Staff assignment of member conversations.
 *
 * Authority is never derived from rank. A person acts on a conversation as
 *   - the current assignee (reply, reassign, release), or
 *   - the holder of a live triage designation (see the unassigned queue's metadata, assign, reassign, release).
 * A designation is granted by an administrator, expires, and can be revoked; it never exposes message content.
 *
 * Every decision is recorded twice, inside the caller's transaction: the append-only assignment history and the
 * mandatory audit. The thread change is a conditional UPDATE, so concurrent decisions cannot both win and no row
 * lock is required.
 */
export interface MessageActor {
  userId: string
  organizationId: string
}

export const TRIAGE_MAX_DAYS = 90
export const MAX_REASON = 1000

export interface QueueItem {
  id: string
  subject: string
  category: string | null
  priority: string | null
  createdAt: string
}

export interface Designation {
  id: string
  userId: string
  grantedBy: string
  grantedAt: string
  expiresAt: string
  revokedAt: string | null
}

type Dependencies = {
  /** True only for a live, active staff member of the actor's organization (eligibility, not access). */
  assigneeEligible: (userId: string) => Promise<boolean>
  notifyAllowed?: (recipientId: string) => Promise<boolean>
  now?: () => Date
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null)
const clock = (deps: { now?: () => Date }) => (deps.now ?? (() => new Date()))()

function liveDesignation(actor: MessageActor, userId: string, now: Date) {
  return and(
    eq(messageTriageDesignations.organizationId, actor.organizationId),
    eq(messageTriageDesignations.userId, userId),
    isNull(messageTriageDesignations.revokedAt),
    gt(messageTriageDesignations.expiresAt, now),
  )
}

export async function hasLiveTriageDesignation(tx: RLSTx, actor: MessageActor, now = new Date()): Promise<boolean> {
  const [row] = await tx
    .select({ id: messageTriageDesignations.id })
    .from(messageTriageDesignations)
    .where(liveDesignation(actor, actor.userId, now))
    .limit(1)
  return Boolean(row)
}

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
  const designations = await tx
    .select({ userId: messageTriageDesignations.userId })
    .from(messageTriageDesignations)
    .where(
      and(
        eq(messageTriageDesignations.organizationId, organizationId),
        isNull(messageTriageDesignations.revokedAt),
        gt(messageTriageDesignations.expiresAt, now),
      ),
    )
    .limit(50)
  const recipients = designations.map((d) => d.userId).filter((id) => id !== exceptUserId)
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

  const isAssignee = thread.staffId !== null && thread.staffId === actor.userId
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
      // No action link: the staff conversation surface is not built, and the member page would not admit staff.
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

export type GrantResult =
  | { kind: 'ok'; designation: Designation }
  | { kind: 'invalid_expiry' }
  | { kind: 'ineligible' }
  | { kind: 'self_grant' }
  | { kind: 'conflict' }

const toDesignation = (r: typeof messageTriageDesignations.$inferSelect): Designation => ({
  id: r.id,
  userId: r.userId,
  grantedBy: r.grantedBy,
  grantedAt: iso(r.grantedAt)!,
  expiresAt: iso(r.expiresAt)!,
  revokedAt: iso(r.revokedAt),
})

/** The caller must already be authorized to grant (an organization administrator); this records the decision. */
export async function grantTriageDesignation(
  tx: RLSTx,
  actor: MessageActor,
  input: { userId: string; expiresAt: Date },
  deps: Pick<Dependencies, 'assigneeEligible' | 'now'>,
): Promise<GrantResult> {
  const now = clock(deps)
  const limit = new Date(now.getTime() + TRIAGE_MAX_DAYS * 86_400_000)
  if (!(input.expiresAt.getTime() > now.getTime()) || input.expiresAt.getTime() > limit.getTime()) return { kind: 'invalid_expiry' }
  if (input.userId === actor.userId) return { kind: 'self_grant' }
  if (!(await deps.assigneeEligible(input.userId))) return { kind: 'ineligible' }

  // A designation that has already lapsed must not block a fresh grant: record its end first.
  await tx
    .update(messageTriageDesignations)
    .set({ revokedAt: now, revokedBy: 'system:expiry' })
    .where(
      and(
        eq(messageTriageDesignations.organizationId, actor.organizationId),
        eq(messageTriageDesignations.userId, input.userId),
        isNull(messageTriageDesignations.revokedAt),
        lte(messageTriageDesignations.expiresAt, now),
      ),
    )
  const [existing] = await tx
    .select({ id: messageTriageDesignations.id })
    .from(messageTriageDesignations)
    .where(liveDesignation(actor, input.userId, now))
    .limit(1)
  if (existing) return { kind: 'conflict' }

  const [row] = await tx
    .insert(messageTriageDesignations)
    .values({
      organizationId: actor.organizationId,
      userId: input.userId,
      grantedBy: actor.userId,
      grantedAt: now,
      expiresAt: input.expiresAt,
    })
    .returning()
  await persistAtomicAudit(tx, {
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: 'messages.triage_designation.grant',
    resourceType: 'message_triage_designations',
    resourceId: row.id,
    details: { designatedUserId: input.userId, expiresAt: input.expiresAt.toISOString() },
  })
  return { kind: 'ok', designation: toDesignation(row) }
}

export type RevokeResult = { kind: 'ok' } | { kind: 'not_found' }

export async function revokeTriageDesignation(
  tx: RLSTx,
  actor: MessageActor,
  designationId: string,
  deps: Pick<Dependencies, 'now'> = {},
): Promise<RevokeResult> {
  const now = clock(deps)
  if (!UUID.test(designationId)) return { kind: 'not_found' }
  const [row] = await tx
    .update(messageTriageDesignations)
    .set({ revokedAt: now, revokedBy: actor.userId })
    .where(
      and(
        eq(messageTriageDesignations.id, designationId),
        eq(messageTriageDesignations.organizationId, actor.organizationId),
        isNull(messageTriageDesignations.revokedAt),
      ),
    )
    .returning()
  if (!row) return { kind: 'not_found' }
  await persistAtomicAudit(tx, {
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: 'messages.triage_designation.revoke',
    resourceType: 'message_triage_designations',
    resourceId: row.id,
    details: { designatedUserId: row.userId },
  })
  return { kind: 'ok' }
}

export async function listTriageDesignations(tx: RLSTx, actor: MessageActor): Promise<Designation[]> {
  const rows = await tx
    .select()
    .from(messageTriageDesignations)
    .where(eq(messageTriageDesignations.organizationId, actor.organizationId))
    .orderBy(desc(messageTriageDesignations.grantedAt))
    .limit(200)
  return rows.map(toDesignation)
}
