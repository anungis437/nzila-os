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
  return { title: `Timeline — ${patient.firstName} ${patient.lastName}` }
}

export default async function TimelinePage({ params }: Props) {
  const { id } = await params
  const patient = SYNTHETIC_PATIENTS.find((p) => p.id === id)
  if (!patient) notFound()

  const sorted = [...patient.encounters].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )

  return (
    <div>
      <div className="mb-6 flex items-center gap-4">
        <Link href={`/patients/${patient.id}`} className="text-teal-600 hover:underline text-sm">
          ← Back to {patient.firstName} {patient.lastName}
        </Link>
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900 mb-6">
        Clinical Timeline — {patient.firstName} {patient.lastName}
      </h1>
      <div className="relative pl-8 border-l-2 border-teal-200 space-y-8">
        {sorted.map((encounter) => (
          <div key={`${encounter.date}-${encounter.type}`} className="relative">
            <span className="absolute -left-10 top-1 w-4 h-4 rounded-full bg-teal-500 border-2 border-white shadow" />
            <div className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="text-xs font-bold text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                    {encounter.type}
                  </span>
                  <span className="ml-3 text-sm text-slate-400">{encounter.date}</span>
                </div>
              </div>
              <p className="text-slate-700 mb-3">{encounter.summary}</p>
              <div className="flex gap-4 text-xs text-slate-500">
                <span>👩‍⚕️ {encounter.provider}</span>
                <span>🏥 {encounter.facility}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
