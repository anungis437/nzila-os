'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  CurrencyDollarIcon,
  ArrowRightIcon,
  PlusIcon,
} from '@heroicons/react/24/outline'

interface Entity {
  id: string
  legalName: string
  jurisdiction: string
}

export default function FinanceHubPage() {
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
          {' / Finance'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
        <p className="text-sm text-gray-500 mt-1">
          Expenses, invoicing, and financial operations across all entities.
        </p>
      </div>

      <div className="flex gap-3 mb-8">
        <Link
          href="/business/finance/expense"
          className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700"
        >
          <PlusIcon className="h-4 w-4" /> Submit Expense
        </Link>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading entities...</p>
      ) : entities.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <CurrencyDollarIcon className="h-12 w-12 mx-auto mb-3" />
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
              href={`/business/entities/${entity.id}/finance`}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-green-300 hover:shadow-sm transition-all"
            >
              <div>
                <p className="font-medium text-gray-900">{entity.legalName}</p>
                <p className="text-xs text-gray-500">{entity.jurisdiction}</p>
              </div>
              <ArrowRightIcon className="h-4 w-4 text-gray-400" />
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
