/**
 * CFO Server Actions — Security Operations Center.
 *
 * Security posture scoring, compliance tracking, security events,
 * incident response, and backup monitoring.
 *
 * Historical source labels are not adopted as tenant authority.
 */
'use server'

import { revalidatePath } from 'next/cache'
import { sql } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { CfoScopeError, resolveOrgContext } from '@/lib/resolve-org'
import { cfoRows } from '@/queries/action-context'
import { legacyCfoAuditPredicate } from '@/lib/services/cfo-records'
import { z } from 'zod'
import { changeLegacySecurityRecord } from '@/lib/services/security-records'
import { CfoCapabilityUnavailableError } from '@/lib/services/capability-unavailable'

/* ─── Types ─── */

export interface SecurityEvent {
  id: string
  type:
    | 'login_attempt'
    | 'permission_change'
    | 'data_access'
    | 'config_change'
    | 'mfa_event'
    | 'api_abuse'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  ipAddress: string | null
  userId: string | null
  resolved: boolean
  createdAt: Date
}

export interface Incident {
  id: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'investigating' | 'contained' | 'resolved'
  assignedTo: string | null
  description: string
  createdAt: Date
}

export interface BackupRecord {
  id: string
  type: 'full' | 'incremental' | 'snapshot'
  status: 'success' | 'failed' | 'in-progress'
  sizeBytes: number | null
  encrypted: boolean
  createdAt: Date
}

export interface ComplianceItem {
  id: string
  framework: 'soc2' | 'gdpr' | 'pci-dss'
  criterion: string
  description: string
  status: 'compliant' | 'partial' | 'non-compliant' | 'not-assessed'
  score: number
  dueDate: Date | null
}

export interface SecurityPosture {
  overallScore: number
  eventsSummary: { total: number; critical: number; high: number; resolved: number }
  incidentsSummary: { open: number; investigating: number; contained: number }
  backupStatus: { lastSuccess: Date | null; encrypted: boolean }
  complianceScore: number
}

/* ─── Queries ─── */

export async function getSecurityPosture(): Promise<SecurityPosture> {
  return resolveOrgContext(
    'resource',
    { permission: 'security:view' },
    async (context): Promise<SecurityPosture> => {
      const scope = legacyCfoAuditPredicate(context)
      try {
        // Security events summary
        const [eventStats] = cfoRows<{
          total: number
          critical: number
          high: number
          resolved: number
        }>(
          await context.db.execute(
            sql`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE metadata->>'severity' = 'critical') as critical,
        COUNT(*) FILTER (WHERE metadata->>'severity' = 'high') as high,
        COUNT(*) FILTER (WHERE (metadata->>'resolved')::boolean = true) as resolved
      FROM public.audit_log WHERE ${scope} AND action = 'security.event'`,
          ),
        )

        // Incidents summary
        const [incidentStats] = cfoRows<{ open: number; investigating: number; contained: number }>(
          await context.db.execute(
            sql`SELECT
        COUNT(*) FILTER (WHERE metadata->>'status' = 'open') as open,
        COUNT(*) FILTER (WHERE metadata->>'status' = 'investigating') as investigating,
        COUNT(*) FILTER (WHERE metadata->>'status' = 'contained') as contained
      FROM public.audit_log WHERE ${scope} AND action = 'security.incident'`,
          ),
        )

        // Backup status
        const backupRows = cfoRows<{ createdAt: Date; encrypted: boolean }>(
          await context.db.execute(
            sql`SELECT created_at as "createdAt",
        COALESCE((metadata->>'encrypted')::boolean, false) as encrypted
      FROM public.audit_log WHERE ${scope} AND action = 'security.backup' AND metadata->>'status' = 'success'
      ORDER BY created_at DESC LIMIT 1`,
          ),
        )

        // Compliance score
        const [complianceRow] = cfoRows<{ avg_score: number }>(
          await context.db.execute(
            sql`SELECT COALESCE(AVG((metadata->>'score')::numeric), 0) as avg_score
      FROM public.audit_log WHERE ${scope} AND action = 'compliance.assessment'`,
          ),
        )

        const noActiveIncidents = Number(incidentStats?.open ?? 0) === 0 ? 30 : 0
        const recentBackup = backupRows?.[0] ? 20 : 0
        const lowRisk = Number(eventStats?.critical ?? 0) === 0 ? 20 : 0
        const compScore = Number(complianceRow?.avg_score ?? 0)
        const overallScore = Math.min(
          100,
          noActiveIncidents + recentBackup + lowRisk + Math.round(compScore * 0.3),
        )

        return {
          overallScore,
          eventsSummary: {
            total: Number(eventStats?.total ?? 0),
            critical: Number(eventStats?.critical ?? 0),
            high: Number(eventStats?.high ?? 0),
            resolved: Number(eventStats?.resolved ?? 0),
          },
          incidentsSummary: {
            open: Number(incidentStats?.open ?? 0),
            investigating: Number(incidentStats?.investigating ?? 0),
            contained: Number(incidentStats?.contained ?? 0),
          },
          backupStatus: {
            lastSuccess: backupRows?.[0]?.createdAt ?? null,
            encrypted: backupRows?.[0]?.encrypted ?? false,
          },
          complianceScore: Math.round(compScore),
        }
      } catch (error) {
        logger.error('getSecurityPosture failed', { error })
        return {
          overallScore: 0,
          eventsSummary: { total: 0, critical: 0, high: 0, resolved: 0 },
          incidentsSummary: { open: 0, investigating: 0, contained: 0 },
          backupStatus: { lastSuccess: null, encrypted: false },
          complianceScore: 0,
        }
      }
    },
  )
}

