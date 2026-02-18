'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ClockIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
  DocumentDuplicateIcon,
  DocumentTextIcon,
  ArrowRightIcon,
} from '@heroicons/react/24/outline'

interface QueueItem {
  name: string
  count: number
  href: string
  icon: 'approval' | 'signature' | 'governance' | 'yearend' | 'document'
  description: string
}

const iconMap = {
  approval: ClockIcon,
  signature: DocumentDuplicateIcon,
  governance: ShieldCheckIcon,
  yearend: CheckCircleIcon,
  document: DocumentTextIcon,
}

export default function QueuesPage() {
  const [entities, setEntities] = useState<{ id: string; legalName: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/entities')
      .then((r) => r.json())
      .then(setEntities)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Cross-entity queue aggregation
  const queues: QueueItem[] = [
    {
      name: 'Pending Approvals',
      count: 0,
      href: '/business/approvals',
      icon: 'approval',
      description: 'Board and shareholder approvals awaiting your action',
    },
    {
      name: 'Pending Signatures',
      count: 0,
      href: '/business/signatures',
      icon: 'signature',
      description: 'Digital signatures required on resolutions and agreements',
    },
    {
      name: 'Governance Actions',
      count: 0,
      href: '/business/governance',
      icon: 'governance',
      description: 'Active governance workflows in progress',
    },
    {
      name: 'Year-End Tasks',
      count: 0,
      href: '/business/yearend',
      icon: 'yearend',
      description: 'Annual compliance tasks due across entities',
    },
    {
      name: 'Documents',
      count: 0,
      href: '/business/equity',
      icon: 'document',
      description: 'Documents pending review or upload',
    },
  ]

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <p className="text-sm text-gray-500 mb-1">
          <Link href="/business" className="hover:underline">Business OS</Link>
          {' / Queues'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">Action Queues</h1>
        <p className="text-sm text-gray-500 mt-1">
          All pending actions across your entities in one place.
        </p>
      </div>

      <div className="space-y-3 mb-10">
        {queues.map((queue) => {
          const Icon = iconMap[queue.icon]
          return (
            <Link
              key={queue.name}
              href={queue.href}
              className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Icon className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{queue.name}</p>
                  <p className="text-xs text-gray-500">{queue.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center justify-center min-w-[28px] h-7 px-2 text-sm font-semibold rounded-full ${
                  queue.count > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {queue.count}
                </span>
                <ArrowRightIcon className="h-4 w-4 text-gray-400" />
              </div>
            </Link>
          )
        })}
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">By Entity</h2>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading entities...</p>
        ) : entities.length === 0 ? (
          <p className="text-gray-400 text-sm">No entities yet.</p>
        ) : (
          <div className="space-y-2">
            {entities.map((entity) => (
              <Link
                key={entity.id}
                href={`/business/entities/${entity.id}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="text-sm font-medium text-gray-700">{entity.legalName}</span>
                <ArrowRightIcon className="h-4 w-4 text-gray-400" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
