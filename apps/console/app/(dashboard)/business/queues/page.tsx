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
  count: number | null
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
  const [orgs, setEntities] = useState<{ id: string; legalName: string }[]>([])
  const [approvalCount, setApprovalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    const load = async () => {
      try {
        setLoading(true)
        setError(null)

        const [orgRes, approvalRes] = await Promise.all([
          fetch('/api/orgs'),
          fetch('/api/approvals'),
        ])

        if (!orgRes.ok) {
          throw new Error(`Failed to load orgs (HTTP ${orgRes.status})`)
        }

        if (!approvalRes.ok) {
          const body = await approvalRes.json().catch(() => null)
          const message =
            body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
              ? body.error
              : `Failed to load approvals (HTTP ${approvalRes.status})`
          throw new Error(message)
        }

        const orgData = await orgRes.json()
        const approvalData = await approvalRes.json()
        const pending = Array.isArray(approvalData)
          ? approvalData.filter((a) => a && typeof a === 'object' && a.status === 'pending').length
          : 0

        if (mounted) {
          setEntities(Array.isArray(orgData) ? orgData : [])
          setApprovalCount(pending)
        }
      } catch (err: unknown) {
        if (mounted) {
          setEntities([])
          setApprovalCount(0)
          setError(err instanceof Error ? err.message : 'Failed to load queues')
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()

    return () => {
      mounted = false
    }
  }, [])

  // Cross-entity queue aggregation
  const queues: QueueItem[] = [
    {
      name: 'Pending Approvals',
      count: approvalCount,
      href: '/business/approvals',
      icon: 'approval',
      description: 'Board and shareholder approvals awaiting your action (live)',
    },
    {
      name: 'Pending Signatures',
      count: null,
      href: '/business/signatures',
      icon: 'signature',
      description: 'Digital signatures required on resolutions and agreements (not yet connected)',
    },
    {
      name: 'Governance Actions',
      count: null,
      href: '/business/governance',
      icon: 'governance',
      description: 'Active governance workflows in progress (not yet connected)',
    },
    {
      name: 'Year-End Tasks',
      count: null,
      href: '/business/yearend',
      icon: 'yearend',
      description: 'Annual compliance tasks due across orgs (not yet connected)',
    },
    {
      name: 'Documents',
      count: null,
      href: '/business/equity',
      icon: 'document',
      description: 'Documents pending review or upload (not yet connected)',
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
          All pending actions across your orgs in one place.
        </p>
      </div>

      <div className="space-y-3 mb-10">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}
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
                <span className={`inline-flex items-center justify-center min-w-7 h-7 px-2 text-sm font-semibold rounded-full ${
                  queue.count !== null && queue.count > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  {queue.count === null ? '—' : queue.count}
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
          <p className="text-gray-400 text-sm">Loading orgs...</p>
        ) : orgs.length === 0 ? (
          <p className="text-gray-400 text-sm">No orgs yet.</p>
        ) : (
          <div className="space-y-2">
            {orgs.map((entity) => (
              <Link
                key={entity.id}
                href={`/business/orgs/${entity.id}`}
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
