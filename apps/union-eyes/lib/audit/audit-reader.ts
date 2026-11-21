/**
 * Audit reader: what the audit routes show.
 *
 * Two stores hold audit records, and a deployment reads the one it writes. persistAtomicAudit writes the hash-chained public.audit_logs
 * (the Django core table) when the canonical state context is on, and the legacy audit_security.audit_logs table otherwise.
 *
 * In canonical mode the legacy store is not read at all: the canonical current-security source grants the runtime role no usage of the
 * audit_security schema (tooling/scripts/write-union-eyes-current-catalog.ts: runtimeSchemaUsage ['public','user_management'] and
 * audit_security.audit_logs with no runtime privilege; the V2 source plan excludes that table), so a read of it can only fail. Outside
 * canonical mode only the legacy store exists for the application. Each entry says which store it came from. The canonical table records
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

/**
 * The legacy columns an audit entry shows, and only those: the query never reads addresses, user agents, session ids,
 * metadata or the old/new payloads, so they cannot reach a response even by mistake.
 */
const legacyEntryColumns = () => ({
  auditId: auditLogs.auditId,
  action: auditLogs.action,
  resourceType: auditLogs.resourceType,
  resourceId: auditLogs.resourceId,
  userId: auditLogs.userId,
  severity: auditLogs.severity,
  outcome: auditLogs.outcome,
  createdAt: auditLogs.createdAt,
})

export async function listAuditEntries(tx: RLSTx, organizationId: string, limit = AUDIT_LIST_LIMIT): Promise<AuditEntryView[]> {
  const bound = Math.min(Math.max(1, Math.trunc(limit)), AUDIT_LIST_LIMIT)
  if (currentStateContextEnabled()) {
    const canonical = (await tx.execute(
      sql`SELECT audit_id, action, resource_type, resource_id, user_id, created_at
          FROM public.audit_logs
          WHERE organization_id = ${organizationId}::uuid
          ORDER BY created_at DESC, id DESC
          LIMIT ${bound}`,
    )) as unknown as CanonicalRow[]
    return canonical.map(fromCanonical)
  }
  const legacy = await tx
    .select(legacyEntryColumns())
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
  return entries
}

/**
 * Whether the organization has at least one audit record whose action matches the pattern (SQL LIKE) and none of the excluded
 * patterns. It answers "did this happen", reads no details, and checks the store the deployment writes.
 */
export async function hasAuditedAction(
  tx: RLSTx,
  organizationId: string,
  actionLike: string,
  excludeLike: readonly string[] = [],
): Promise<boolean> {
  const exclusions = excludeLike.map((pattern) => sql`AND action NOT LIKE ${pattern}`)
  const found = (await tx.execute(
    currentStateContextEnabled()
      ? sql`SELECT 1 AS found FROM public.audit_logs
          WHERE organization_id = ${organizationId}::uuid AND action LIKE ${actionLike} ${sql.join(exclusions, sql` `)}
          LIMIT 1`
      : sql`SELECT 1 AS found FROM audit_security.audit_logs
          WHERE organization_id = ${organizationId}::uuid AND action LIKE ${actionLike} ${sql.join(exclusions, sql` `)}
          LIMIT 1`,
  )) as unknown as unknown[]
  return found.length > 0
}

export async function readAuditEntry(tx: RLSTx, organizationId: string, auditId: string): Promise<AuditEntryView | null> {
  if (currentStateContextEnabled()) {
    const [row] = (await tx.execute(
      sql`SELECT audit_id, action, resource_type, resource_id, user_id, created_at
          FROM public.audit_logs
          WHERE audit_id = ${auditId}::uuid AND organization_id = ${organizationId}::uuid
          LIMIT 1`,
    )) as unknown as CanonicalRow[]
    return row ? fromCanonical(row) : null
  }
  const [legacy] = await tx
    .select(legacyEntryColumns())
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
