/**
 * Nzila Business OS - Main Dashboard
 * 
 * "Launcher + Queues" UX as specified in the Nzila OS architecture.
 * Shows key tiles and queues for the business operations.
 */

import Link from 'next/link'
import { currentUser } from '@clerk/nextjs/server'
import {
  DocumentTextIcon,
  ChartBarIcon,
  CurrencyDollarIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
  UserGroupIcon,
  DocumentDuplicateIcon,
} from '@heroicons/react/24/outline'
import { getShareRegister } from '@/lib/equity/share-register'
import { getPolicyEngine, GovernanceAction } from '@/lib/governance/policy-engine'
import { ShareClass } from '@/lib/equity/models'

// ============================================================================
// TILE CONFIGURATION
// ============================================================================

const tiles = [
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
  count: number
  icon: React.ComponentType<{ className?: string }>
  href: string
  type: 'approval' | 'signature' | 'document' | 'governance' | 'yearend'
}

function getQueueData() {
  const queues: QueueSummary[] = [
    {
      name: 'Pending Approvals',
      count: 3,
      icon: ClockIcon,
      href: '/business/approvals',
      type: 'approval',
    },
    {
      name: 'Pending Signatures',
      count: 2,
      icon: DocumentDuplicateIcon,
      href: '/business/signatures',
      type: 'signature',
    },
    {
      name: 'Governance Actions',
      count: 1,
      icon: ShieldCheckIcon,
      href: '/business/governance',
      type: 'governance',
    },
    {
      name: 'Year-End Tasks',
      count: 5,
      icon: CheckCircleIcon,
      href: '/business/yearend',
      type: 'yearend',
    },
  ]
  return queues
}

// ============================================================================
// CAP TABLE SUMMARY
// ============================================================================

function getCapTableSummary() {
  const register = getShareRegister()
  const capTable = register.getCapTable()
  
  return {
    totalShares: capTable.totalSharesOutstanding.toLocaleString(),
    totalShareholders: capTable.totalShareholders,
    classes: Array.from(capTable.byClass.keys()).length,
  }
}

// ============================================================================
// POLICY DEMO
// ============================================================================

function getPolicyDemo() {
  const engine = getPolicyEngine()
  
  // Demo: Evaluate an issuance of 500,000 shares
  const evaluation = engine.evaluateRequirements(
    GovernanceAction.ISSUE_SHARES,
    {
      shares: 500000,
      shareClass: 'PREFERRED_B',
      totalConsideration: 500000,
    },
    {
      totalSharesOutstanding: 2600000,
      totalSharesAuthorized: 10000000,
      shareholderCount: 4,
      holdings: [
        { shareholderId: '11111111-1111-1111-1111-111111111111', shareholderName: 'Jane Smith', shareClass: ShareClass.FOUNDERS_F, shares: 1000000, votingRights: 1000000 },
        { shareholderId: '22222222-2222-2222-2222-222222222222', shareholderName: 'John Doe', shareClass: ShareClass.FOUNDERS_F, shares: 1000000, votingRights: 1000000 },
        { shareholderId: '33333333-3333-3333-3333-333333333333', shareholderName: 'Acme Ventures', shareClass: ShareClass.PREFERRED_A, shares: 500000, votingRights: 0 },
        { shareholderId: '44444444-4444-4444-4444-444444444444', shareholderName: 'Alice Investor', shareClass: ShareClass.COMMON_A, shares: 100000, votingRights: 100000 },
      ],
    }
  )
  
  return {
    action: 'Issue 500,000 Preferred B Shares',
    requirements: evaluation.requirements.map(r => r.description),
    blockers: evaluation.blockers,
    allowed: evaluation.allowed,
  }
}

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export const dynamic = 'force-dynamic'

export default async function BusinessOSDashboard() {
  const user = await currentUser()
  const capTable = getCapTableSummary()
  const queues = getQueueData()
  const policyDemo = getPolicyDemo()

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
                  <span className="text-sm font-medium text-gray-700">{queue.name}</span>
                </div>
                <span className={`inline-flex items-center justify-center min-w-[24px] h-6 px-2 text-sm font-semibold rounded-full ${
                  queue.count > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {queue.count}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Cap Table Summary */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Cap Table Summary</h2>
            <Link 
              href="/business/equity/captable" 
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View details <ArrowRightIcon className="h-4 w-4" />
            </Link>
          </div>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-700">{capTable.totalShares}</div>
              <div className="text-xs text-blue-600 mt-1">Total Shares</div>
            </div>
            <div className="text-center p-4 bg-emerald-50 rounded-lg">
              <div className="text-2xl font-bold text-emerald-700">{capTable.totalShareholders}</div>
              <div className="text-xs text-emerald-600 mt-1">Shareholders</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-700">{capTable.classes}</div>
              <div className="text-xs text-purple-600 mt-1">Share Classes</div>
            </div>
          </div>

          {/* Policy Engine Demo */}
          <div className="border-t border-gray-200 pt-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Policy Engine Demo</h3>
            <div className="text-xs text-gray-600 mb-2">
              <strong>Action:</strong> {policyDemo.action}
            </div>
            <div className={`text-xs font-medium px-3 py-2 rounded ${
              policyDemo.allowed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}>
              {policyDemo.allowed ? '✓ Allowed' : '✗ Blocked'}
            </div>
            <ul className="mt-2 space-y-1">
              {policyDemo.requirements.slice(0, 2).map((req, i) => (
                <li key={i} className="text-xs text-gray-500 flex items-start gap-1">
                  <span className="text-gray-400">•</span> {req}
                </li>
              ))}
            </ul>
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
