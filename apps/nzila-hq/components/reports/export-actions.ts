'use server'

/**
 * Server actions for audit-logged export operations.
 *
 * Client export buttons fire-and-forget these so we get a row in
 * `hq_audit_log` for every download, without blocking the actual file
 * generation. Failure here NEVER throws — audit must not break export.
 */
import { resolveOrgContext } from '@/lib/resolve-org'
import { recordAudit, type AuditAction } from '@/server/db/audit'

export async function logReportExport(input: {
  kind: string
  filename: string
  byteCount?: number
}): Promise<void> {
  try {
    const ctx = await resolveOrgContext()
    const action: AuditAction = input.kind.startsWith('board-pack')
      ? 'export.board-pack'
      : 'export.report'
    await recordAudit({
      actorUserId: ctx.userId,
      actorRole: ctx.role,
      action,
      resourceKind: 'report',
      resourceId: input.kind,
      metadata: { filename: input.filename, byteCount: input.byteCount ?? null },
    })
  } catch {
    // never throw to client
  }
}
