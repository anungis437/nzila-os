/**
 * Nzila Business OS - Main Dashboard
 * 
 * "Launcher + Queues" UX as specified in the Nzila OS architecture.
 * Shows key tiles and queues for the business operations.
 */

import Link from 'next/link'
import React from 'react'
import { currentUser } from '@nzila/platform-auth/entra/server'
import { platformDb } from '@nzila/db/platform'
import { approvals, orgMembers } from '@nzila/db/schema'
import { and, count, eq } from 'drizzle-orm'
import {
  DocumentTextIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline'

// ============================================================================
// TILE CONFIGURATION
// ============================================================================

interface Tile {
  name: string
  href: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  description: string
  color: string
  comingSoon?: boolean
}

const tiles: Tile[] = [
  {
    name: 'EquityOS',
    href: '/business/equity',
    icon: DocumentDuplicateIcon,
    description: 'Share register, cap table, and shareholding management.',
    color: 'bg-blue-50 text-blue-600',
  },
  {
    name: 'Governance',
    href: '/business/governance',
    icon: ShieldCheckIcon,
    description: 'Resolutions, approvals, and constitutional workflows.',
    color: 'bg-emerald-50 text-emerald-600',
  },
  {
    name: 'Finance',
    href: '/business/finance',
    icon: CurrencyDollarIcon,
    description: 'Expenses, invoicing, and financial operations.',
    color: 'bg-green-50 text-green-600',
  },
  {
    name: 'Year-End',
    href: '/business/yearend',
    icon: DocumentTextIcon,
    description: 'Close checklist, audit packages, and tax readiness.',
    color: 'bg-amber-50 text-amber-600',
  },
]

// ============================================================================
// QUEUE DATA
// ============================================================================

interface QueueSummary {
  name: string
  count: number | null
  icon: React.ComponentType<{ className?: string }>
  href: string
  type: 'approval' | 'signature' | 'document' | 'governance' | 'yearend'
  description: string
}

function getQueueData(pendingApprovals: number) {
  const queues: QueueSummary[] = [
    {
      name: 'Pending Approvals',
      count: pendingApprovals,
      icon: ClockIcon,
      href: '/business/approvals',
      type: 'approval',
      description: 'Live',
    },
    {
      name: 'Pending Signatures',
      count: null,
      icon: DocumentDuplicateIcon,
      href: '/business/signatures',
      type: 'signature',
      description: 'Not yet connected',
    },
    {
      name: 'Governance Actions',
      count: null,
      icon: ShieldCheckIcon,
      href: '/business/governance',
      type: 'governance',
      description: 'Not yet connected',
    },
    {
      name: 'Year-End Tasks',
      count: null,
      icon: CheckCircleIcon,
      href: '/business/yearend',
      type: 'yearend',
      description: 'Not yet connected',
    },
  ]
  return queues
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export const dynamic = 'force-dynamic'

export default async function BusinessOSDashboard() {
  const user = await currentUser()
  const userId = user?.id

  let pendingApprovals = 0
  if (userId) {
    const pendingRows = await platformDb
      .select({ total: count() })
      .from(approvals)
      .innerJoin(
        orgMembers,
        and(
          eq(orgMembers.orgId, approvals.orgId),
          eq(orgMembers.userId, userId),
          eq(orgMembers.status, 'active'),
        ),
      )
      .where(eq(approvals.status, 'pending'))

    pendingApprovals = pendingRows[0]?.total ?? 0
  }

  const queues = getQueueData(pendingApprovals)

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Nzila Business OS
        </h1>
        <p className="text-gray-500 mt-1">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ''} — Your governance & operations command center
        </p>
      </div>

      {/* Module Tiles */}
      <div className="mb-10">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Operating Modules</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((tile) => (
            <Link
              key={tile.name}
              href={tile.href || '#'}
              className={`block bg-white border border-gray-200 rounded-xl p-6 hover:shadow-md transition-all ${
                tile.comingSoon ? 'opacity-60 cursor-not-allowed' : 'hover:border-blue-300'
              }`}
            >
              <div className={`inline-flex p-3 rounded-lg mb-4 ${tile.color}`}>
                <tile.icon className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{tile.name}</h3>
              <p className="text-sm text-gray-500">{tile.description}</p>
              {tile.comingSoon && (
                <span className="inline-block mt-3 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">
                  Coming Soon
                </span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Two Column Layout: Queues + Summary */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Queue Panel */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Action Queues</h2>
            <Link 
              href="/business/queues" 
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View all <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          
          <div className="space-y-3">
            {queues.map((queue) => (
              <Link
                key={queue.name}
                href={queue.href}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <queue.icon className="h-5 w-5 text-gray-500" />
                  <div>
                    <span className="text-sm font-medium text-gray-700">{queue.name}</span>
                    <p className="text-xs text-gray-500">{queue.description}</p>
                  </div>
                </div>
                <span className={`inline-flex items-center justify-center min-w-6 h-6 px-2 text-sm font-semibold rounded-full ${
                  queue.count !== null && queue.count > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {queue.count === null ? '—' : queue.count}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Business Snapshot */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Business Snapshot</h2>
            <Link 
              href="/business/equity/captable" 
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              Open EquityOS <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-800">Live cross-entity metrics are being wired</p>
            <p className="mt-1 text-xs text-amber-700">
              This panel now avoids demo data. Use module pages for operational values.
            </p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/business/equity/issue"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <DocumentDuplicateIcon className="h-4 w-4" />
            Issue Shares
          </Link>
          <Link
            href="/business/governance/resolution"
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <ShieldCheckIcon className="h-4 w-4" />
            Create Resolution
          </Link>
          <Link
            href="/business/finance/expense"
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
          >
            <CurrencyDollarIcon className="h-4 w-4" />
            Submit Expense
          </Link>
        </div>
      </div>
    </div>
  )
}
