import { Card } from '@nzila/ui'
import { getPlatformAnalytics } from '@/lib/actions/admin-actions'

export default async function AnalyticsPage() {
  const analytics = await getPlatformAnalytics()

  const metrics = [
    { label: 'Total Pipeline (ARR)', value: `$${analytics.totalRevenue.toLocaleString()}`, sub: 'All registered deals' },
    { label: 'Total Deals', value: analytics.totalDeals.toLocaleString(), sub: 'Pipeline entries' },
    { label: 'Conversion Rate', value: `${analytics.dealConversionRate}%`, sub: 'Deals won vs total' },
    { label: 'Avg. Deal Size', value: `$${analytics.avgDealSize.toLocaleString()}`, sub: 'Mean estimated ARR' },
  ]

  return (
    <div className="max-w-7xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Partner Analytics</h1>
        <p className="mt-1 text-sm text-slate-500">
          Platform-wide partner performance metrics — live data
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {metrics.map((m) => (
          <Card key={m.label}>
            <div className="p-5">
              <p className="text-sm text-slate-500">{m.label}</p>
              <p className="mt-2 text-2xl font-bold text-slate-900">{m.value}</p>
              <p className="text-xs text-slate-400 mt-1">{m.sub}</p>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Partners */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Top Partners by Pipeline</h3>
          {analytics.topPartners.length > 0 ? (
            <div className="space-y-3">
              {analytics.topPartners.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-slate-700">{p.companyName}</p>
                    <p className="text-xs text-slate-400">{p.dealCount} deals</p>
                  </div>
                  <span className="text-sm font-bold text-slate-900">
                    ${Number(p.totalArr).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">No partner data yet</p>
          )}
        </div>

        {/* Deals by Vertical */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900 mb-4">Deals by Vertical</h3>
          {analytics.dealsByVertical.length > 0 ? (
            <div className="space-y-3">
              {analytics.dealsByVertical.map((v, i) => {
                const maxCount = Math.max(...analytics.dealsByVertical.map((d) => Number(d.count)))
                const pct = maxCount > 0 ? (Number(v.count) / maxCount) * 100 : 0
                return (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-slate-600">{v.vertical}</span>
                      <span className="font-medium text-slate-900">{v.count}</span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-8 text-center">No deal data yet</p>
          )}
        </div>
      </div>

      {/* Monthly Revenue */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="font-semibold text-slate-900 mb-6">Monthly Commission Revenue</h3>
        {analytics.revenueByMonth.length > 0 ? (
          <div className="h-64 flex items-end justify-between gap-2">
            {analytics.revenueByMonth.map((item) => {
              const maxRevenue = Math.max(...analytics.revenueByMonth.map((m) => Number(m.amount)))
              const height = maxRevenue > 0 ? (Number(item.amount) / maxRevenue) * 100 : 0
              return (
                <div key={item.month} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full bg-blue-600 rounded-t hover:bg-blue-700 transition-colors"
                    style={{ height: `${height}%` }}
                    title={`$${Number(item.amount).toLocaleString()}`}
                  />
                  <span className="text-xs text-slate-500 mt-2">{item.month}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-12 text-center">
            Commission data will appear here as deals close
          </p>
        )}
      </div>
    </div>
  )
}
