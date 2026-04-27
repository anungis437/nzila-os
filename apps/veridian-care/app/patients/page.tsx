import type { Metadata } from 'next'
import { PatientSearch } from '@/components/patient-search'

export const metadata: Metadata = { title: 'Patient Search' }

export default function PatientsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Patient Search</h1>
        <p className="text-slate-500 mt-1">
          Searching synthetic demo patients only. No real patient records are present.
        </p>
      </div>
      <PatientSearch />
    </div>
  )
}
