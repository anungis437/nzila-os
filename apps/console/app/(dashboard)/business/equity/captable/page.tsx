'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  DocumentDuplicateIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

interface Entity {
  id: string
  legalName: string
  jurisdiction: string
}

export default function CapTablePage() {
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
          {' / '}
          <Link href="/business/equity" className="hover:underline">EquityOS</Link>
          {' / Cap Table'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Cap Table</h1>
        <p className="text-sm text-gray-500 mt-1">
          View capitalization tables for each entity.
        </p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading entities...</p>
      ) : entities.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <DocumentDuplicateIcon className="h-12 w-12 mx-auto mb-3" />
          <p className="font-medium">No entities yet</p>
          <Link href="/business/entities" className="mt-4 inline-block text-sm text-blue-600 hover:underline">
            Create an entity first →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {entities.map((entity) => (
            <Link
              key={entity.id}
              href={`/business/entities/${entity.id}/equity`}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
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
