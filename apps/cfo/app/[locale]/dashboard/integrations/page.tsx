/**
 * CFO — Integrations Page (Server Component).
 *
 * Live connection statuses for Stripe, QuickBooks, and Tax Engine.
 * Sync triggers and upcoming tax deadlines.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Calendar,
  CreditCard,
  BookOpen,
  Calculator,
} from 'lucide-react'
import { getIntegrationStatuses, getTaxDeadlines, type IntegrationStatus } from '@/lib/actions/integration-actions'
import { SyncButton, ConnectButton } from '@/components/action-buttons'
import { TaxDisclaimer } from '@/components/tax-disclaimer'

function healthBadge(health: IntegrationStatus['health']) {
  switch (health) {
    case 'healthy':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-500">
          <CheckCircle2 className="h-3 w-3" /> Connected
        </span>
      )
    case 'degraded':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-500">
          <AlertCircle className="h-3 w-3" /> Degraded
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-500">
          <XCircle className="h-3 w-3" /> Disconnected
        </span>
      )
  }
}

function providerIcon(p: IntegrationStatus['provider']) {
  switch (p) {
    case 'stripe':
      return CreditCard
    case 'quickbooks':
      return BookOpen
    case 'tax-engine':
      return Calculator
  }
}

export default async function IntegrationsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('integrations:view')

  const [integrations, deadlines] = await Promise.all([
    getIntegrationStatuses(),
    getTaxDeadlines(),
  ])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-poppins text-2xl font-bold text-foreground">
          Integrations
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage financial data connections — Stripe, QuickBooks Online, Tax Engine
        </p>
      </div>

      {/* Integration Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => {
          const Icon = providerIcon(integration.provider)
          return (
            <div
              key={integration.id}
              className="rounded-xl border border-border bg-card p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-electric/10 text-electric">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-poppins text-sm font-semibold text-foreground">
                      {integration.name}
                    </p>
                    {healthBadge(integration.health)}
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-muted-foreground">
                {integration.details}
              </p>

              {integration.lastSync && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Last synced:{' '}
                  {new Date(integration.lastSync).toLocaleString('en-CA', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
              )}

              <div className="mt-4 flex gap-2">
                {integration.connected ? (
                  <SyncButton provider={integration.provider} />
                ) : (
                  <ConnectButton provider={integration.provider} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Tax Deadlines */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-amber-500" />
          <h3 className="font-poppins text-base font-semibold text-foreground">
            Upcoming Tax Deadlines
          </h3>
        </div>
        {!deadlines || (Array.isArray(deadlines) && deadlines.length === 0) ? (
          <div className="rounded-xl border border-dashed border-border py-10 text-center">
            <Calendar className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-foreground">No upcoming deadlines</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Tax deadlines will appear once the tax engine is configured.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-secondary/50">
                <tr>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Deadline</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Description</th>
                  <th className="px-4 py-3 font-medium text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {(Array.isArray(deadlines) ? deadlines : []).map(
                  (d: { dueDate?: string; label?: string; type?: string }, idx: number) => (
                    <tr key={idx} className="hover:bg-secondary/30">
                      <td className="px-4 py-3 font-medium text-foreground">
                        {d.dueDate ? new Date(d.dueDate).toLocaleDateString('en-CA') : '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {d.label ?? 'Tax deadline'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500">
                          {d.type ?? 'pending'}
                        </span>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Tax Disclaimer */}
      <TaxDisclaimer variant="compact" />
    </div>
  )
}
