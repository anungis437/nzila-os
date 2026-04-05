/**
 * CFO — Security Operations Center.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import { Shield, ShieldAlert, ShieldCheck, Database } from 'lucide-react'
import {
  getSecurityPosture,
  listSecurityEvents,
  listIncidents,
  listBackups,
  listComplianceItems,
} from '@/lib/actions/security-actions'
import { SecurityScanButton, ResolveEventButton, UpdateIncidentButton } from '@/components/security-buttons'

function scoreBadge(score: number) {
  if (score >= 80) return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
  if (score >= 50) return 'bg-amber-500/10 text-amber-600 border-amber-500/30'
  return 'bg-red-500/10 text-red-600 border-red-500/30'
}

export default async function SecurityPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('security:view')

  const [posture, { events }, incidents, backups, compliance] = await Promise.all([
    getSecurityPosture(),
    listSecurityEvents({ page: 1 }),
    listIncidents(),
    listBackups(),
    listComplianceItems(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">Security Operations</h2>
          <p className="mt-1 text-sm text-muted-foreground">SOC overview, incidents & compliance</p>
        </div>
        <SecurityScanButton />
      </div>

      {/* Posture Score + Metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className={`rounded-xl border p-5 ${scoreBadge(posture.overallScore)}`}>
          <div className="flex items-center gap-2 text-xs font-medium uppercase">
            <Shield className="h-4 w-4" /> Security Score
          </div>
          <p className="mt-2 font-poppins text-3xl font-bold">{posture.overallScore}</p>
        </div>
        <MetricCard icon={<ShieldAlert className="h-4 w-4 text-red-500" />} label="Open Incidents" value={posture.incidentsSummary.open} />
        <MetricCard icon={<ShieldCheck className="h-4 w-4 text-emerald-500" />} label="Compliance" value={`${posture.complianceScore}%`} />
        <MetricCard icon={<Database className="h-4 w-4 text-blue-500" />} label="Last Backup" value={posture.backupStatus.lastSuccess ? new Date(posture.backupStatus.lastSuccess).toLocaleDateString('en-CA') : 'Never'} />
      </div>

      {/* Recent Security Events */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h3 className="font-poppins text-sm font-semibold text-foreground">Recent Security Events</h3>
        </div>
        {events.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No security events recorded.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {events.map((ev) => (
              <div key={ev.id} className="flex items-center gap-3 px-5 py-3">
                <SeverityDot severity={ev.severity} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{ev.description}</p>
                  <p className="text-xs text-muted-foreground">{ev.type} · {ev.createdAt ? new Date(ev.createdAt).toLocaleString('en-CA') : ''}</p>
                </div>
                {!ev.resolved && <ResolveEventButton eventId={ev.id} />}
                {ev.resolved && <span className="text-xs text-emerald-500 font-medium">Resolved</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Incidents */}
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="border-b border-border px-5 py-3">
          <h3 className="font-poppins text-sm font-semibold text-foreground">Incidents</h3>
        </div>
        {incidents.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">No incidents.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {incidents.map((inc) => (
              <div key={inc.id} className="flex items-center gap-3 px-5 py-3">
                <SeverityDot severity={inc.severity} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{inc.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {inc.status} · {inc.createdAt ? new Date(inc.createdAt).toLocaleString('en-CA') : ''}
                  </p>
                </div>
                {inc.status !== 'resolved' && <UpdateIncidentButton incidentId={inc.id} currentStatus={inc.status} />}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Backups + Compliance side-by-side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-3">
            <h3 className="font-poppins text-sm font-semibold text-foreground">Backups</h3>
          </div>
          {backups.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No backup records.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {backups.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{b.type} backup</p>
                    <p className="text-xs text-muted-foreground">{b.createdAt ? new Date(b.createdAt).toLocaleString('en-CA') : ''}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-3">
            <h3 className="font-poppins text-sm font-semibold text-foreground">Compliance</h3>
          </div>
          {compliance.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No compliance items.</p>
          ) : (
            <div className="divide-y divide-border/50">
              {compliance.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.framework}</p>
                    <p className="text-xs text-muted-foreground">{c.criterion}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${c.status === 'compliant' ? 'bg-emerald-500/10 text-emerald-500' : c.status === 'non-compliant' ? 'bg-red-500/10 text-red-500' : 'bg-amber-500/10 text-amber-500'}`}>
                    {c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">{icon} {label}</div>
      <p className="mt-2 font-poppins text-2xl font-bold text-foreground">{value}</p>
    </div>
  )
}

function SeverityDot({ severity }: { severity: string }) {
  const color = severity === 'critical' ? 'bg-red-500' : severity === 'high' ? 'bg-amber-500' : severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'
  return <span className={`h-2 w-2 rounded-full ${color}`} />
}
