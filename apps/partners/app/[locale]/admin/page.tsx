import { Card } from '@nzila/ui'
import {
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { getPartnerStats, getAllPartners } from '@/lib/partner-auth'

export default async function AdminDashboardPage() {
  // Get platform-wide stats
  let stats = {
    total_partners: 0,
    active_partners: 0,
    pending_partners: 0,
    suspended_partners: 0,
    elite_partners: 0,
    select_partners: 0,
    registered_partners: 0,
    channel_partners: 0,
    isv_partners: 0,
    enterprise_partners: 0,
  }

  try {
    const statsData = await getPartnerStats()
    if (statsData && typeof statsData === 'object') {
      stats = statsData as typeof stats
    }
  } catch {
    // Stats not available
  }

  // Get recent partners
  let recentPartners: Array<{
    id: string
    companyName: string
    type: string
    tier: string
    status: string
    createdAt: Date | null
  }> = []

  try {
    const partners = await getAllPartners()
    recentPartners = partners.slice(0, 5)
  } catch {
    // Partners not available
  }

  const statCards = [
    {
      label: 'Total Partners',
      value: stats.total_partners,
      icon: UsersIcon,
      color: 'text-blue-600 bg-blue-100',
    },
    {
      label: 'Active Partners',
      value: stats.active_partners,
      icon: CheckCircleIcon,
      color: 'text-green-600 bg-green-100',
    },
    {
      label: 'Pending Approval',
      value: stats.pending_partners,
      icon: ClockIcon,
      color: 'text-amber-600 bg-amber-100',
    },
    {
      label: 'Suspended',
      value: stats.suspended_partners,
      icon: XCircleIcon,
      color: 'text-red-600 bg-red-100',
    },
  ]

  const tierDistribution = [
    { label: 'Elite', value: stats.elite_partners, color: 'bg-purple-600' },
    { label: 'Select', value: stats.select_partners, color: 'bg-blue-600' },
    { label: 'Registered', value: stats.registered_partners, color: 'bg-slate-400' },
  ]

  const typeDistribution = [
    { label: 'Channel', value: stats.channel_partners },
    { label: 'ISV', value: stats.isv_partners },
    { label: 'Enterprise', value: stats.enterprise_partners },
  ]

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Partner Platform Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overview of all partners on the platform
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((card) => (
          <Card key={card.label}>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className={`p-2 rounded-lg ${card.color}`}>
                  <card.icon className="w-5 h-5" />
                </div>
              </div>
              <p className="mt-3 text-3xl font-bold text-slate-900">{card.value}</p>
              <p className="text-sm text-slate-500 mt-1">{card.label}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tier Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Partner Tier Distribution</h3>
          <div className="space-y-4">
            {tierDistribution.map((tier) => {
              const percentage = stats.total_partners > 0 
                ? Math.round((tier.value / stats.total_partners) * 100) 
                : 0
              return (
                <div key={tier.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-600">{tier.label}</span>
                    <span className="text-slate-900 font-medium">{tier.value} ({percentage}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${tier.color} rounded-full transition-all`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Partner Type Distribution */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Partner Type Distribution</h3>
          <div className="space-y-3">
            {typeDistribution.map((type) => (
              <div key={type.label} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm font-medium text-slate-700">{type.label}</span>
                <span className="text-lg font-bold text-slate-900">{type.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Partners */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Recent Partners</h3>
            <a href="/admin/partners" className="text-sm text-blue-600 hover:underline">
              View all →
            </a>
          </div>
          
          {recentPartners.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Company</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Type</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Tier</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Status</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-500 uppercase">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPartners.map((partner) => (
                    <tr key={partner.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="py-3 px-4 text-sm font-medium text-slate-900">{partner.companyName}</td>
                      <td className="py-3 px-4 text-sm text-slate-600 capitalize">{partner.type}</td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          partner.tier === 'elite' 
                            ? 'bg-purple-100 text-purple-800'
                            : partner.tier === 'select'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {partner.tier}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          partner.status === 'active' 
                            ? 'bg-green-100 text-green-800'
                            : partner.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : partner.status === 'suspended'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {partner.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-500">
                        {partner.createdAt ? new Date(partner.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500">
              <UsersIcon className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p>No partners yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
