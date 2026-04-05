/**
 * CFO — AI Insights Page.
 *
 * Dedicated view for ML-detected anomalies, trend analysis,
 * and proactive financial recommendations.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { requirePermission } from '@/lib/rbac'
import { Sparkles, AlertTriangle, TrendingUp, Lightbulb } from 'lucide-react'
import { getAIInsights, type Insight } from '@/lib/actions/advisory-actions'

function typeIcon(t: Insight['type']) {
  switch (t) {
    case 'anomaly': return <AlertTriangle className="h-4 w-4 text-red-500" />
    case 'trend': return <TrendingUp className="h-4 w-4 text-blue-500" />
    case 'recommendation': return <Lightbulb className="h-4 w-4 text-amber-500" />
    case 'alert': return <AlertTriangle className="h-4 w-4 text-amber-500" />
  }
}

export default async function AIInsightsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  await requirePermission('ai_insights:view')

  const insights = await getAIInsights()

  const anomalies = insights.filter((i) => i.type === 'anomaly')
  const recommendations = insights.filter((i) => i.type === 'recommendation' || i.type === 'trend')
  const alerts = insights.filter((i) => i.type === 'alert')

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-electric/10 text-electric">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <h2 className="font-poppins text-2xl font-bold text-foreground">AI Insights</h2>
          <p className="text-sm text-muted-foreground">
            Machine learning–detected patterns across your financial data
          </p>
        </div>
      </div>

      {insights.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center">
          <Sparkles className="mb-4 h-12 w-12 text-muted-foreground/40" />
          <p className="font-poppins text-lg font-semibold text-foreground">No insights yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            AI insights will appear as your financial data accumulates.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          {[
            { title: 'Anomalies', items: anomalies, empty: 'No anomalies detected' },
            { title: 'Recommendations', items: recommendations, empty: 'No recommendations yet' },
            { title: 'Alerts', items: alerts, empty: 'No alerts' },
          ].map((section) => (
            <div key={section.title}>
              <h3 className="mb-3 font-poppins text-sm font-semibold text-foreground">
                {section.title} ({section.items.length})
              </h3>
              {section.items.length === 0 ? (
                <p className="text-xs text-muted-foreground">{section.empty}</p>
              ) : (
                <div className="space-y-2">
                  {section.items.map((insight) => (
                    <div key={insight.id} className="rounded-lg border border-border bg-card p-3 shadow-sm">
                      <div className="flex items-start gap-2">
                        {typeIcon(insight.type)}
                        <div>
                          <p className="text-sm font-medium text-foreground">{insight.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{insight.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
