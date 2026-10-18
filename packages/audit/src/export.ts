import type { AuditStore } from './store.js'
import type { AuditEntry } from './schema.js'

// ─── Audit Export ───────────────────────────────────────────────────────────

export interface AuditExportOptions {
  readonly orgId: string
  readonly fromDate?: string
  readonly toDate?: string
  readonly format?: 'json' | 'csv'
}

export interface AuditExportResult {
  readonly orgId: string
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
  const entries = await store.getEntries(options.orgId, {
    fromDate: options.fromDate,
    toDate: options.toDate,
    limit: 100_000,
  })
  for (const entry of entries) {
    if (entry.hashVersion !== undefined && entry.hashVersion !== 1 && entry.hashVersion !== 2) {
      throw new Error('Unsupported audit hash version')
    }
  }

  const format = options.format ?? 'json'

  const data =
    format === 'csv'
      ? entriesToCsv(entries)
      : JSON.stringify(entries, null, 2)

  return {
    orgId: options.orgId,
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
    'orgId',
    'action',
    'resource',
    'resourceId',
    'prevHash',
    'hash',
    'traceId',
    'spanId',
    'payload',
    'hashVersion',
  ]

  const rows = entries.map((e) =>
    [
      e.id,
      e.timestamp,
      e.actorId,
      e.orgId,
      e.action,
      e.resource,
      e.resourceId ?? '',
      e.prevHash,
      e.hash,
      e.traceId ?? '',
      e.spanId ?? '',
      JSON.stringify(e.payload),
      String(e.hashVersion ?? 1),
    ]
      .map((v) => `"${v.replace(/"/g, '""')}"`)
      .join(','),
  )

  return [headers.join(','), ...rows].join('\n')
}
