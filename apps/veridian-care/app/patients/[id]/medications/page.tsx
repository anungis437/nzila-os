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
  return { title: `Medications — ${patient.firstName} ${patient.lastName}` }
}

export default async function MedicationsPage({ params }: Props) {
  const { id } = await params
  const patient = SYNTHETIC_PATIENTS.find((p) => p.id === id)
  if (!patient) notFound()

  const active = patient.medications.filter((m) => m.status === 'active')
  const discontinued = patient.medications.filter((m) => m.status === 'discontinued')

  return (
    <div>
      <div className="mb-6">
        <Link href={`/patients/${patient.id}`} className="text-teal-600 hover:underline text-sm">
          ← Back to {patient.firstName} {patient.lastName}
        </Link>
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900 mb-6">
        Medications — {patient.firstName} {patient.lastName}
      </h1>

      {active.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Active medications</h2>
          <div className="space-y-3">
            {active.map((med) => (
              <div
                key={med.name}
                className="p-5 rounded-xl border border-emerald-200 bg-emerald-50 flex flex-wrap gap-4 items-start justify-between"
              >
                <div>
                  <div className="font-bold text-slate-900">{med.name}</div>
                  <div className="text-sm text-slate-600 mt-1">
                    {med.dose} · {med.frequency}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Prescribed by {med.prescribedBy} · Started {med.startDate}
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-200 text-emerald-800 text-xs font-bold shrink-0">
                  Active
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {discontinued.length > 0 && (
        <section>
          <h2 className="text-lg font-bold text-slate-800 mb-4">Discontinued medications</h2>
          <div className="space-y-3">
            {discontinued.map((med) => (
              <div
                key={med.name}
                className="p-5 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap gap-4 items-start justify-between opacity-70"
              >
                <div>
                  <div className="font-bold text-slate-700 line-through">{med.name}</div>
                  <div className="text-sm text-slate-500 mt-1">
                    {med.dose} · {med.frequency}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Prescribed by {med.prescribedBy} · Started {med.startDate}
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-slate-200 text-slate-600 text-xs font-bold shrink-0">
                  Discontinued
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
