import type { AuditStore } from './store.js'
import type { AuditEntry } from './schema.js'

// ─── Audit Export ───────────────────────────────────────────────────────────

export interface AuditExportOptions {
  readonly tenantId: string
  readonly fromDate?: string
  readonly toDate?: string
  readonly format?: 'json' | 'csv'
}

export interface AuditExportResult {
  readonly tenantId: string
  readonly exportedAt: string
  readonly entryCount: number
  readonly entries: AuditEntry[]
  readonly format: 'json' | 'csv'
  readonly data: string
}

export async function exportAuditLog(
  store: AuditStore,
  options: AuditExportOptions,
): Promise<AuditExportResult> {
  const entries = await store.getEntries(options.tenantId, {
    fromDate: options.fromDate,
    toDate: options.toDate,
    limit: 100_000,
  })

  const format = options.format ?? 'json'

  const data =
    format === 'csv'
      ? entriesToCsv(entries)
      : JSON.stringify(entries, null, 2)

  return {
    tenantId: options.tenantId,
    exportedAt: new Date().toISOString(),
    entryCount: entries.length,
    entries,
    format,
    data,
  }
}

function entriesToCsv(entries: AuditEntry[]): string {
  const headers = [
    'id',
    'timestamp',
    'actorId',
    'tenantId',
    'action',
    'resource',
    'resourceId',
    'prevHash',
    'hash',
    'traceId',
    'spanId',
    'payload',
  ]

  const rows = entries.map((e) =>
    [
      e.id,
      e.timestamp,
      e.actorId,
      e.tenantId,
      e.action,
      e.resource,
      e.resourceId ?? '',
      e.prevHash,
      e.hash,
      e.traceId ?? '',
      e.spanId ?? '',
      JSON.stringify(e.payload).replace(/"/g, '""'),
    ]
      .map((v) => `"${v}"`)
      .join(','),
  )

  return [headers.join(','), ...rows].join('\n')
}
