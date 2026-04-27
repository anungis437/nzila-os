import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { SYNTHETIC_PATIENTS } from '@/lib/synthetic-patients'

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const patient = SYNTHETIC_PATIENTS.find((p) => p.id === id)
  if (!patient) return { title: 'Not found' }
  return { title: `Access Log — ${patient.firstName} ${patient.lastName}` }
}

export default async function AccessLogPage({ params }: Props) {
  const { id } = await params
  const patient = SYNTHETIC_PATIENTS.find((p) => p.id === id)
  if (!patient) notFound()

  return (
    <div>
      <div className="mb-6">
        <Link href={`/patients/${patient.id}`} className="text-teal-600 hover:underline text-sm">
          ← Back to {patient.firstName} {patient.lastName}
        </Link>
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900 mb-2">
        Access Log — {patient.firstName} {patient.lastName}
      </h1>
      <p className="text-sm text-slate-400 mb-6">
        Synthetic audit events — no real patient data. All events are fabricated.
      </p>
      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Timestamp</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Actor</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Role</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Action</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {patient.accessLog.map((event) => (
              <tr key={`${event.timestamp}-${event.actorId}`} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{event.timestamp}</td>
                <td className="px-5 py-3 text-slate-700">{event.actorId}</td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                    {event.role}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                      event.action === 'BREAK_GLASS'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-teal-100 text-teal-700'
                    }`}
                  >
                    {event.action}
                  </span>
                </td>
                <td className="px-5 py-3 text-slate-500 text-xs">{event.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
