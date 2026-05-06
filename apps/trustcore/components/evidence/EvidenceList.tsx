'use client'

/**
 * TrustCore — Evidence List
 *
 * Read-only, append-oriented evidence event log.
 * No creation form — events are written by API mutation handlers.
 */

import { ArchiveBoxIcon } from '@heroicons/react/24/outline'
import { EmptyState } from '@/components/shared/EmptyState'
import { RecordExplorer } from '@/components/shared/RecordExplorer'
import type { TrustcoreEvidenceEvent } from '@nzila/db/queries/trustcore'

interface Props {
  records: TrustcoreEvidenceEvent[]
}

const ACTION_STYLES: Record<string, string> = {
  data_asset_created: 'bg-blue-100 text-blue-700',
  pia_created: 'bg-purple-100 text-purple-700',
  incident_logged: 'bg-red-100 text-red-700',
  dsr_created: 'bg-yellow-100 text-yellow-700',
  vendor_added: 'bg-teal-100 text-teal-700',
  created: 'bg-gray-100 text-gray-600',
  updated: 'bg-gray-100 text-gray-600',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
}

export function EvidenceList({ records }: Props) {
  if (records.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200">
        <EmptyState
          icon={ArchiveBoxIcon}
          title="No evidence events yet"
          description="Evidence events are automatically logged when compliance actions are taken."
        />
      </div>
    )
  }

  return (
    <RecordExplorer
      records={records}
      rowKey={(r) => r.id}
      searchPlaceholder="Search evidence by action, entity, actor, or summary..."
      searchText={(r) => `${r.action} ${r.entityType} ${r.actorId} ${r.summary ?? ''}`}
      filters={[
        {
          id: 'action',
          label: 'Action',
          options: [...new Set(records.map((r) => r.action))].map((value) => ({ value, label: value })),
          matches: (r, v) => r.action === v,
        },
        {
          id: 'entity',
          label: 'Entity',
          options: [...new Set(records.map((r) => r.entityType))].map((value) => ({ value, label: value })),
          matches: (r, v) => r.entityType === v,
        },
      ]}
      columns={[
        {
          id: 'action',
          label: 'Action',
          sortValue: (r) => r.action,
          render: (r) => (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_STYLES[r.action] ?? 'bg-gray-100 text-gray-600'}`}>
              {r.action}
            </span>
          ),
        },
        {
          id: 'entityType',
          label: 'Entity Type',
          sortValue: (r) => r.entityType,
          render: (r) => <span className="text-gray-500">{r.entityType}</span>,
        },
        {
          id: 'entityId',
          label: 'Entity ID',
          sortValue: (r) => r.entityId,
          render: (r) => <span className="text-gray-400 font-mono text-xs">{r.entityId.slice(0, 8)}…</span>,
        },
        {
          id: 'actor',
          label: 'Actor',
          sortValue: (r) => r.actorId,
          render: (r) => <span className="text-gray-500 font-mono text-xs truncate max-w-30 block">{r.actorId}</span>,
        },
        {
          id: 'summary',
          label: 'Summary',
          sortValue: (r) => r.summary ?? '',
          render: (r) => <span className="text-gray-500 truncate max-w-50 block">{r.summary ?? '—'}</span>,
        },
        {
          id: 'created',
          label: 'Timestamp',
          sortValue: (r) => r.createdAt,
          render: (r) => <span className="text-gray-400 text-xs whitespace-nowrap">{r.createdAt.toLocaleString()}</span>,
        },
      ]}
      drillDownTitle={(r) => `Evidence Event: ${r.action}`}
      renderDrillDown={(r) => (
        <div className="grid grid-cols-2 gap-3">
          <div><p className="text-xs text-gray-500">Action</p><p>{r.action}</p></div>
          <div><p className="text-xs text-gray-500">Entity type</p><p>{r.entityType}</p></div>
          <div><p className="text-xs text-gray-500">Entity ID</p><p className="font-mono text-xs break-all">{r.entityId}</p></div>
          <div><p className="text-xs text-gray-500">Actor</p><p className="font-mono text-xs break-all">{r.actorId}</p></div>
          <div><p className="text-xs text-gray-500">Timestamp</p><p>{r.createdAt.toLocaleString()}</p></div>
          <div><p className="text-xs text-gray-500">Event hash</p><p className="font-mono text-xs break-all">{r.eventHash ?? '—'}</p></div>
          <div className="col-span-2"><p className="text-xs text-gray-500">Summary</p><p>{r.summary ?? '—'}</p></div>
          <div className="col-span-2"><p className="text-xs text-gray-500">Metadata</p><pre className="text-xs bg-gray-50 p-2 rounded-lg overflow-auto">{JSON.stringify(r.metadata ?? {}, null, 2)}</pre></div>
        </div>
      )}
    />
  )
}
