import Link from 'next/link'
import type { Metadata } from 'next'
import { KpiCard } from '@/components/kpi-card'

export const metadata: Metadata = { title: 'Dashboard' }

const kpis = [
  {
    title: 'Duplicate Test Risk',
    value: '23%',
    description: 'Estimated duplicate lab/imaging orders across network (synthetic)',
    trend: 'down' as const,
  },
  {
    title: 'Referral Delay',
    value: '4.2 days',
    description: 'Average days from referral to specialist contact (synthetic)',
    trend: 'stable' as const,
  },
  {
    title: 'Incomplete History Rate',
    value: '31%',
    description: 'Patients with incomplete cross-site history (synthetic)',
    trend: 'down' as const,
  },
  {
    title: 'Access Review Completion',
    value: '87%',
    description: 'Staff access reviews completed this quarter (synthetic)',
    trend: 'up' as const,
  },
]

const quickLinks = [
  { href: '/integrations', label: 'Integrations', icon: '⚡', description: 'Integration health status' },
  { href: '/access', label: 'Access', icon: '🔒', description: 'Access governance review' },
  { href: '/audit', label: 'Audit Log', icon: '📋', description: 'Synthetic audit events' },
  { href: '/analytics', label: 'Analytics', icon: '📊', description: 'KPI analytics dashboard' },
  { href: '/pilot-readiness', label: 'Pilot Readiness', icon: '🚀', description: 'Control matrix checklist' },
]

export default function AdminDashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">
          Veridian Care — Network Administration
        </h1>
        <p className="text-slate-500 mt-1">
          Synthetic demo environment · All data is fabricated
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {kpis.map((kpi) => (
          <KpiCard key={kpi.title} {...kpi} />
        ))}
      </div>

      <div className="mb-10 p-6 rounded-2xl bg-amber-50 border border-amber-200">
        <p className="text-amber-800 text-sm font-medium">
          ⚠ All KPI values are synthetic. Wire Veridian Insight to production connector data to
          surface real network metrics.
        </p>
      </div>

      <h2 className="text-xl font-bold text-slate-900 mb-5">Quick access</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quickLinks.map(({ href, label, icon, description }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-4 p-5 rounded-xl border border-slate-200 bg-white hover:border-teal-300 hover:shadow-sm transition-all"
          >
            <span className="text-3xl">{icon}</span>
            <div>
              <div className="font-semibold text-slate-800">{label}</div>
              <div className="text-xs text-slate-400">{description}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
