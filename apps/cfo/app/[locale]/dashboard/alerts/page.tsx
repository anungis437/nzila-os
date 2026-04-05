/**
 * CFO — Alerts Page.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import { AlertTriangle, Info, Bell } from 'lucide-react'
import { listAlerts, type Alert } from '@/lib/actions/misc-actions'
import { AcknowledgeAlertButton } from '@/components/acknowledge-alert-button'

function alertStyle(severity: Alert['severity']) {
  switch (severity) {
    case 'critical': return { border: 'border-red-500/30 bg-red-500/5', icon: <AlertTriangle className="h-4 w-4 text-red-500" /> }
    case 'warning': return { border: 'border-amber-500/30 bg-amber-500/5', icon: <AlertTriangle className="h-4 w-4 text-amber-500" /> }
    default: return { border: 'border-blue-500/30 bg-blue-500/5', icon: <Info className="h-4 w-4 text-blue-500" /> }
  }
}

export default async function AlertsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('alerts:view')

  const alerts = await listAlerts()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-foreground">Alerts</h2>
        <p className="mt-1 text-sm text-muted-foreground">{alerts.length} alert{alerts.length !== 1 ? 's' : ''}</p>
      </div>

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center">
          <Bell className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="font-poppins text-lg font-semibold text-foreground">No alerts</p>
          <p className="mt-1 text-sm text-muted-foreground">Everything is running smoothly.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const style = alertStyle(alert.severity)
            return (
              <div key={alert.id} className={`flex items-start gap-3 rounded-xl border p-4 ${style.border}`}>
                {style.icon}
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{alert.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {alert.source} · {alert.createdAt ? new Date(alert.createdAt).toLocaleString('en-CA') : '—'}
                  </p>
                </div>
                {!alert.read && (
                  <span className="h-2 w-2 rounded-full bg-electric" />
                )}
                {!alert.acknowledged && (
                  <AcknowledgeAlertButton alertId={alert.id} />
                )}
                {alert.acknowledged && (
                  <span className="text-xs text-emerald-500 font-medium">Acknowledged</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
