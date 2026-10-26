import { and, asc, desc, eq, or, sql, type SQL } from 'drizzle-orm'
import { messages, messageThreads } from '@/db/schema/messages-schema'
import { inAppNotifications } from '@/db/schema'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { notifyTriagers } from '@/lib/messaging/thread-assignment'
import type { CaseActor } from '@/lib/cases/case-authorization'
import { caseActionAllowed } from '@/lib/cases/case-permissions'
import { staffMembershipLive } from '@/lib/messaging/staff-liveness'
import type { RLSTx } from '@/lib/db/with-rls-context'

/**
 * Conversation authority. message_threads/messages carry tenant RLS only, so participation is
 * enforced here: a member sees threads they own; staff see threads they are assigned to or own, and only while their
 * own membership is still live (re-read in the same transaction on every call). Seniority never confers a tenant-wide
 * read of private conversations, and same-organization membership grants nothing. Unassigned threads stay invisible to
 * staff until a triager assigns them (UE-CONV-I-002).
 *
 * The runtime role holds SELECT and INSERT on messages and SELECT, INSERT and UPDATE on message_threads, where UPDATE
 * is limited by trigger to assignment and lifecycle. Reading never writes; read state is recorded separately by
 * lib/messaging/thread-read-state.
 */
export const MAX_SUBJECT = 200
export const MAX_BODY = 5000

export function isOpenThread(thread: { status: string; isArchived: boolean | null }): boolean {
  return thread.status === 'open' && !thread.isArchived
}

/** Staff participation needs a staff policy role AND a membership that is live now. */
export async function staffActing(tx: RLSTx, actor: CaseActor): Promise<boolean> {
  return caseActionAllowed('note_add_internal', actor.role) && (await staffMembershipLive(tx, actor))
}

export function threadReadScope(actor: CaseActor, staffLive: boolean): SQL {
  const tenant = eq(messageThreads.organizationId, actor.organizationId)
  const own = eq(messageThreads.memberId, actor.userId)
  return and(tenant, staffLive ? or(own, eq(messageThreads.staffId, actor.userId)) : own)!
}

const isMemberOf = (actor: CaseActor, thread: { memberId: string }) => thread.memberId === actor.userId

export interface ThreadView {
  id: string
  subject: string
  status: string
  isArchived: boolean
  lastMessageAt: string | null
  createdAt: string
  representativeAssigned: boolean
  /** `member` for the conversation's owner, `assignee` for the staff member it is assigned to. */
  viewerRole: 'member' | 'assignee'
}

export interface MessageView {
  id: string
  fromMe: boolean
  senderKind: 'member' | 'union' | 'system'
  content: string | null
  createdAt: string
  /** Whether the other side has opened the conversation since this message was written. Never says who. */
  readByCounterpart: boolean
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null)

// Written out in full: Drizzle drops the table prefix on single-table selects, which would make `id` bind to `m.id`.
const lastActivity = sql<Date | null>`(select max(m.created_at) from messages m where m.thread_id = message_threads.id)`

// A member's message is read by anyone but the member; the union's message is read by the member.
const readByCounterpart = sql<boolean>`EXISTS (
  SELECT 1 FROM message_thread_reads r JOIN message_threads rt ON rt.id = r.thread_id
  WHERE r.thread_id = messages.thread_id AND r.last_read_at >= messages.created_at
    AND (CASE WHEN messages.sender_id = rt.member_id THEN r.user_id <> rt.member_id ELSE r.user_id = rt.member_id END))`

export async function listThreads(tx: RLSTx, actor: CaseActor): Promise<ThreadView[]> {
  const staffLive = await staffActing(tx, actor)
  const threads = await tx
    .select({ thread: messageThreads, lastActivity })
    .from(messageThreads)
    .where(threadReadScope(actor, staffLive))
    .orderBy(desc(sql`coalesce(${lastActivity}, ${messageThreads.createdAt})`))
    .limit(100)
  return threads.map(({ thread: t, lastActivity: last }) => ({
    id: t.id,
    subject: t.subject,
    status: t.status,
    isArchived: Boolean(t.isArchived),
    lastMessageAt: iso(last),
    createdAt: iso(t.createdAt)!,
    representativeAssigned: Boolean(t.staffId),
    viewerRole: t.memberId === actor.userId ? 'member' : 'assignee',
  }))
}

export async function findReadableThread(tx: RLSTx, actor: CaseActor, threadId: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(threadId)) return null
  const staffLive = await staffActing(tx, actor)
  const [thread] = await tx.select().from(messageThreads).where(and(threadReadScope(actor, staffLive), eq(messageThreads.id, threadId))).limit(1)
  return thread ?? null
}

