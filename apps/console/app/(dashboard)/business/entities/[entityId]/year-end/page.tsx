'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

interface YearEndItem {
  key: string
  label: string
  ready: boolean
  detail: string
}

interface YearEndData {
  entityId: string
  fiscalYear: number
  readinessPercent: number
  items: YearEndItem[]
}

export default function YearEndPage() {
  const { entityId } = useParams<{ entityId: string }>()
  const [data, setData] = useState<YearEndData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/entities/${entityId}/year-end`)
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load year-end data')
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [entityId])

  const doneCount = data?.items.filter((i) => i.ready).length ?? 0
  const totalCount = data?.items.length ?? 0

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business/entities" className="hover:underline">Entities</Link>
          {' / '}
          <Link href={`/business/entities/${entityId}`} className="hover:underline">Entity</Link>
          {' / Year-End'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Year-End Readiness</h1>
        {data && (
          <p className="text-sm text-gray-500 mt-1">
            FY {data.fiscalYear} — {doneCount}/{totalCount} items ready ({data.readinessPercent}%)
          </p>
        )}
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
        <div
          className="bg-green-500 h-2 rounded-full transition-all"
          style={{ width: `${data?.readinessPercent ?? 0}%` }}
        />
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading year-end data...</p>
      ) : error ? (
        <p className="text-red-500 text-sm">{error}</p>
      ) : data ? (
        <div className="space-y-2">
          {data.items.map((item) => {
            const Icon = item.ready ? CheckCircleIcon : ClockIcon
            return (
              <div
                key={item.key}
                className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg"
              >
                <Icon className={`h-5 w-5 ${item.ready ? 'text-green-500' : 'text-yellow-500'}`} />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{item.label}</p>
                  <p className="text-xs text-gray-400">{item.detail}</p>
                </div>
                <span
                  className={`px-2 py-0.5 text-xs rounded-full ${
                    item.ready
                      ? 'bg-green-100 text-green-700'
                      : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {item.ready ? 'Ready' : 'Pending'}
                </span>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
