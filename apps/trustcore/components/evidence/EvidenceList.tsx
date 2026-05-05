'use client'

/**
 * TrustCore — Evidence List
 *
 * Read-only, append-oriented evidence event log.
 * No creation form — events are written by API mutation handlers.
 */

import { ArchiveBoxIcon } from '@heroicons/react/24/outline'
import { EmptyState } from '@/components/shared/EmptyState'
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
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Action', 'Entity Type', 'Entity ID', 'Actor', 'Summary', 'Timestamp'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {records.map((r) => (
            <tr key={r.id} className="hover:bg-gray-50 transition">
              <td className="px-4 py-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${ACTION_STYLES[r.action] ?? 'bg-gray-100 text-gray-600'}`}>
                  {r.action}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500">{r.entityType}</td>
              <td className="px-4 py-3 text-gray-400 font-mono text-xs">{r.entityId.slice(0, 8)}…</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs truncate max-w-[120px]">{r.actorId}</td>
              <td className="px-4 py-3 text-gray-500 truncate max-w-[200px]">{r.summary ?? '—'}</td>
              <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                {r.createdAt.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
