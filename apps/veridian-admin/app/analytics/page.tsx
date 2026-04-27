import type { Metadata } from 'next'
import { KpiCard } from '@/components/kpi-card'

export const metadata: Metadata = { title: 'Analytics' }

const metrics = [
  {
    title: 'Duplicate Test Risk',
    value: '23%',
    description: 'Estimated duplicate lab/imaging orders across network',
    trend: 'down' as const,
    chartDescription: 'TREND (synthetic): 31% → 28% → 25% → 23% (improving over 4 quarters)',
    insight: 'Duplicate test rate declining as cross-site history completeness improves. Driven by Veridian Timeline adoption at connected sites.',
  },
  {
    title: 'Referral Delay',
    value: '4.2 days',
    description: 'Average days from referral to specialist contact',
    trend: 'stable' as const,
    chartDescription: 'TREND (synthetic): 5.1d → 4.8d → 4.5d → 4.2d (improving gradually)',
    insight: 'Referral delay stable. Context package completeness at 78% — increasing to 90%+ is projected to reduce delay by 1.2 days.',
  },
  {
    title: 'Incomplete History Rate',
    value: '31%',
    description: 'Patients with incomplete cross-site history',
    trend: 'down' as const,
    chartDescription: 'TREND (synthetic): 44% → 39% → 35% → 31% (improving with each site connection)',
    insight: 'History completeness improving as connector coverage expands. Target: <20% within 6 months of full network connection.',
  },
  {
    title: 'Access Review Completion',
    value: '87%',
    description: 'Staff access reviews completed this quarter',
    trend: 'up' as const,
    chartDescription: 'TREND (synthetic): 62% → 71% → 80% → 87% (improving with Veridian Access adoption)',
    insight: 'Access review completion improving significantly since access governance tooling deployment. Target 95%+ is achievable within one quarter.',
  },
]

export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">KPI Analytics</h1>
        <p className="text-slate-500 mt-1">
          Synthetic analytics — wire to real connector data for production metrics.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {metrics.map((m) => (
          <KpiCard
            key={m.title}
            title={m.title}
            value={m.value}
            description={m.description}
            trend={m.trend}
          />
        ))}
      </div>

      <div className="space-y-6">
        {metrics.map((m) => (
          <div key={m.title} className="p-6 rounded-2xl border border-slate-200 bg-white">
            <h2 className="text-lg font-bold text-slate-900 mb-3">{m.title}</h2>
            <div className="p-4 bg-slate-900 rounded-xl font-mono text-sm text-teal-300 mb-4">
              {m.chartDescription}
            </div>
            <p className="text-sm text-slate-600">{m.insight}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 p-5 bg-amber-50 rounded-xl border border-amber-200">
        <p className="text-amber-800 text-sm font-medium">
          ⚠ Synthetic analytics — wire to real connector data for production. All values and trends
          above are fabricated for demonstration purposes.
        </p>
      </div>
    </div>
  )
}
