import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Platform Status' }

const services = [
  { name: 'Veridian Connect (Ingest)', status: 'operational' },
  { name: 'Veridian Timeline (API)', status: 'operational' },
  { name: 'Veridian Access (Consent Engine)', status: 'operational' },
  { name: 'Veridian Flow (Referral Tracking)', status: 'operational' },
  { name: 'Veridian Insight (Analytics)', status: 'operational' },
  { name: 'Clinician Portal', status: 'operational' },
  { name: 'Admin Portal', status: 'operational' },
  { name: 'Audit Log Service', status: 'operational' },
]

export default function StatusPage() {
  return (
    <div className="py-20 px-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 mb-4">Platform Status</h1>
          <div className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl bg-emerald-50 border border-emerald-200">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-bold text-emerald-700 text-lg">All systems operational</span>
          </div>
        </div>

        <div className="space-y-3">
          {services.map(({ name, status }) => (
            <div
              key={name}
              className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white"
            >
              <span className="font-medium text-slate-800">{name}</span>
              <span className="flex items-center gap-2 text-sm font-semibold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                {status}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-slate-400">
          Last updated: {new Date().toUTCString()}
        </p>
      </div>
    </div>
  )
}
