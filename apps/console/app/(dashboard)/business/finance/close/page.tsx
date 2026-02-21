'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  LockClosedIcon,
  LockOpenIcon,
} from '@heroicons/react/24/outline'

interface Entity {
  id: string
  legalName: string
}

interface ClosePeriod {
  id: string
  entityId: string
  periodLabel: string
  periodType: string
  startDate: string
  endDate: string
  status: 'open' | 'in_progress' | 'pending_approval' | 'closed'
  openedBy: string
  closedBy: string | null
  closedAt: string | null
}

function statusBadge(status: ClosePeriod['status']) {
  const styles: Record<string, { bg: string; label: string }> = {
    open: { bg: 'bg-blue-100 text-blue-700', label: 'Open' },
    in_progress: { bg: 'bg-yellow-100 text-yellow-700', label: 'In Progress' },
    pending_approval: { bg: 'bg-purple-100 text-purple-700', label: 'Pending Approval' },
    closed: { bg: 'bg-green-100 text-green-700', label: 'Closed' },
  }
  const s = styles[status] ?? { bg: 'bg-gray-100 text-gray-600', label: status }
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg}`}>{s.label}</span>
}

function periodTypeLabel(t: string) {
  switch (t) {
    case 'month': return 'Monthly'
    case 'quarter': return 'Quarterly'
    case 'year': return 'Annual'
    default: return t
  }
}

export default function CloseManagementPage() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null)
  const [periods, setPeriods] = useState<ClosePeriod[]>([])
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)

  useEffect(() => {
    fetch('/api/entities')
      .then((r) => r.json())
      .then((data: Entity[]) => {
        setEntities(data)
        if (data.length > 0) setSelectedEntityId(data[0]!.id)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedEntityId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: show spinner immediately before async fetch
    setDataLoading(true)

    fetch(`/api/finance/close?entityId=${selectedEntityId}`)
      .then((r) => r.json())
      .then(setPeriods)
      .catch(() => {})
      .finally(() => setDataLoading(false))
  }, [selectedEntityId])

  const openPeriods = periods.filter((p) => p.status !== 'closed')
  const closedPeriods = periods.filter((p) => p.status === 'closed')

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business" className="hover:underline">Business OS</Link>
          {' / '}
          <Link href="/business/finance" className="hover:underline">Finance</Link>
          {' / Close Management'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Close Management</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monthly, quarterly, and annual close periods with task checklists and approval workflows.
        </p>
      </div>

      {/* Entity selector */}
      {entities.length > 1 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Entity</label>
          <select
            value={selectedEntityId ?? ''}
            onChange={(e) => setSelectedEntityId(e.target.value)}
            className="w-64 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {entities.map((e) => (
              <option key={e.id} value={e.id}>{e.legalName}</option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Loading...</p>
      ) : (
        <div className="space-y-8">
          {/* Active Periods */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Active Periods
            </h2>

            {dataLoading ? (
              <p className="text-gray-400 text-sm">Loading close periods...</p>
            ) : openPeriods.length === 0 ? (
              <div className="text-center py-12 text-gray-400 bg-white border border-gray-200 rounded-lg">
                <LockOpenIcon className="h-12 w-12 mx-auto mb-3" />
                <p className="font-medium">No open close periods</p>
                <p className="text-xs mt-1">All periods are closed or none have been created yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {openPeriods.map((p) => (
                  <Link
                    key={p.id}
                    href={`/business/finance/close/${p.id}`}
                    className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <LockOpenIcon className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="font-medium text-gray-900">{p.periodLabel}</p>
                        <p className="text-xs text-gray-500">
                          {periodTypeLabel(p.periodType)} · {p.startDate} → {p.endDate}
                        </p>
                      </div>
                    </div>
                    {statusBadge(p.status)}
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Closed Periods */}
          {closedPeriods.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
                Closed Periods
              </h2>
              <div className="space-y-2">
                {closedPeriods.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 bg-gray-50 border border-gray-100 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <LockClosedIcon className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">{p.periodLabel}</p>
                        <p className="text-xs text-gray-400">
                          {periodTypeLabel(p.periodType)} · Closed{' '}
                          {p.closedAt ? new Date(p.closedAt).toLocaleDateString('en-CA') : ''}
                        </p>
                      </div>
                    </div>
                    {statusBadge(p.status)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
