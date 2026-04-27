// SYNTHETIC DEMO DATA — no real patient records
import React from 'react'

export interface PatientHeaderProps {
  mrn: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender?: string
  syntheticDemo?: boolean
}

export function PatientHeader({
  mrn,
  firstName,
  lastName,
  dateOfBirth,
  gender,
  syntheticDemo = true,
}: PatientHeaderProps) {
  return (
    <div className="patient-header">
      {syntheticDemo && (
        <div className="synthetic-banner" role="alert" aria-label="Synthetic demo data warning">
          ⚠ Synthetic clinical demo data — not real patient records
        </div>
      )}
      <div className="patient-name">
        {firstName} {lastName}
      </div>
      <div className="patient-meta">
        MRN: {mrn} · DOB: {dateOfBirth}
        {gender ? ` · ${gender}` : ''}
      </div>
    </div>
  )
}
