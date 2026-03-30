/**
 * Mobility OS — Advisor Dashboard
 *
 * Overview metrics: active cases, pending compliance, program breakdown,
 * recent activity feed.
 */
export const dynamic = 'force-dynamic'

interface StatCardProps {
  label: string
  value: string | number
  change?: string
  color: string
}

function StatCard({ label, value, change, color }: StatCardProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center gap-4">
        <div className={`inline-flex p-3 rounded-lg ${color}`}>
          <div className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && <p className="text-xs text-green-600 mt-0.5">{change}</p>}
        </div>
      </div>
    </div>
  )
}

export default async function DashboardPage() {
  // TODO: Replace with real DB queries once wired
  const stats = {
    activeCases: 24,
    pendingCompliance: 7,
    documentsAwaiting: 12,
    clientsOnboarded: 156,
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Overview of your mobility advisory practice</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active Cases"
          value={stats.activeCases}
          change="+3 this week"
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="Pending Compliance"
          value={stats.pendingCompliance}
          color="bg-amber-50 text-amber-600"
        />
        <StatCard
          label="Documents Awaiting"
          value={stats.documentsAwaiting}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          label="Clients Onboarded"
          value={stats.clientsOnboarded}
          change="+8 this month"
          color="bg-green-50 text-green-600"
        />
      </div>

      {/* Recent Activity */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          <div className="p-4 text-sm text-gray-500">
            Activity feed will be populated once case data is wired.
          </div>
        </div>
      </div>
    </div>
  )
}
