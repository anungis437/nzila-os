/**
 * CFO Dashboard — Server component that queries real data from @nzila/db.
 *
 * When no DB connection is available (local dev without DATABASE_URL),
 * falls back to "No data yet" instead of showing fake numbers.
 */
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import {
  Users,
  FileText,
  RefreshCw,
  AlertTriangle,
  Calculator,
} from 'lucide-react'

// ── Data fetching ───────────────────────────────────────────────────────────

interface DashboardStats {
  activeClients: number | null
  reportsGenerated: number | null
  complianceScore: number | null
  teamMembers: number | null
}

async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const { db } = await import('@nzila/db')
    const { sql } = await import('drizzle-orm')

    // Parallel queries for dashboard metrics
    const [clientsResult, reportsResult, teamResult] = await Promise.allSettled([
      db.execute(sql`SELECT COUNT(*) as count FROM orgs WHERE status = 'active'`),
      db.execute(sql`SELECT COUNT(*) as count FROM audit_log WHERE action LIKE 'report.%'`),
      db.execute(sql`SELECT COUNT(*) as count FROM org_members WHERE status = 'active'`),
    ])

    return {
      activeClients: clientsResult.status === 'fulfilled'
        ? Number((clientsResult.value as unknown as { rows: { count: number }[] }).rows?.[0]?.count ?? 0)
        : null,
      reportsGenerated: reportsResult.status === 'fulfilled'
        ? Number((reportsResult.value as unknown as { rows: { count: number }[] }).rows?.[0]?.count ?? 0)
        : null,
      complianceScore: null, // Computed from governance rules — future phase
      teamMembers: teamResult.status === 'fulfilled'
        ? Number((teamResult.value as unknown as { rows: { count: number }[] }).rows?.[0]?.count ?? 0)
        : null,
    }
  } catch {
    return { activeClients: null, reportsGenerated: null, complianceScore: null, teamMembers: null }
  }
}

function formatStat(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString()
}

// ── Component ───────────────────────────────────────────────────────────────

const quickActions = [
  { label: 'New Client', href: 'clients/new', icon: Users },
  { label: 'Generate Report', href: 'reports/new', icon: FileText },
  { label: 'Run Reconciliation', href: 'ledger/reconcile', icon: RefreshCw },
  { label: 'View Alerts', href: 'alerts', icon: AlertTriangle },
  { label: 'Tax Tools', href: 'tax-tools', icon: Calculator },
]

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('dashboard:view')

  const stats = await getDashboardStats()

  const statCards = [
    { label: 'Active Clients', value: formatStat(stats.activeClients), change: stats.activeClients !== null ? 'Live from DB' : 'No data yet' },
    { label: 'Reports Generated', value: formatStat(stats.reportsGenerated), change: stats.reportsGenerated !== null ? 'Live from DB' : 'No data yet' },
    { label: 'Compliance Score', value: formatStat(stats.complianceScore), change: 'Coming soon' },
    { label: 'Team Members', value: formatStat(stats.teamMembers), change: stats.teamMembers !== null ? 'Live from DB' : 'No data yet' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-foreground">
          Dashboard
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back. Here&apos;s your firm overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-border bg-card p-6 shadow-sm"
          >
            <p className="text-sm text-muted-foreground">{stat.label}</p>
            <p className="mt-2 font-poppins text-3xl font-bold text-foreground">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{stat.change}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="mb-4 font-poppins text-lg font-semibold text-foreground">
          Quick Actions
        </h3>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-electric/10 text-electric transition-colors group-hover:bg-electric group-hover:text-white">
                <action.icon className="h-5 w-5" />
              </div>
              <span className="font-poppins text-sm font-medium text-foreground">
                {action.label}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
