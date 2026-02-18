'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ClipboardDocumentCheckIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'
import { Card } from '@nzila/ui'
import { Badge } from '@nzila/ui'

interface Entity {
  id: string
  legalName: string
  jurisdiction: string
}

export default function ComplianceHubPage() {
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
          {' / Compliance'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Compliance</h1>
        <p className="text-sm text-gray-500 mt-1">
          Track filings, compliance tasks, and regulatory obligations across all
          entities.
        </p>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Loading entities...</p>
      ) : entities.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <ClipboardDocumentCheckIcon className="h-12 w-12 mx-auto mb-3" />
          <p className="font-medium">No entities yet</p>
          <Link
            href="/business/entities"
            className="mt-4 inline-block text-sm text-blue-600 hover:underline"
          >
            Go to Entities →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {entities.map((entity) => (
            <Link
              key={entity.id}
              href={`/business/entities/${entity.id}/compliance`}
              className="block"
            >
              <Card variant="bordered" className="hover:border-emerald-300 hover:shadow-sm transition-all">
                <Card.Body className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{entity.legalName}</p>
                    <p className="text-xs text-gray-500">{entity.jurisdiction}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="info">Compliance Tasks</Badge>
                    <ArrowRightIcon className="h-4 w-4 text-gray-400" />
                  </div>
                </Card.Body>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
