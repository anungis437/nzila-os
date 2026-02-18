'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

interface GovernanceAction {
  id: string
  actionType: string
  status: string
  payload: Record<string, unknown>
  requirements: Record<string, unknown>
  createdAt: string
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-500',
  pending_approval: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  executed: 'bg-blue-100 text-blue-700',
  rejected: 'bg-red-100 text-red-700',
}

export default function GovernancePage() {
  const { entityId } = useParams<{ entityId: string }>()
  const [actions, setActions] = useState<GovernanceAction[]>([])

  useEffect(() => {
    fetch(`/api/entities/${entityId}/governance-actions`)
      .then((r) => r.json())
      .then(setActions)
      .catch(() => {})
  }, [entityId])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business/entities" className="hover:underline">Entities</Link>
          {' / '}
          <Link href={`/business/entities/${entityId}`} className="hover:underline">Entity</Link>
          {' / Governance'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Governance Actions</h1>
        <p className="text-sm text-gray-500 mt-1">Policy-evaluated corporate actions</p>
      </div>

      {actions.length === 0 ? (
        <p className="text-gray-400 text-sm py-8 text-center">No governance actions yet.</p>
      ) : (
        <div className="space-y-3">
          {actions.map((a) => (
            <div key={a.id} className="p-4 bg-white border border-gray-200 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700 mr-2">
                    {a.actionType.replace(/_/g, ' ')}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {a.status.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
