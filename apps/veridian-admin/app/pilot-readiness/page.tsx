import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Pilot Readiness' }

type ControlStatus = 'complete' | 'in-progress' | 'not-started'

interface Control {
  id: string
  category: string
  description: string
  status: ControlStatus
}

const VERIDIAN_CONTROL_MATRIX: Control[] = [
  // Integration
  { id: 'INT-01', category: 'Integration', description: 'FHIR R4 connector configured and validated', status: 'complete' },
  { id: 'INT-02', category: 'Integration', description: 'HL7 v2 feed configured (if applicable)', status: 'in-progress' },
  { id: 'INT-03', category: 'Integration', description: 'CSV import pipeline tested end-to-end', status: 'complete' },
  { id: 'INT-04', category: 'Integration', description: 'Schema validation passing for all source feeds', status: 'in-progress' },
  // Consent & Access
  { id: 'ACC-01', category: 'Access & Consent', description: 'Patient consent registry configured', status: 'complete' },
  { id: 'ACC-02', category: 'Access & Consent', description: 'RBAC roles defined and assigned', status: 'complete' },
  { id: 'ACC-03', category: 'Access & Consent', description: 'Break-glass protocol tested and documented', status: 'in-progress' },
  { id: 'ACC-04', category: 'Access & Consent', description: 'Access expiry and review schedule configured', status: 'not-started' },
  // Governance
  { id: 'GOV-01', category: 'Governance', description: 'Audit log operational and exportable', status: 'complete' },
  { id: 'GOV-02', category: 'Governance', description: 'Access review cycle established', status: 'in-progress' },
  { id: 'GOV-03', category: 'Governance', description: 'Privacy officer briefed on consent model', status: 'complete' },
  { id: 'GOV-04', category: 'Governance', description: 'Data residency requirements confirmed', status: 'complete' },
  // Clinical Workflow
  { id: 'CLN-01', category: 'Clinical Workflow', description: 'Clinician portal walkthrough completed', status: 'complete' },
  { id: 'CLN-02', category: 'Clinical Workflow', description: 'Timeline view validated against known synthetic records', status: 'complete' },
  { id: 'CLN-03', category: 'Clinical Workflow', description: 'Referral flow tested with synthetic handoff scenario', status: 'in-progress' },
  { id: 'CLN-04', category: 'Clinical Workflow', description: 'Clinical feedback session completed', status: 'not-started' },
  // Analytics
  { id: 'ANL-01', category: 'Analytics', description: 'KPI baseline established (duplicate test, referral delay)', status: 'in-progress' },
  { id: 'ANL-02', category: 'Analytics', description: 'History completeness metric calculated', status: 'not-started' },
  { id: 'ANL-03', category: 'Analytics', description: 'Access review completion rate measured', status: 'complete' },
]

const statusConfig: Record<ControlStatus, { color: string; icon: string; label: string }> = {
  complete: { color: 'bg-emerald-100 text-emerald-700', icon: '✓', label: 'Complete' },
  'in-progress': { color: 'bg-amber-100 text-amber-700', icon: '◐', label: 'In progress' },
  'not-started': { color: 'bg-slate-100 text-slate-500', icon: '○', label: 'Not started' },
}

const total = VERIDIAN_CONTROL_MATRIX.length
const complete = VERIDIAN_CONTROL_MATRIX.filter((c) => c.status === 'complete').length
const readinessScore = Math.round((complete / total) * 100)

const categories = [...new Set(VERIDIAN_CONTROL_MATRIX.map((c) => c.category))]

export default function PilotReadinessPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Pilot Readiness</h1>
        <p className="text-slate-500 mt-1">
          Veridian Control Matrix — synthetic readiness status for demo purposes.
        </p>
      </div>

      {/* Readiness score */}
      <div className="mb-10 p-6 rounded-2xl border border-slate-200 bg-white flex flex-wrap items-center gap-8">
        <div className="text-center">
          <div className="text-5xl font-extrabold" style={{ color: readinessScore >= 80 ? '#059669' : readinessScore >= 60 ? '#d97706' : '#dc2626' }}>
            {readinessScore}%
          </div>
          <div className="text-sm text-slate-500 mt-1">Overall readiness score</div>
        </div>
        <div className="flex gap-6">
          {(['complete', 'in-progress', 'not-started'] as ControlStatus[]).map((status) => {
            const count = VERIDIAN_CONTROL_MATRIX.filter((c) => c.status === status).length
            const config = statusConfig[status]
            return (
              <div key={status} className="text-center">
                <div className="text-2xl font-bold text-slate-900">{count}</div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${config.color}`}>
                  {config.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Controls by category */}
      <div className="space-y-8">
        {categories.map((category) => {
          const controls = VERIDIAN_CONTROL_MATRIX.filter((c) => c.category === category)
          return (
            <div key={category}>
              <h2 className="text-lg font-bold text-slate-800 mb-4">{category}</h2>
              <div className="space-y-2">
                {controls.map((control) => {
                  const config = statusConfig[control.status]
                  return (
                    <div
                      key={control.id}
                      className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 bg-white"
                    >
                      <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${config.color} shrink-0`}>
                        {config.icon}
                      </span>
                      <div className="flex-1">
                        <span className="font-mono text-xs text-slate-400 mr-3">{control.id}</span>
                        <span className="text-sm text-slate-800">{control.description}</span>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${config.color}`}>
                        {config.label}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
