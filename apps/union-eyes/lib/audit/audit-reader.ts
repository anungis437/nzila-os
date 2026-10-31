/**
 * Audit reader: what the audit routes show.
 *
 * Two stores hold audit records. persistAtomicAudit writes the hash-chained public.audit_logs (the Django core table) when the
 * canonical state context is on, and the legacy audit_security.audit_logs table otherwise. The audit routes read only the legacy
 * table, so in canonical mode they could not show a single record the mandatory writers produce, including the 'audit.entry.read'
 * record the detail route wrote itself.
 *
 * Both are read here, in the caller's tenant transaction, and each entry says which store it came from. The canonical table records
 * no severity and no outcome, so those are reported as null rather than invented. Nothing from details, changes, addresses or session
 * data is returned: those can hold confidential member information.
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import { auditLogs } from '@/db/schema/audit-security-schema'
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap'
import type { RLSTx } from '@/lib/db/with-rls-context'

export interface AuditEntryView {
  auditId: string
  action: string
  resourceType: string
  resourceId: string | null
  userId: string | null
  severity: string | null
  outcome: string | null
  createdAt: Date | null
  source: 'canonical' | 'legacy'
}

export const AUDIT_LIST_LIMIT = 100

type CanonicalRow = {
  audit_id: string
  action: string
  resource_type: string
  resource_id: string | null
  user_id: string | null
  created_at: Date | string | null
}

const fromCanonical = (row: CanonicalRow): AuditEntryView => ({
  auditId: row.audit_id,
  action: row.action,
  resourceType: row.resource_type,
  resourceId: row.resource_id ? String(row.resource_id) : null,
  userId: row.user_id ?? null,
  severity: null,
  outcome: null,
  createdAt: row.created_at ? new Date(row.created_at) : null,
  source: 'canonical',
})

export async function listAuditEntries(tx: RLSTx, organizationId: string, limit = AUDIT_LIST_LIMIT): Promise<AuditEntryView[]> {
  const bound = Math.min(Math.max(1, Math.trunc(limit)), AUDIT_LIST_LIMIT)
  const legacy = await tx
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.organizationId, organizationId))
    .orderBy(desc(auditLogs.createdAt))
    .limit(bound)
  const entries: AuditEntryView[] = legacy.map((row) => ({
    auditId: row.auditId,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId ?? null,
    userId: row.userId ?? null,
    severity: row.severity ?? null,
    outcome: row.outcome ?? null,
    createdAt: row.createdAt ?? null,
    source: 'legacy',
  }))

  if (currentStateContextEnabled()) {
    const canonical = (await tx.execute(
      sql`SELECT audit_id, action, resource_type, resource_id, user_id, created_at
          FROM public.audit_logs
          WHERE organization_id = ${organizationId}::uuid
          ORDER BY created_at DESC, id DESC
          LIMIT ${bound}`,
    )) as unknown as CanonicalRow[]
    entries.push(...canonical.map(fromCanonical))
  }

  return entries
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
    .slice(0, bound)
}

export async function readAuditEntry(tx: RLSTx, organizationId: string, auditId: string): Promise<AuditEntryView | null> {
  if (currentStateContextEnabled()) {
    const [row] = (await tx.execute(
      sql`SELECT audit_id, action, resource_type, resource_id, user_id, created_at
          FROM public.audit_logs
          WHERE audit_id = ${auditId}::uuid AND organization_id = ${organizationId}::uuid
          LIMIT 1`,
    )) as unknown as CanonicalRow[]
    if (row) return fromCanonical(row)
  }
  const [legacy] = await tx
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.auditId, auditId), eq(auditLogs.organizationId, organizationId)))
    .limit(1)
  if (!legacy) return null
  return {
    auditId: legacy.auditId,
    action: legacy.action,
    resourceType: legacy.resourceType,
    resourceId: legacy.resourceId ?? null,
    userId: legacy.userId ?? null,
    severity: legacy.severity ?? null,
    outcome: legacy.outcome ?? null,
    createdAt: legacy.createdAt ?? null,
    source: 'legacy',
  }
}
