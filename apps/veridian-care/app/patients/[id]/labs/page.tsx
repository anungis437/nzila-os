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
  return { title: `Labs — ${patient.firstName} ${patient.lastName}` }
}

export default async function LabsPage({ params }: Props) {
  const { id } = await params
  const patient = SYNTHETIC_PATIENTS.find((p) => p.id === id)
  if (!patient) notFound()

  const sorted = [...patient.labs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  return (
    <div>
      <div className="mb-6">
        <Link href={`/patients/${patient.id}`} className="text-teal-600 hover:underline text-sm">
          ← Back to {patient.firstName} {patient.lastName}
        </Link>
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900 mb-6">
        Lab Results — {patient.firstName} {patient.lastName}
      </h1>
      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Date</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Test</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Code</th>
              <th className="text-right px-5 py-3 font-semibold text-slate-600">Value</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Unit</th>
              <th className="text-center px-5 py-3 font-semibold text-slate-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((lab) => (
              <tr key={`${lab.date}-${lab.code}`} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-500">{lab.date}</td>
                <td className="px-5 py-3 font-medium text-slate-900">{lab.name}</td>
                <td className="px-5 py-3 font-mono text-slate-400 text-xs">{lab.code}</td>
                <td className="px-5 py-3 text-right font-bold text-slate-900">{lab.value}</td>
                <td className="px-5 py-3 text-slate-500">{lab.unit}</td>
                <td className="px-5 py-3 text-center">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                      lab.status === 'normal'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {lab.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
