import { sql } from 'drizzle-orm'
import { messageThreadReads } from '@/db/schema/messages-schema'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import type { CaseActor } from '@/lib/cases/case-authorization'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { findReadableThread, isOpenThread } from '@/lib/messaging/thread-access'
import { memberRetentionView, threadRetention, type MemberRetention, type RetentionState } from '@/lib/messaging/thread-lifecycle'

/**
 * Read state. A participant's marker records when they last opened the conversation, so the other side can be told
 * "read" without being told by whom. A marker only moves when the participant has something they had not yet seen, so
 * re-opening a conversation neither writes nor audits. The time comes from the database, never the application clock.
 */
export type ReadResult = { kind: 'ok'; changed: boolean } | { kind: 'not_found' }

export async function markThreadRead(tx: RLSTx, actor: CaseActor, threadId: string): Promise<ReadResult> {
  const thread = await findReadableThread(tx, actor, threadId)
  if (!thread) return { kind: 'not_found' }

  const result = await tx.execute(sql`SELECT EXISTS (
    SELECT 1 FROM messages m
    WHERE m.thread_id = ${thread.id}::uuid AND m.sender_id <> ${actor.userId}
      AND m.created_at > coalesce(
        (SELECT r.last_read_at FROM message_thread_reads r WHERE r.thread_id = ${thread.id}::uuid AND r.user_id = ${actor.userId}),
        '-infinity'::timestamptz)
  ) AS unread`)
  const rows = (Array.isArray(result) ? result : ((result as { rows?: unknown[] }).rows ?? [])) as Array<Record<string, unknown>>
  if (rows[0]?.unread !== true) return { kind: 'ok', changed: false }

  await tx
    .insert(messageThreadReads)
    .values({ threadId: thread.id, userId: actor.userId, organizationId: actor.organizationId, lastReadAt: sql`now()` })
    .onConflictDoUpdate({
      target: [messageThreadReads.threadId, messageThreadReads.userId],
      set: { lastReadAt: sql`greatest(${messageThreadReads.lastReadAt}, now())`, updatedAt: sql`now()` },
    })
  await persistAtomicAudit(tx, {
    organizationId: actor.organizationId,
    userId: actor.userId,
    action: 'messages.thread.read',
    resourceType: 'message_threads',
    resourceId: thread.id,
    details: {},
  })
  return { kind: 'ok', changed: true }
}

export interface ThreadDetail {
  id: string
  subject: string
  status: string
  isArchived: boolean
  representativeAssigned: boolean
  viewerRole: 'member' | 'assignee'
  canReply: boolean
  canClose: boolean
  canArchive: boolean
  /** The conversation's member sees a plain statement; its assignee sees the full position (never a hold reference). */
  retention: { audience: 'member'; state: MemberRetention } | ({ audience: 'staff' } & RetentionState)
}

export async function getThreadDetail(tx: RLSTx, actor: CaseActor, threadId: string, now = new Date()): Promise<ThreadDetail | null> {
  const thread = await findReadableThread(tx, actor, threadId)
  if (!thread) return null
  const viewerRole = thread.memberId === actor.userId ? 'member' : 'assignee'
  const retention = await threadRetention(tx, thread, now)
  return {
    id: thread.id,
    subject: thread.subject,
    status: thread.status,
    isArchived: Boolean(thread.isArchived),
    representativeAssigned: Boolean(thread.staffId),
    viewerRole,
    canReply: isOpenThread(thread),
    canClose: thread.status !== 'closed',
    canArchive: thread.status === 'closed' && !thread.isArchived,
    retention: viewerRole === 'member' ? { audience: 'member', state: memberRetentionView(retention) } : { audience: 'staff', ...retention },
  }
}
