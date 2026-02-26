/**
 * CFO — Platform Admin (Multi-Org Management).
 *
 * Platform admin only — manages firms, subscriptions, MRR metrics.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Building2, DollarSign, Users, TrendingUp } from 'lucide-react'
import { requireRole } from '@/lib/rbac'
import { getPlatformMetrics, listFirms } from '@/lib/actions/platform-admin-actions'
import { FirmActions } from '@/components/firm-actions'

export default async function PlatformAdminPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  try {
    await requireRole('platform_admin')
  } catch {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <Building2 className="mb-4 h-12 w-12 text-red-400" />
        <h2 className="font-poppins text-xl font-bold text-foreground">Access Denied</h2>
        <p className="mt-2 text-sm text-muted-foreground">This page is restricted to platform administrators.</p>
      </div>
    )
  }

  const [metrics, firms] = await Promise.all([
    getPlatformMetrics(),
    listFirms(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-foreground">Platform Admin</h2>
        <p className="mt-1 text-sm text-muted-foreground">Multi-org firm management & revenue metrics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <DollarSign className="h-4 w-4 text-emerald-500" /> MRR
          </div>
          <p className="mt-2 font-poppins text-2xl font-bold text-foreground">
            ${metrics.mrr.toLocaleString()}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <Building2 className="h-4 w-4 text-blue-500" /> Total Firms
          </div>
          <p className="mt-2 font-poppins text-2xl font-bold text-foreground">{metrics.totalFirms}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <Users className="h-4 w-4 text-purple-500" /> Active Firms
          </div>
          <p className="mt-2 font-poppins text-2xl font-bold text-foreground">{metrics.activeFirms}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-amber-500" /> Suspended
          </div>
          <p className="mt-2 font-poppins text-2xl font-bold text-foreground">{metrics.totalFirms - metrics.activeFirms - metrics.trialCount}</p>
        </div>
      </div>

      {/* Firms Table */}
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-4 py-3 font-medium text-muted-foreground">Firm</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Tier</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Members</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Joined</th>
              <th className="px-4 py-3 font-medium text-muted-foreground">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {firms.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No firms registered.</td></tr>
            ) : (
              firms.map((firm) => (
                <tr key={firm.id} className="hover:bg-secondary/50">
                  <td className="px-4 py-3 font-medium text-foreground">{firm.name}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tierStyle(firm.subscriptionTier)}`}>
                      {firm.subscriptionTier}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${firm.status === 'active' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
                      {firm.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{firm.userCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {firm.createdAt ? new Date(firm.createdAt).toLocaleDateString('en-CA') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <FirmActions firmId={firm.id} status={firm.status} tier={firm.subscriptionTier} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function tierStyle(tier: string) {
  switch (tier) {
    case 'enterprise': return 'bg-purple-500/10 text-purple-500'
    case 'professional': return 'bg-blue-500/10 text-blue-500'
    default: return 'bg-secondary text-muted-foreground'
  }
}
