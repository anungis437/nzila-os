'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline'

interface Approval {
  id: string
  entityId: string
  entityName: string
  subjectType: string
  subjectId: string
  approvalType: string
  status: string
  createdAt: string
}

export default function ApprovalsHubPage() {
  const [approvals, setApprovals] = useState<Approval[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Fetch approvals across all user's entities
    fetch('/api/approvals')
      .then((r) => r.json())
      .then(setApprovals)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const pending = approvals.filter((a) => a.status === 'pending')
  const decided = approvals.filter((a) => a.status !== 'pending')

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business" className="hover:underline">Business OS</Link>
          {' / Approvals'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <p className="text-sm text-gray-500 mt-1">
          Review and action pending approvals across all your entities.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-700">{pending.length}</div>
          <div className="text-xs text-yellow-600 mt-1">Pending</div>
        </div>
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-700">
            {decided.filter((a) => a.status === 'approved').length}
          </div>
          <div className="text-xs text-green-600 mt-1">Approved</div>
        </div>
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-700">
            {decided.filter((a) => a.status === 'rejected').length}
          </div>
          <div className="text-xs text-red-600 mt-1">Rejected</div>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading approvals...</p>
      ) : approvals.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CheckCircleIcon className="h-12 w-12 mx-auto mb-3" />
          <p className="font-medium">No approvals found</p>
          <p className="text-sm mt-1">Approvals will appear here when governance actions require them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => {
            const Icon =
              approval.status === 'approved'
                ? CheckCircleIcon
                : approval.status === 'rejected'
                  ? ExclamationCircleIcon
                  : ClockIcon
            const colorClass =
              approval.status === 'approved'
                ? 'text-green-500'
                : approval.status === 'rejected'
                  ? 'text-red-500'
                  : 'text-yellow-500'

            return (
              <div
                key={approval.id}
                className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-lg"
              >
                <Icon className={`h-5 w-5 ${colorClass}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">
                    {approval.approvalType} approval — {approval.subjectType}
                  </p>
                  <p className="text-xs text-gray-500">
                    {approval.entityName || approval.entityId}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${
                    approval.status === 'approved'
                      ? 'bg-green-100 text-green-700'
                      : approval.status === 'rejected'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {approval.status}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
