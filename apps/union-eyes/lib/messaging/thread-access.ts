import { and, asc, desc, eq, or, sql, type SQL } from 'drizzle-orm'
import { messages, messageThreads } from '@/db/schema/messages-schema'
import { inAppNotifications } from '@/db/schema'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { notifyTriagers } from '@/lib/messaging/thread-assignment'
import type { CaseActor } from '@/lib/cases/case-authorization'
import { caseActionAllowed } from '@/lib/cases/case-permissions'
import type { RLSTx } from '@/lib/db/with-rls-context'

/**
 * Conversation authority. message_threads/messages carry tenant RLS only, so participation is
 * enforced here: a member sees threads they own; staff see threads they are assigned to or own.
 * Seniority never confers a tenant-wide read of private conversations, and same-organization
 * membership grants nothing. Unassigned threads stay invisible to staff until an assignment
 * mechanism exists (UE-CONV-I-001).
 *
 * The runtime role holds SELECT and INSERT only on these tables (db/rls-storage-authority), so
 * nothing here updates or locks a row: last activity is derived from the messages, and read state
 * is not persisted. Persisting it needs a governed privilege change, not a local grant.
 */
export const MAX_SUBJECT = 200
export const MAX_BODY = 5000

export function isOpenThread(thread: { status: string; isArchived: boolean | null }): boolean {
  return thread.status === 'open' && !thread.isArchived
}

export function threadReadScope(actor: CaseActor): SQL {
  const tenant = eq(messageThreads.organizationId, actor.organizationId)
  const own = eq(messageThreads.memberId, actor.userId)
  return and(
    tenant,
    caseActionAllowed('note_add_internal', actor.role) ? or(own, eq(messageThreads.staffId, actor.userId)) : own,
  )!
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
}

export interface MessageView {
  id: string
  fromMe: boolean
  senderKind: 'member' | 'union' | 'system'
  content: string | null
  createdAt: string
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null)

// Written out in full: Drizzle drops the table prefix on single-table selects, which would make `id` bind to `m.id`.
const lastActivity = sql<Date | null>`(select max(m.created_at) from messages m where m.thread_id = message_threads.id)`

export async function listThreads(tx: RLSTx, actor: CaseActor): Promise<ThreadView[]> {
  const threads = await tx
    .select({ thread: messageThreads, lastActivity })
    .from(messageThreads)
    .where(threadReadScope(actor))
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
  }))
}

export async function findReadableThread(tx: RLSTx, actor: CaseActor, threadId: string) {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(threadId)) return null
  const [thread] = await tx.select().from(messageThreads).where(and(threadReadScope(actor), eq(messageThreads.id, threadId))).limit(1)
  return thread ?? null
}

function toView(m: typeof messages.$inferSelect, actor: CaseActor): MessageView {
  return {
    id: m.id,
    fromMe: m.senderId === actor.userId,
    // Sender identifiers are never exposed; a member only learns whether the union or they wrote it.
    senderKind: m.messageType === 'system' ? 'system' : m.senderRole === 'member' ? 'member' : 'union',
    content: m.content,
    createdAt: iso(m.createdAt)!,
  }
}

export async function listThreadMessages(tx: RLSTx, actor: CaseActor, threadId: string): Promise<MessageView[] | null> {
  const thread = await findReadableThread(tx, actor, threadId)
  if (!thread) return null
  const rows = await tx.select().from(messages).where(eq(messages.threadId, thread.id)).orderBy(asc(messages.createdAt)).limit(500)
  return rows.map((m) => toView(m, actor))
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

  // The counterpart is told that a message exists, never what it says. Only a member has a conversation page to open.
  const recipient = isMemberOf(actor, thread) ? thread.staffId : thread.memberId
  const recipientIsMember = recipient !== null && recipient === thread.memberId
  if (recipient && recipient !== actor.userId && (await notifyAllowed(recipient))) {
    await tx.insert(inAppNotifications).values({
      userId: recipient,
      organizationId: actor.organizationId,
      title: 'New secure message',
      message: 'You have a new message in a secure conversation.',
      type: 'info',
      ...(recipientIsMember ? { actionLabel: 'Open conversation', actionUrl: `/dashboard/messages?thread=${thread.id}` } : {}),
      data: { event: 'thread_message', threadId: thread.id },
    })
  }
  return { kind: 'ok', duplicate: false, thread, message: toView(row, actor) }
}
