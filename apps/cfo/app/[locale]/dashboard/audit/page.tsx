/**
 * CFO — Audit Trail Page.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import { getAuditStats } from '@/lib/actions/audit-actions'
import { AuditLogViewer } from '@/components/audit-log-viewer'
import { ScrollText, Users, Zap, CalendarDays } from 'lucide-react'

export default async function AuditPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('audit:view')

  const stats = await getAuditStats()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-foreground">Audit Trail</h2>
        <p className="mt-1 text-sm text-muted-foreground">Complete activity log for compliance and forensics</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<ScrollText className="h-4 w-4 text-electric" />} label="Total Entries" value={stats.totalEntries} />
        <StatCard icon={<CalendarDays className="h-4 w-4 text-emerald-500" />} label="Today" value={stats.todayEntries} />
        <StatCard icon={<Users className="h-4 w-4 text-blue-500" />} label="Unique Actors" value={stats.uniqueActors} />
        <StatCard icon={<Zap className="h-4 w-4 text-amber-500" />} label="Action Types" value={stats.uniqueActions} />
      </div>

      <AuditLogViewer />
    </div>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">{icon} {label}</div>
      <p className="mt-2 font-poppins text-2xl font-bold text-foreground">{value}</p>
    </div>
  )
}
