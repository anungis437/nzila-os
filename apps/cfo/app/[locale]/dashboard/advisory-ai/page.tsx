/**
 * CFO — Financial Operational Cognition Page (Server Component + Client Islands).
 *
 * Bounded financial operational cognition surface providing continuity-safe
 * interpretation, anomaly signaling, and cash-flow continuity forecasts.
 * Final authority remains with accountable financial operators.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import {
  Brain,
  MessageSquare,
  Lightbulb,
  TrendingUp,
  AlertTriangle,
  Info,
} from 'lucide-react'
import { getAIInsights, getCashFlowForecast, type Insight } from '@/lib/actions/advisory-actions'
import { AdvisoryChatForm } from '@/components/advisory-chat-form'

function severityIcon(s: Insight['severity']) {
  switch (s) {
    case 'critical':
      return <AlertTriangle className="h-4 w-4 text-red-500" />
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />
    default:
      return <Info className="h-4 w-4 text-blue-500" />
  }
}

function severityBorder(s: Insight['severity']) {
  switch (s) {
    case 'critical':
      return 'border-red-500/30 bg-red-500/5'
    case 'warning':
      return 'border-amber-500/30 bg-amber-500/5'
    default:
      return 'border-blue-500/30 bg-blue-500/5'
  }
}

export default async function AdvisoryAIPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('advisory_ai:view')

  const [insights, forecast] = await Promise.all([
    getAIInsights(),
    getCashFlowForecast(6),
  ])

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric/10 text-electric">
          <Brain className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">
            Financial Operational Cognition
          </h2>
          <p className="text-sm text-muted-foreground">
            Bounded institutional interpretation, continuity-safe anomaly signaling, and cash-flow continuity briefings. Final authority remains with accountable financial operators.
          </p>
        </div>
      </div>

      {/* Continuity Inquiry Prompt */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-electric" />
          <h3 className="font-poppins text-base font-semibold text-foreground">
            Operational Continuity Inquiry
          </h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Submit a bounded financial continuity inquiry — cash-flow context, budget variance interpretation, tax-planning continuity, or compliance review. Responses are interpretive support only; final authority remains with accountable financial operators.
        </p>
        <AdvisoryChatForm />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Financial Operational Interpretations */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            <h3 className="font-poppins text-base font-semibold text-foreground">
              Financial Operational Interpretations
            </h3>
          </div>
          {insights.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
              <Lightbulb className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No insights yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Insights will appear as your financial data accumulates.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {insights.map((insight) => (
                <div
                  key={insight.id}
                  className={`rounded-xl border p-4 ${severityBorder(insight.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    {severityIcon(insight.severity)}
                    <div className="flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {insight.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {insight.description}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="inline-flex rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                          {insight.type}
                        </span>
                        {insight.actionable && (
                          <span className="inline-flex rounded-full bg-electric/10 px-2 py-0.5 text-xs text-electric">
                            Actionable
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Cash Flow Forecast */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-emerald-500" />
            <h3 className="font-poppins text-base font-semibold text-foreground">
              Cash Flow Forecast
            </h3>
          </div>
          {!forecast ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-12 text-center">
              <TrendingUp className="mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm font-medium text-foreground">No forecast available</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Connect your financial data sources to enable forecasting.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="mb-4 text-sm text-muted-foreground">{forecast.summary}</p>
              <div className="space-y-2">
                {forecast.forecast.map((month) => (
                  <div
                    key={month.month}
                    className="flex items-center justify-between rounded-lg bg-secondary/50 px-4 py-2"
                  >
                    <span className="text-sm font-medium text-foreground">{month.month}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-foreground">
                        {new Intl.NumberFormat('en-CA', {
                          style: 'currency',
                          currency: 'CAD',
                          maximumFractionDigits: 0,
                        }).format(month.projected)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {Math.round(month.confidence * 100)}% conf
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
