/**
 * Ops Dashboard — Nzila Service Operations Layer
 *
 * Internal ops health view: open tickets by product, client health,
 * MTTR, onboarding pipeline, overdue items.
 * Not a vendor dashboard — just what we need to run Nzila well.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DEFAULT_SLA_TARGETS } from '@nzila/itsm-core'
import { platformDb } from '@nzila/db/platform'
import { itsmTickets, opsClients } from '@nzila/db/schema'
import { sql, eq, and, ne } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Ops Dashboard | Service Operations',
}

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  trend?: 'up' | 'down' | 'neutral'
  trendLabel?: string
}

function KpiCard({ label, value, sub, trend, trendLabel }: KpiCardProps) {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-400'
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
      {trendLabel && (
        <p className={`text-xs font-medium mt-2 ${trendColor}`}>{trendLabel}</p>
      )}
    </div>
  )
}

export default async function ItsmDashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // Fetch real counts from internal ops tables
  const [openTicketsRow, liveClientsRow, overdueRow] = await Promise.all([
    platformDb
      .select({ count: sql<number>`count(*)::int` })
      .from(itsmTickets)
      .where(and(ne(itsmTickets.status, 'resolved'), ne(itsmTickets.status, 'closed')))
      .then((rows) => rows[0] ?? { count: 0 })
      .catch(() => ({ count: 0 })),
    platformDb
      .select({ count: sql<number>`count(*)::int` })
      .from(opsClients)
      .where(eq(opsClients.onboardingStage, 'live'))
      .then((rows) => rows[0] ?? { count: 0 })
      .catch(() => ({ count: 0 })),
    platformDb
      .select({ count: sql<number>`count(*)::int` })
      .from(itsmTickets)
      .where(sql`${itsmTickets.slaResolutionDue}::timestamptz < now() and ${itsmTickets.status} not in ('resolved','closed')`)
      .then((rows) => rows[0] ?? { count: 0 })
      .catch(() => ({ count: 0 })),
  ])

  const openTicketsCount = String(openTicketsRow.count ?? 0)
  const liveClientsCount = String(liveClientsRow.count ?? 0)
  const overdueCount = String(overdueRow.count ?? 0)

  const slaTargets = DEFAULT_SLA_TARGETS

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ops Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Nzila Service Operations — tickets, client health, and delivery metrics.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/itsm/clients" className="text-sm text-gray-600 hover:text-gray-900">Client Accounts →</Link>
          <Link href="/itsm/queue" className="text-sm text-blue-600 hover:text-blue-800">Support Desk →</Link>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Open Tickets" value={openTicketsCount} sub="Active right now" />
        <KpiCard label="Avg MTTR" value="— h" sub="Mean time to resolve (all products)" />
        <KpiCard label="Clients Live" value={liveClientsCount} sub="Fully onboarded" trend="neutral" />
        <KpiCard label="Overdue Items" value={overdueCount} sub="Past SLA or renewal" />
      </div>

      {/* Open tickets by product */}
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Open Tickets by Product</h2>
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
          {(['Union Eyes', 'FairCase', 'Flow', 'Zonga', 'Agrimo', 'Platform'] as const).map((product) => (
            <div key={product} className="rounded-lg bg-gray-50 border border-gray-200 p-3 text-center">
              <p className="text-xl font-bold text-gray-900">—</p>
              <p className="text-xs text-gray-500 mt-1">{product}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Open by priority */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-red-50 rounded-lg border border-red-200 p-4 text-center">
          <p className="text-xs font-semibold text-red-600 uppercase">P1 Critical</p>
          <p className="text-3xl font-bold text-red-700 mt-1">—</p>
          <p className="text-xs text-red-400 mt-1">
            SLO: {slaTargets.p1_critical.resolutionMinutes}m resolve
          </p>
        </div>
        <div className="bg-orange-50 rounded-lg border border-orange-200 p-4 text-center">
          <p className="text-xs font-semibold text-orange-600 uppercase">P2 High</p>
          <p className="text-3xl font-bold text-orange-700 mt-1">—</p>
          <p className="text-xs text-orange-400 mt-1">
            SLO: {slaTargets.p2_high.resolutionMinutes / 60}h resolve
          </p>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 text-center">
          <p className="text-xs font-semibold text-yellow-700 uppercase">P3 Medium</p>
          <p className="text-3xl font-bold text-yellow-700 mt-1">—</p>
          <p className="text-xs text-yellow-500 mt-1">
            SLO: {slaTargets.p3_medium.resolutionMinutes / 60}h resolve
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-xs font-semibold text-gray-500 uppercase">P4 Low</p>
          <p className="text-3xl font-bold text-gray-700 mt-1">—</p>
          <p className="text-xs text-gray-400 mt-1">
            SLO: {slaTargets.p4_low.resolutionMinutes / 60 / 24}d resolve
          </p>
        </div>
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Client Health Summary</h2>
          <div className="space-y-2 text-sm">
            {[{ label: 'Healthy', color: 'bg-green-500' }, { label: 'Needs Attention', color: 'bg-yellow-400' }, { label: 'At Risk', color: 'bg-red-500' }].map(({ label, color }) => (
              <div key={label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${color}`} />
                  <span className="text-gray-600">{label}</span>
                </div>
                <span className="text-gray-400">—</span>
              </div>
            ))}
          </div>
          <Link href="/itsm/clients" className="mt-3 block text-xs text-blue-600 hover:underline">Manage clients →</Link>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Onboarding Pipeline</h2>
          <div className="space-y-2 text-sm">
            {(['Prospect', 'Contract Signed', 'Tenant Created', 'Kickoff Booked', 'Training', 'Live'] as const).map((stage) => (
              <div key={stage} className="flex items-center justify-between">
                <span className="text-gray-600">{stage}</span>
                <span className="text-gray-400">—</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
