import Link from 'next/link'
import { currentUser } from '@clerk/nextjs/server'
import { Card } from '@nzila/ui'
import {
  DocumentTextIcon,
  UserGroupIcon,
  ArrowDownTrayIcon,
  PlusIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'

// ── Data fetching ───────────────────────────────────────────────────────────

interface DashboardStats {
  activeQuotes: number | null
  pendingReview: number | null
  acceptedMtd: number | null
  revenueMtd: number | null
}

async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const { db, commerceQuotes } = await import('@nzila/db')
    const { sql, eq, and, gte } = await import('drizzle-orm')

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [activeResult, pendingResult, acceptedResult, revenueResult] =
      await Promise.allSettled([
        db.select({ count: sql<number>`count(*)` })
          .from(commerceQuotes)
          .where(eq(commerceQuotes.status, 'draft')),
        db.select({ count: sql<number>`count(*)` })
          .from(commerceQuotes)
          .where(eq(commerceQuotes.status, 'sent')),
        db.select({ count: sql<number>`count(*)` })
          .from(commerceQuotes)
          .where(and(
            eq(commerceQuotes.status, 'accepted'),
            gte(commerceQuotes.updatedAt, startOfMonth),
          )),
        db.select({ total: sql<number>`COALESCE(SUM(CAST(total AS NUMERIC)), 0)` })
          .from(commerceQuotes)
          .where(and(
            eq(commerceQuotes.status, 'accepted'),
            gte(commerceQuotes.updatedAt, startOfMonth),
          )),
      ])

    return {
      activeQuotes: activeResult.status === 'fulfilled' ? Number(activeResult.value[0]?.count ?? 0) : null,
      pendingReview: pendingResult.status === 'fulfilled' ? Number(pendingResult.value[0]?.count ?? 0) : null,
      acceptedMtd: acceptedResult.status === 'fulfilled' ? Number(acceptedResult.value[0]?.count ?? 0) : null,
      revenueMtd: revenueResult.status === 'fulfilled' ? Number(revenueResult.value[0]?.total ?? 0) : null,
    }
  } catch {
    return { activeQuotes: null, pendingReview: null, acceptedMtd: null, revenueMtd: null }
  }
}

function formatStat(value: number | null, isCurrency = false): string {
  if (value === null) return '—'
  if (isCurrency) return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(value)
  return value.toLocaleString()
}

const quickActions = [
  {
    name: 'New Quote',
    href: '/quotes/new',
    icon: PlusIcon,
    description: 'Create a new gift box proposal.',
    color: 'bg-purple-50 text-purple-600 hover:bg-purple-100',
  },
  {
    name: 'View Clients',
    href: '/clients',
    icon: UserGroupIcon,
    description: 'Manage your client directory.',
    color: 'bg-blue-50 text-blue-600 hover:bg-blue-100',
  },
  {
    name: 'Import Legacy',
    href: '/import',
    icon: ArrowDownTrayIcon,
    description: 'Migrate data from ShopMoiÇa V1.',
    color: 'bg-amber-50 text-amber-600 hover:bg-amber-100',
  },
]

export default async function DashboardPage() {
  const user = await currentUser()
  const data = await getDashboardStats()

  const statItems = [
    { label: 'Active Quotes', value: formatStat(data.activeQuotes), icon: DocumentTextIcon, color: 'text-purple-600 bg-purple-50', live: data.activeQuotes !== null },
    { label: 'Pending Review', value: formatStat(data.pendingReview), icon: ClockIcon, color: 'text-amber-600 bg-amber-50', live: data.pendingReview !== null },
    { label: 'Accepted (MTD)', value: formatStat(data.acceptedMtd), icon: CheckCircleIcon, color: 'text-green-600 bg-green-50', live: data.acceptedMtd !== null },
    { label: 'Revenue (MTD)', value: formatStat(data.revenueMtd, true), icon: CurrencyDollarIcon, color: 'text-blue-600 bg-blue-50', live: data.revenueMtd !== null },
  ]

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ''}
        </h1>
        <p className="text-gray-500 mt-1">Here&apos;s an overview of your quoting activity.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statItems.map((stat) => (
          <Card key={stat.label}>
            <div className="p-5 flex items-center gap-4">
              <div className={`rounded-lg p-2.5 ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm text-gray-500">{stat.label}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                {stat.live && <p className="text-[10px] text-green-500 mt-0.5">Live from DB</p>}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick actions + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick actions */}
        <div className="lg:col-span-1">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Quick Actions
          </h2>
          <div className="space-y-3">
            {quickActions.map((action) => (
              <Link
                key={action.name}
                href={action.href}
                className={`flex items-center gap-3 p-4 rounded-xl border border-gray-200 transition ${action.color}`}
              >
                <action.icon className="h-6 w-6" />
                <div>
                  <p className="font-semibold text-gray-900">{action.name}</p>
                  <p className="text-xs text-gray-500">{action.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent activity */}
        <div className="lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Recent Activity
          </h2>
          <div className="bg-white rounded-xl border border-gray-200">
            {([] as { id: string; action: string; detail: string; time: string }[]).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between px-5 py-4 border-b border-gray-100 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{item.action}</p>
                  <p className="text-xs text-gray-500">{item.detail}</p>
                </div>
                <span className="text-xs text-gray-400">{item.time}</span>
              </div>
            ))}

            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <ExclamationTriangleIcon className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No quotes yet. Create your first one!</p>
              <Link
                href="/quotes/new"
                className="mt-3 text-sm font-semibold text-purple-600 hover:text-purple-700"
              >
                Create Quote →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
