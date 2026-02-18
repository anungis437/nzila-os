'use client'

import { useState, useEffect } from 'react'
import {
  ChartBarIcon,
  ArrowTrendingUpIcon,
  UsersIcon,
  GlobeAltIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  ShieldCheckIcon,
  BookOpenIcon,
} from '@heroicons/react/24/outline'

interface AnalyticsData {
  entities: number
  uniqueShareholders: { count: number; precision: number; standardError: number }
  uniquePeople: { count: number; precision: number; standardError: number }
  totalDocuments: number
  totalActions: number
  totalAuditEvents: number
  totalLedgerEntries: number
  totalResolutions: number
  totalMeetings: number
  entityBreakdown: Array<{
    id: string
    name: string
    jurisdiction: string
    status: string
  }>
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/analytics')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load analytics')
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
        <p className="text-gray-400 mt-4">Loading analytics...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
        <p className="text-red-500 mt-4">{error || 'Failed to load analytics'}</p>
      </div>
    )
  }

  const stats = [
    { label: 'Entities', value: data.entities.toString(), icon: BuildingOffice2Icon },
    {
      label: 'Unique Shareholders',
      value: data.uniqueShareholders.count.toString(),
      icon: UsersIcon,
      sub: `±${data.uniqueShareholders.standardError.toFixed(1)}% error`,
    },
    {
      label: 'Unique People',
      value: data.uniquePeople.count.toString(),
      icon: GlobeAltIcon,
      sub: `HyperLogLog estimate`,
    },
    { label: 'Documents', value: data.totalDocuments.toString(), icon: DocumentTextIcon },
  ]

  const secondaryStats = [
    { label: 'Governance Actions', value: data.totalActions },
    { label: 'Audit Events', value: data.totalAuditEvents },
    { label: 'Ledger Entries', value: data.totalLedgerEntries },
    { label: 'Resolutions', value: data.totalResolutions },
    { label: 'Meetings', value: data.totalMeetings },
  ]

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics</h1>
      <p className="text-gray-500 mb-8">
        Live portfolio analytics powered by HyperLogLog cardinality estimation.
      </p>

      {/* Primary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-lg border border-gray-200 p-5 flex items-center gap-4"
          >
            <s.icon className="h-8 w-8 text-blue-600 shrink-0" />
            <div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-sm text-gray-500">{s.label}</p>
              {'sub' in s && s.sub && (
                <p className="text-xs text-gray-400">{s.sub}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Secondary Stats */}
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5 mb-8">
        {secondaryStats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-lg border border-gray-200 p-4 text-center"
          >
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Entity Breakdown */}
      {data.entityBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <BookOpenIcon className="h-4 w-4" />
            Entity Portfolio
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-gray-500 font-medium">Entity Name</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Jurisdiction</th>
                  <th className="text-left py-2 text-gray-500 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.entityBreakdown.map((e) => (
                  <tr key={e.id} className="border-b border-gray-100">
                    <td className="py-2 font-medium text-gray-900">{e.name}</td>
                    <td className="py-2 text-gray-600">{e.jurisdiction}</td>
                    <td className="py-2">
                      <span className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${
                        e.status === 'active'
                          ? 'bg-green-50 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* HyperLogLog Explanation */}
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-gray-500">
        <ShieldCheckIcon className="h-8 w-8 mx-auto mb-2 text-blue-500" />
        <p className="font-medium text-gray-700 text-sm">Probabilistic Cardinality Estimation</p>
        <p className="text-xs mt-1 max-w-md mx-auto">
          Shareholder and people counts use HyperLogLog (Murmur3-based) for
          O(1) space-efficient cardinality estimation across entities.
          Standard error: ~1.04/√m where m is the register count.
        </p>
      </div>
    </div>
  )
}
