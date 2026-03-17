import {
  CurrencyDollarIcon,
  DocumentTextIcon,
  ArrowTrendingUpIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

// ── Placeholder analytics data ─────────────────────────────────────────────

const kpis = [
  {
    label: 'Revenue (MTD)',
    value: '$0.00',
    change: '+0%',
    icon: CurrencyDollarIcon,
    color: 'text-green-600 bg-green-50',
  },
  {
    label: 'Quotes Created',
    value: '0',
    change: '+0',
    icon: DocumentTextIcon,
    color: 'text-purple-600 bg-purple-50',
  },
  {
    label: 'Conversion Rate',
    value: '0%',
    change: '—',
    icon: ArrowTrendingUpIcon,
    color: 'text-indigo-600 bg-indigo-50',
  },
  {
    label: 'Avg. Turnaround',
    value: '0 days',
    change: '—',
    icon: ClockIcon,
    color: 'text-amber-600 bg-amber-50',
  },
]

const pipelineStages = [
  { stage: 'Draft', count: 0, value: '$0', color: 'bg-gray-200' },
  { stage: 'Pricing', count: 0, value: '$0', color: 'bg-blue-200' },
  { stage: 'Sent', count: 0, value: '$0', color: 'bg-purple-200' },
  { stage: 'Reviewing', count: 0, value: '$0', color: 'bg-amber-200' },
  { stage: 'Accepted', count: 0, value: '$0', color: 'bg-green-200' },
  { stage: 'Declined', count: 0, value: '$0', color: 'bg-red-200' },
]

const topClients = [
  { name: 'No data yet', quotes: 0, revenue: '$0.00' },
]

const monthlyTrend = [
  { month: 'Sep', quotes: 0, revenue: 0 },
  { month: 'Oct', quotes: 0, revenue: 0 },
  { month: 'Nov', quotes: 0, revenue: 0 },
  { month: 'Dec', quotes: 0, revenue: 0 },
  { month: 'Jan', quotes: 0, revenue: 0 },
  { month: 'Feb', quotes: 0, revenue: 0 },
]

export default function AnalyticsPage() {
  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
        <p className="text-sm text-gray-500 mt-1">
          Quoting performance, conversion metrics, and revenue trends.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4"
          >
            <div className={`rounded-lg p-2.5 ${kpi.color}`}>
              <kpi.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-gray-500">{kpi.label}</p>
              <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
              <p className="text-xs text-gray-400 mt-0.5">{kpi.change}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Pipeline */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Quote Pipeline
          </h2>
          <div className="space-y-3">
            {pipelineStages.map((stage) => (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="text-sm text-gray-600 w-20">{stage.stage}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                  <div
                    className={`h-full ${stage.color} rounded-full flex items-center px-2 text-xs font-semibold text-gray-700 transition-all`}
                    style={{ width: stage.count > 0 ? `${Math.max(15, stage.count * 10)}%` : '0%' }}
                  >
                    {stage.count > 0 ? stage.count : ''}
                  </div>
                </div>
                <span className="text-sm font-mono text-gray-500 w-16 text-right">
                  {stage.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Top Clients */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
            Top Clients
          </h2>
          <div className="space-y-3">
            {topClients.map((client, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{client.name}</p>
                  <p className="text-xs text-gray-500">{client.quotes} quotes</p>
                </div>
                <span className="text-sm font-mono text-gray-900">{client.revenue}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
          Monthly Trend
        </h2>
        <div className="grid grid-cols-6 gap-3">
          {monthlyTrend.map((m) => (
            <div key={m.month} className="text-center">
              <div className="bg-gray-100 rounded-lg h-32 flex items-end justify-center pb-2 mb-2">
                <div
                  className="bg-purple-400 rounded w-8 transition-all"
                  style={{ height: m.quotes > 0 ? `${Math.max(10, m.quotes * 8)}%` : '4px' }}
                />
              </div>
              <p className="text-xs font-semibold text-gray-700">{m.month}</p>
              <p className="text-xs text-gray-400">{m.quotes} quotes</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4 text-center">
          Data will populate as quotes are created and completed.
        </p>
      </div>
    </div>
  )
}
