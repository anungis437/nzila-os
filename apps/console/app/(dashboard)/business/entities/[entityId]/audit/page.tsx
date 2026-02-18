'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface AuditEvent {
  id: string
  actorClerkUserId: string
  actorRole: string | null
  action: string
  targetType: string
  targetId: string | null
  hash: string
  createdAt: string
}

export default function AuditPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const [events, setEvents] = useState<AuditEvent[]>([])

  useEffect(() => {
    fetch(`/api/entities/${entityId}/audit`)
      .then((r) => r.json())
      .then(setEvents)
      .catch(() => {})
  }, [entityId])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business/entities" className="hover:underline">Entities</Link>
          {' / '}
          <Link href={`/business/entities/${entityId}`} className="hover:underline">Entity</Link>
          {' / Audit Trail'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Audit Trail</h1>
        <p className="text-sm text-gray-500 mt-1">Tamper-evident append-only event log</p>
      </div>

      {events.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No audit events recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="pb-2">Timestamp</th>
                <th className="pb-2">Actor</th>
                <th className="pb-2">Action</th>
                <th className="pb-2">Target</th>
                <th className="pb-2">Hash</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id} className="border-b border-gray-100">
                  <td className="py-2 text-xs text-gray-500">
                    {new Date(e.createdAt).toLocaleString()}
                  </td>
                  <td className="py-2 text-xs">
                    <span className="font-mono">{e.actorClerkUserId.slice(0, 10)}…</span>
                    {e.actorRole && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-100 rounded">{e.actorRole}</span>
                    )}
                  </td>
                  <td className="py-2 font-medium">{e.action}</td>
                  <td className="py-2 text-xs text-gray-500">{e.targetType}</td>
                  <td className="py-2 font-mono text-xs text-gray-400" title={e.hash}>
                    {e.hash.slice(0, 12)}…
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
