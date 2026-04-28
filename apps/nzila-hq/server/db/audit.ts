/**
 * Audit log writer — Phase 12 governance.
 *
 * Records sensitive operations (export, edit, role-change, view-finance) to
 * `hq_audit_log` when DATABASE_URL is configured, otherwise no-ops silently
 * so dev/test runs don't break. Designed to be called from server actions
 * and server components; never from client components.
 *
 * The function is fire-and-forget on the hot path (returns void), but it
 * awaits the insert internally so unhandled rejections surface in logs.
 * Failures NEVER throw to the caller — an audit-write failure must not
 * break the user's underlying operation.
 */
import 'server-only'
import { getHqDb } from './client'
import { auditLog } from './schema'

export type AuditAction =
  | 'export.report'
  | 'export.board-pack'
  | 'view.finance'
  | 'view.chief-of-staff'
  | 'edit.venture'
  | 'edit.opportunity'
  | 'edit.task'
  | 'reassign.task'
  | 'rbac.denied'

export interface AuditEntryInput {
  actorUserId: string
  actorRole: string
  action: AuditAction
  resourceKind: string
  resourceId?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
  userAgent?: string | null
}

export async function recordAudit(entry: AuditEntryInput): Promise<void> {
  const db = getHqDb()
  if (!db) return // dev/test without DB — silent no-op
  try {
    await db.insert(auditLog).values({
      actorUserId: entry.actorUserId,
      actorRole: entry.actorRole,
      action: entry.action,
      resourceKind: entry.resourceKind,
      resourceId: entry.resourceId ?? null,
      metadata: entry.metadata,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    })
  } catch (err) {
    // Never throw to caller — audit failure must not block primary op.
    // Surface to stderr so observability picks it up.
     
    console.error('[audit] insert failed', { action: entry.action, err: String(err) })
  }
}

/**
 * Reads the most-recent audit entries for the audit-log viewer page.
 * Returns [] when the DB is unavailable.
 */
export async function listRecentAudit(limit = 50) {
  const db = getHqDb()
  if (!db) return []
  try {
    return await db.select().from(auditLog).orderBy(auditLog.occurredAt).limit(limit)
  } catch (err) {
     
    console.error('[audit] list failed', String(err))
    return []
  }
}
