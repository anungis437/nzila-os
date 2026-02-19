import {
  RocketLaunchIcon,
  CurrencyDollarIcon,
  AcademicCapIcon,
  ChartBarIcon,
  BellIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'

const stats = [
  { label: 'Active Deals', value: '—', icon: RocketLaunchIcon, change: null },
  { label: 'YTD Commissions', value: '—', icon: CurrencyDollarIcon, change: null },
  { label: 'Certifications', value: '0 / 6', icon: AcademicCapIcon, change: null },
  { label: 'Partner Score', value: '—', icon: ChartBarIcon, change: null },
]

const actions = [
  { label: 'Register a new deal', href: '/portal/deals/new', primary: true },
  { label: 'Browse asset library', href: '/portal/assets' },
  { label: 'Start a certification', href: '/portal/certifications' },
  { label: 'Generate API keys', href: '/portal/api-hub' },
]

export default function DashboardPage() {
  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Partner Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Welcome back. Here&apos;s an overview of your partnership.
          </p>
        </div>
        <button className="relative p-2 rounded-lg border border-slate-200 hover:bg-white transition">
          <BellIcon className="w-5 h-5 text-slate-500" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-600 rounded-full border-2 border-slate-50" />
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between">
              <s.icon className="w-5 h-5 text-slate-400" />
              {s.change && (
                <span className="flex items-center text-xs text-green-600 font-medium">
                  <ArrowTrendingUpIcon className="w-3 h-3 mr-0.5" />
                  {s.change}
                </span>
              )}
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900">{s.value}</p>
            <p className="text-xs text-slate-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          {actions.map((a) => (
            <a
              key={a.label}
              href={a.href}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                a.primary
                  ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              {a.label}
            </a>
          ))}
        </div>
      </div>

      {/* Recent activity + notifications placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        {/* Activity feed */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900">Recent Activity</h3>
          <div className="mt-4 flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <ArrowTrendingUpIcon className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm text-slate-500">Your activity feed will appear here</p>
            <p className="text-xs text-slate-400 mt-1">Register your first deal to get started</p>
          </div>
        </div>

        {/* Partner scorecard */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-900">Partner Scorecard</h3>
          <div className="mt-4 space-y-4">
            {[
              { label: 'Pipeline Activity', score: 0, max: 25 },
              { label: 'Certifications', score: 0, max: 25 },
              { label: 'Deal Conversions', score: 0, max: 25 },
              { label: 'Engagement', score: 0, max: 25 },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-slate-600">{item.label}</span>
                  <span className="text-slate-400">{item.score} / {item.max}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all"
                    style={{ width: `${(item.score / item.max) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
