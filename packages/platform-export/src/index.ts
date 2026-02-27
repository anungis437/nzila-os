/**
 * Nzila OS — Unified Org Data Export
 *
 * Aggregates data from all platform verticals for a given org
 * and returns CSV-ready data sets that can be streamed as a zip.
 *
 * @module @nzila/platform-export
 */
import { platformDb } from '@nzila/db/platform'
import {
  auditEvents,
  ueCases,
  zongaRevenueEvents,
  commerceQuotes,
  entities,
} from '@nzila/db/schema'
import { eq } from 'drizzle-orm'

// ── Types ───────────────────────────────────────────────────────────────────

export interface OrgExportDataset {
  orgName: string
  claims: ExportRow[]
  revenue: ExportRow[]
  quotes: ExportRow[]
  auditEvents: ExportRow[]
  featureFlags: ExportRow[]
}

export interface ExportRow {
  [key: string]: string | number | boolean | null
}

// ── Core export function ────────────────────────────────────────────────────

/**
 * Aggregate all exportable data for an org.
 *
 * Returns structured datasets suitable for CSV conversion.
 * Does NOT stream — callers (API route) handle streaming/zip.
 */
export async function exportOrgData(orgId: string): Promise<OrgExportDataset> {
  const [orgRow, claims, revenue, quotes, audit] = await Promise.all([
    platformDb
      .select({ legalName: entities.legalName })
      .from(entities)
      .where(eq(entities.id, orgId))
      .limit(1),
    platformDb
      .select({
        id: ueCases.id,
        category: ueCases.category,
        channel: ueCases.channel,
        status: ueCases.status,
        priority: ueCases.priority,
        slaBreached: ueCases.slaBreached,
        reopenCount: ueCases.reopenCount,
        messageCount: ueCases.messageCount,
        createdAt: ueCases.createdAt,
      })
      .from(ueCases)
      .where(eq(ueCases.entityId, orgId)),
    platformDb
      .select({
        id: zongaRevenueEvents.id,
        type: zongaRevenueEvents.type,
        amount: zongaRevenueEvents.amount,
        currency: zongaRevenueEvents.currency,
        source: zongaRevenueEvents.source,
        createdAt: zongaRevenueEvents.createdAt,
      })
      .from(zongaRevenueEvents)
      .where(eq(zongaRevenueEvents.entityId, orgId)),
    platformDb
      .select({
        id: commerceQuotes.id,
        ref: commerceQuotes.ref,
        status: commerceQuotes.status,
        total: commerceQuotes.total,
        currency: commerceQuotes.currency,
        createdAt: commerceQuotes.createdAt,
      })
      .from(commerceQuotes)
      .where(eq(commerceQuotes.entityId, orgId)),
    platformDb
      .select({
        id: auditEvents.id,
        action: auditEvents.action,
        targetType: auditEvents.targetType,
        actorRole: auditEvents.actorRole,
        createdAt: auditEvents.createdAt,
      })
      .from(auditEvents)
      .where(eq(auditEvents.entityId, orgId)),
  ])

  return {
    orgName: orgRow[0]?.legalName ?? 'Unknown',
    claims: claims.map(rowToExportRow),
    revenue: revenue.map(rowToExportRow),
    quotes: quotes.map(rowToExportRow),
    auditEvents: audit.map(rowToExportRow),
    featureFlags: [], // Feature flags not yet implemented — returns empty
  }
}

// ── CSV Helpers ─────────────────────────────────────────────────────────────

function rowToExportRow(row: Record<string, unknown>): ExportRow {
  const result: ExportRow = {}
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      result[key] = value.toISOString()
    } else if (typeof value === 'object' && value !== null) {
      result[key] = JSON.stringify(value)
    } else {
      result[key] = value as string | number | boolean | null
    }
  }
  return result
}

/**
 * Convert an array of ExportRow objects to CSV string.
 */
export function datasetToCsv(rows: ExportRow[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const lines = [
    headers.join(','),
    ...rows.map((row) =>
      headers
        .map((h) => {
          const val = row[h]
          if (val === null || val === undefined) return ''
          const str = String(val)
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str
        })
        .join(','),
    ),
  ]
  return lines.join('\n')
}
