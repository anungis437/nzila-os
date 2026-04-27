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
  if (!patient) return { title: 'Patient not found' }
  return { title: `${patient.firstName} ${patient.lastName}` }
}

const subPages = [
  { href: 'timeline', label: 'Timeline', icon: '📋' },
  { href: 'labs', label: 'Labs', icon: '🧪' },
  { href: 'medications', label: 'Medications', icon: '💊' },
  { href: 'referrals', label: 'Referrals', icon: '🔄' },
  { href: 'access', label: 'Access Log', icon: '🔒' },
]

export default async function PatientOverviewPage({ params }: Props) {
  const { id } = await params
  const patient = SYNTHETIC_PATIENTS.find((p) => p.id === id)
  if (!patient) notFound()

  const activeReferrals = patient.referrals.filter((r) => r.status === 'pending' || r.status === 'overdue').length
  const activeMeds = patient.medications.filter((m) => m.status === 'active').length

  return (
    <div>
      {/* Patient header */}
      <div className="mb-8 p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-900">
              {patient.firstName} {patient.lastName}
            </h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-slate-500">
              <span>MRN: <strong className="text-slate-700">{patient.mrn}</strong></span>
              <span>DOB: <strong className="text-slate-700">{patient.dateOfBirth}</strong></span>
              <span>Gender: <strong className="text-slate-700">{patient.gender}</strong></span>
              <span>Site: <strong className="text-slate-700">{patient.siteId}</strong></span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="px-3 py-1.5 rounded-full bg-teal-100 text-teal-700 text-xs font-bold">
              CLINICIAN · READ_TIMELINE · ✓ Allowed
            </span>
            <span className="px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
              SYNTHETIC DEMO
            </span>
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Encounters', value: patient.encounters.length },
          { label: 'Lab results', value: patient.labs.length },
          { label: 'Active medications', value: activeMeds },
          { label: 'Open referrals', value: activeReferrals },
        ].map(({ label, value }) => (
          <div key={label} className="p-5 rounded-xl border border-slate-200 bg-white text-center">
            <div className="text-3xl font-extrabold text-teal-600">{value}</div>
            <div className="text-sm text-slate-500 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Sub-navigation */}
      <div className="grid sm:grid-cols-2 md:grid-cols-5 gap-3">
        {subPages.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={`/patients/${patient.id}/${href}`}
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-300 hover:shadow-sm transition-all"
          >
            <span className="text-2xl">{icon}</span>
            <span className="font-semibold text-slate-700">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
