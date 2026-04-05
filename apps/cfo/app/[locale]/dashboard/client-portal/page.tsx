/**
 * CFO — Client Portal Dashboard.
 *
 * Client-facing view with financial health score, cash flow projection,
 * recent documents, and upcoming deadlines.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import { TrendingUp, FileText, CalendarDays, HeartPulse, DollarSign, Clock } from 'lucide-react'
import { listDocuments } from '@/lib/actions/misc-actions'
import { getCashFlowForecast, getAIInsights } from '@/lib/actions/advisory-actions'
import { getTaxDeadlines } from '@/lib/actions/integration-actions'

export default async function ClientPortalPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('client_portal:view')

  const [{ documents }, forecast, insights, deadlines] = await Promise.all([
    listDocuments({ pageSize: 5 }),
    getCashFlowForecast().catch(() => null),
    getAIInsights().catch(() => null),
    getTaxDeadlines().catch(() => []),
  ])

  // Derived health score from AI insights
  const anomalyCount = insights?.filter(i => i.type === 'anomaly')?.length ?? 0
  const healthScore = Math.max(0, 100 - anomalyCount * 15)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-poppins text-2xl font-bold text-foreground">Client Portal</h2>
        <p className="mt-1 text-sm text-muted-foreground">Your financial health at a glance</p>
      </div>

      {/* Health Score + Cash Flow */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className={`rounded-xl border p-5 ${healthScore >= 80 ? 'border-emerald-500/30 bg-emerald-500/5' : healthScore >= 50 ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
            <HeartPulse className="h-4 w-4" /> Financial Health
          </div>
          <p className="mt-2 font-poppins text-3xl font-bold text-foreground">{healthScore}%</p>
          <p className="mt-1 text-xs text-muted-foreground">{anomalyCount} anomal{anomalyCount !== 1 ? 'ies' : 'y'} detected</p>
        </div>

        {forecast && (
          <>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> Projected Revenue (30d)
              </div>
              <p className="mt-2 font-poppins text-2xl font-bold text-foreground">
                ${(forecast.forecast?.[0]?.projected ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                <DollarSign className="h-4 w-4 text-blue-500" /> Confidence
              </div>
              <p className="mt-2 font-poppins text-2xl font-bold text-foreground">
                {((forecast.forecast?.[0]?.confidence ?? 0) * 100).toFixed(0)}%
              </p>
            </div>
          </>
        )}
      </div>

      {/* AI Narrative */}
      {forecast?.summary && (
        <div className="rounded-xl border border-electric/20 bg-electric/5 p-5">
          <h3 className="mb-2 font-poppins text-sm font-semibold text-foreground">AI Financial Outlook</h3>
          <p className="text-sm text-foreground/80">{forecast.summary}</p>
        </div>
      )}

      {/* Recent Documents + Upcoming Deadlines side-by-side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-3">
            <h3 className="font-poppins text-sm font-semibold text-foreground">Recent Documents</h3>
          </div>
          {documents.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <FileText className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No documents yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 px-5 py-3">
                  <FileText className="h-4 w-4 text-electric" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">{doc.type}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString('en-CA') : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-5 py-3">
            <h3 className="font-poppins text-sm font-semibold text-foreground">Upcoming Deadlines</h3>
          </div>
          {!deadlines || deadlines.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <CalendarDays className="mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No upcoming deadlines.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {deadlines.slice(0, 5).map((d: { label: string; dueDate: string; type: string }, i: number) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3">
                  <Clock className="h-4 w-4 text-amber-500" />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{d.label}</p>
                    <p className="text-xs text-muted-foreground">{d.type}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{d.dueDate}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
