'use client'

import { useState } from 'react'
import Link from 'next/link'
import { SYNTHETIC_PATIENTS } from '@/lib/synthetic-patients'

export function PatientSearch() {
  const [query, setQuery] = useState('')

  const filtered = SYNTHETIC_PATIENTS.filter((p) => {
    const q = query.toLowerCase()
    return (
      p.firstName.toLowerCase().includes(q) ||
      p.lastName.toLowerCase().includes(q) ||
      p.mrn.toLowerCase().includes(q)
    )
  })

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or MRN…"
        className="w-full max-w-md px-4 py-3 rounded-xl border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500 mb-6"
      />
      <div className="space-y-3">
        {filtered.map((patient) => (
          <Link
            key={patient.id}
            href={`/patients/${patient.id}`}
            className="flex items-center justify-between p-5 rounded-xl border border-slate-200 bg-white hover:shadow-md hover:border-teal-300 transition-all"
          >
            <div>
              <div className="font-semibold text-slate-900">
                {patient.firstName} {patient.lastName}
              </div>
              <div className="text-sm text-slate-500">
                MRN: {patient.mrn} · DOB: {patient.dateOfBirth} · {patient.gender}
              </div>
            </div>
            <span className="text-teal-500 text-sm font-medium">View record →</span>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-slate-400 text-sm">No synthetic patients matched your search.</p>
        )}
      </div>
    </div>
  )
}