function toView(m: typeof messages.$inferSelect, actor: CaseActor, read = false): MessageView {
  return {
    id: m.id,
    fromMe: m.senderId === actor.userId,
    // Sender identifiers are never exposed; a member only learns whether the union or they wrote it.
    senderKind: m.messageType === 'system' ? 'system' : m.senderRole === 'member' ? 'member' : 'union',
    content: m.content,
    createdAt: iso(m.createdAt)!,
    readByCounterpart: read,
  }
}

export async function listThreadMessages(tx: RLSTx, actor: CaseActor, threadId: string): Promise<MessageView[] | null> {
  const thread = await findReadableThread(tx, actor, threadId)
  if (!thread) return null
  const rows = await tx
    .select({ message: messages, read: readByCounterpart })
    .from(messages)
    .where(eq(messages.threadId, thread.id))
    .orderBy(asc(messages.createdAt))
    .limit(500)
  return rows.map((r) => toView(r.message, actor, Boolean(r.read)))
}


export async function createMemberThread(tx: RLSTx, actor: CaseActor, input: { subject: string; body: string; clientRequestId?: string }) {
  const [thread] = await tx
    .insert(messageThreads)
    .values({ subject: input.subject, memberId: actor.userId, organizationId: actor.organizationId, category: 'general' })
    .returning()
  await tx.insert(messages).values({
    threadId: thread.id,
    senderId: actor.userId,
    senderRole: 'member',
    content: input.body,
    metadata: input.clientRequestId ? JSON.stringify({ clientRequestId: input.clientRequestId }) : null,
  })
  // The new conversation reaches the authorized queue: every live triager is told, without content.
  await notifyTriagers(tx, actor.organizationId, thread.id, actor.userId)
  // The thread, its first message and the audit commit together.
  await persistAtomicAudit(tx, {
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: 'messages.thread.create',
    resourceType: 'message_threads',
    resourceId: thread.id,
    details: {},
  })
  return thread
}

export type PostResult =
  | { kind: 'not_found' }
  | { kind: 'closed' }
  | { kind: 'ok'; message: MessageView; duplicate: boolean; thread: typeof messageThreads.$inferSelect }

export async function postThreadMessage(
  tx: RLSTx,
  actor: CaseActor,
  threadId: string,
  input: { body: string; clientRequestId?: string },
  notifyAllowed: (recipientId: string) => Promise<boolean> = async () => true,
): Promise<PostResult> {
  const thread = await findReadableThread(tx, actor, threadId)
  if (!thread) return { kind: 'not_found' }
  if (!isOpenThread(thread)) return { kind: 'closed' }

  const metadata = input.clientRequestId ? JSON.stringify({ clientRequestId: input.clientRequestId }) : null
  if (metadata) {
    const [existing] = await tx
      .select()
      .from(messages)
      .where(and(eq(messages.threadId, thread.id), eq(messages.senderId, actor.userId), eq(messages.metadata, metadata)))
      .limit(1)
    if (existing) return { kind: 'ok', duplicate: true, thread, message: toView(existing, actor) }
  }

  const [row] = await tx
    .insert(messages)
    .values({ threadId: thread.id, senderId: actor.userId, senderRole: isMemberOf(actor, thread) ? 'member' : 'staff', content: input.body, metadata })
    .returning()
  await persistAtomicAudit(tx, {
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: 'messages.message.create',
    resourceType: 'messages',
    resourceId: row.id,
    details: { threadId: thread.id },
  })

  // The counterpart is told that a message exists, never what it says. Each side is sent to the page it can open.
  const recipient = isMemberOf(actor, thread) ? thread.staffId : thread.memberId
  const recipientIsMember = recipient !== null && recipient === thread.memberId
  if (recipient && recipient !== actor.userId && (await notifyAllowed(recipient))) {
    await tx.insert(inAppNotifications).values({
      userId: recipient,
      organizationId: actor.organizationId,
      title: 'New secure message',
      message: 'You have a new message in a secure conversation.',
      type: 'info',
      actionLabel: 'Open conversation',
      actionUrl: recipientIsMember ? `/dashboard/messages?thread=${thread.id}` : `/dashboard/messages/staff?thread=${thread.id}`,
      data: { event: 'thread_message', threadId: thread.id },
    })
  }
  return { kind: 'ok', duplicate: false, thread, message: toView(row, actor) }
}
