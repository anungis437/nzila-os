import Link from 'next/link'
import type { Metadata } from 'next'
import { SYNTHETIC_PATIENTS } from '@/lib/synthetic-patients'

export const metadata: Metadata = { title: 'Dashboard' }

const overduReferrals = SYNTHETIC_PATIENTS.flatMap((p) =>
  p.referrals.filter((r) => r.status === 'overdue'),
).length

const pendingReferrals = SYNTHETIC_PATIENTS.flatMap((p) =>
  p.referrals.filter((r) => r.status === 'pending'),
).length

const kpiCards = [
  { label: 'Synthetic patients', value: SYNTHETIC_PATIENTS.length.toString(), color: 'bg-teal-50 border-teal-200 text-teal-700' },
  { label: 'Active alerts', value: '1', color: 'bg-amber-50 border-amber-200 text-amber-700' },
  { label: 'Pending referrals', value: pendingReferrals.toString(), color: 'bg-blue-50 border-blue-200 text-blue-700' },
  { label: 'Overdue referrals', value: overduReferrals.toString(), color: 'bg-rose-50 border-rose-200 text-rose-700' },
]

export default function DashboardPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Veridian Care — Clinical Portal</h1>
        <p className="text-slate-500 mt-1">
          Synthetic demo environment · {SYNTHETIC_PATIENTS.length} demonstration patients
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {kpiCards.map(({ label, value, color }) => (
          <div key={label} className={`p-6 rounded-2xl border ${color}`}>
            <div className="text-4xl font-extrabold mb-1">{value}</div>
            <div className="text-sm font-medium opacity-80">{label}</div>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-2xl border border-slate-200 bg-white">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Quick access</h2>
        <div className="flex flex-wrap gap-4">
          <Link
            href="/patients"
            className="px-5 py-3 rounded-xl font-semibold text-white transition-colors"
            style={{ backgroundColor: '#0d9488' }}
          >
            Patient search →
          </Link>
        </div>
      </div>
    </div>
  )
}