export async function listSecurityEvents(opts?: {
  page?: number
  severity?: string
}): Promise<{ events: SecurityEvent[]; total: number }> {
  return resolveOrgContext(
    'resource',
    { permission: 'security:view' },
    async (context): Promise<{ events: SecurityEvent[]; total: number }> => {
      const scope = legacyCfoAuditPredicate(context)
      const page = opts?.page ?? 1
      const offset = (page - 1) * 25

      try {
        const severityFilter = opts?.severity
          ? sql`AND metadata->>'severity' = ${opts.severity}`
          : sql``

        const rows = cfoRows<SecurityEvent>(
          await context.db.execute(
            sql`SELECT id, metadata->>'type' as type, metadata->>'severity' as severity,
        metadata->>'description' as description, metadata->>'ipAddress' as "ipAddress",
        actor_id as "userId",
        COALESCE((metadata->>'resolved')::boolean, false) as resolved,
        created_at as "createdAt"
      FROM public.audit_log WHERE ${scope} AND action = 'security.event' ${severityFilter}
      ORDER BY created_at DESC LIMIT 25 OFFSET ${offset}`,
          ),
        )

        const [cnt] = cfoRows<{ total: number }>(
          await context.db.execute(
            sql`SELECT COUNT(*) as total FROM public.audit_log WHERE ${scope} AND action = 'security.event' ${severityFilter}`,
          ),
        )

        return { events: rows ?? [], total: Number(cnt?.total ?? 0) }
      } catch (error) {
        logger.error('listSecurityEvents failed', { error })
        return { events: [], total: 0 }
      }
    },
  )
}

/** Log a failed security mutation and rethrow it unchanged; invalidate the
 * security dashboard only after a committed, successful change. */
async function securityMutation(
  operation: string,
  run: () => Promise<{ success: boolean }>,
): Promise<{ success: boolean }> {
  let result: { success: boolean }
  try {
    result = await run()
  } catch (error) {
    if (!(error instanceof CfoScopeError)) logger.error(`${operation} failed`, { error })
    throw error
  }
  if (!result.success) return result
  try {
    revalidatePath('/dashboard/security')
  } catch {
    logger.warn('Security cache invalidation unavailable after commit')
  }
  return result
}

