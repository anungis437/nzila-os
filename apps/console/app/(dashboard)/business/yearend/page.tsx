'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  DocumentTextIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

interface Entity {
  id: string
  legalName: string
  jurisdiction: string
  fiscalYearEnd: string | null
}

export default function YearEndHubPage() {
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/entities')
      .then((r) => r.json())
      .then(setEntities)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business" className="hover:underline">Business OS</Link>
          {' / Year-End'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Year-End Readiness</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track annual close and compliance tasks across all entities.
        </p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading entities...</p>
      ) : entities.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <DocumentTextIcon className="h-12 w-12 mx-auto mb-3" />
          <p className="font-medium">No entities yet</p>
          <Link href="/business/entities" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Go to Entities →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {entities.map((entity) => (
            <Link
              key={entity.id}
              href={`/business/entities/${entity.id}/year-end`}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-amber-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <DocumentTextIcon className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{entity.legalName}</p>
                  <p className="text-xs text-gray-500">
                    {entity.jurisdiction}
                    {entity.fiscalYearEnd && ` · FYE ${entity.fiscalYearEnd}`}
                  </p>
                </div>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-gray-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