export async function resolveSecurityEvent(eventId: string): Promise<{ success: boolean }> {
  return securityMutation('resolveSecurityEvent', () =>
    resolveOrgContext('resource', { permission: 'security:manage' }, (context) =>
      changeLegacySecurityRecord(context, eventId, {
        action: 'security.event',
        patch: { resolved: true },
        receipt: 'security.event.resolved',
      }),
    ),
  )
}

export async function listIncidents(opts?: { status?: string }): Promise<Incident[]> {
  return resolveOrgContext(
    'resource',
    { permission: 'security:view' },
    async (context): Promise<Incident[]> => {
      const scope = legacyCfoAuditPredicate(context)
      try {
        const statusFilter = opts?.status ? sql`AND metadata->>'status' = ${opts.status}` : sql``

        const rows = cfoRows<Incident>(
          await context.db.execute(
            sql`SELECT id, metadata->>'title' as title, metadata->>'severity' as severity,
        metadata->>'status' as status, metadata->>'assignedTo' as "assignedTo",
        metadata->>'description' as description, created_at as "createdAt"
      FROM public.audit_log WHERE ${scope} AND action = 'security.incident' ${statusFilter}
      ORDER BY created_at DESC LIMIT 50`,
          ),
        )
        return rows ?? []
      } catch (error) {
        logger.error('listIncidents failed', { error })
        return []
      }
    },
  )
}

export async function updateIncidentStatus(
  incidentId: string,
  status: Incident['status'],
): Promise<{ success: boolean }> {
  return securityMutation('updateIncidentStatus', () =>
    resolveOrgContext('resource', { permission: 'security:manage' }, (context) =>
      changeLegacySecurityRecord(context, incidentId, {
        action: 'security.incident',
        patch: { status: z.enum(['open', 'investigating', 'contained', 'resolved']).parse(status) },
        receipt: 'security.incident.status_changed',
      }),
    ),
  )
}

export async function listBackups(): Promise<BackupRecord[]> {
  return resolveOrgContext(
    'resource',
    { permission: 'security:view' },
    async (context): Promise<BackupRecord[]> => {
      const scope = legacyCfoAuditPredicate(context)
      try {
        const rows = cfoRows<BackupRecord>(
          await context.db.execute(
            sql`SELECT id, metadata->>'type' as type, metadata->>'status' as status,
        (metadata->>'sizeBytes')::int as "sizeBytes",
        COALESCE((metadata->>'encrypted')::boolean, false) as encrypted,
        created_at as "createdAt"
      FROM public.audit_log WHERE ${scope} AND action = 'security.backup'
      ORDER BY created_at DESC LIMIT 25`,
          ),
        )
        return rows ?? []
      } catch (error) {
        logger.error('listBackups failed', { error })
        return []
      }
    },
  )
}

export async function listComplianceItems(): Promise<ComplianceItem[]> {
  return resolveOrgContext(
    'resource',
    { permission: 'security:view' },
    async (context): Promise<ComplianceItem[]> => {
      const scope = legacyCfoAuditPredicate(context)
      try {
        const rows = cfoRows<ComplianceItem>(
          await context.db.execute(
            sql`SELECT id, metadata->>'framework' as framework,
        metadata->>'criterion' as criterion,
        metadata->>'description' as description,
        metadata->>'status' as status,
        COALESCE((metadata->>'score')::int, 0) as score,
        (metadata->>'dueDate')::timestamptz as "dueDate"
      FROM public.audit_log WHERE ${scope} AND action = 'compliance.assessment'
      ORDER BY created_at DESC LIMIT 50`,
          ),
        )
        return rows ?? []
      } catch (error) {
        logger.error('listComplianceItems failed', { error })
        return []
      }
    },
  )
}

export async function runSecurityScan(): Promise<{ success: boolean; findings: number }> {
  return resolveOrgContext('resource', { permission: 'security:manage' }, async () => {
    throw new CfoCapabilityUnavailableError('SECURITY_SCANNER_UNAVAILABLE')
  })
}
