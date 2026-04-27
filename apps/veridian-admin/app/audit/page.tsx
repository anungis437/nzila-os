import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Audit Log' }

interface AuditEvent {
  timestamp: string
  actor: string
  role: string
  patient: string
  action: string
  reason?: string
}

const auditEvents: AuditEvent[] = [
  { timestamp: '2024-12-02T11:05:00Z', actor: 'clinician-demo-03', role: 'CLINICIAN', patient: 'MRN-DEMO-1002', action: 'READ_LABS', reason: undefined },
  { timestamp: '2024-12-02T11:07:00Z', actor: 'clinician-demo-01', role: 'CLINICIAN', patient: 'MRN-DEMO-1002', action: 'READ_MEDICATIONS', reason: undefined },
  { timestamp: '2024-11-18T09:14:00Z', actor: 'clinician-demo-01', role: 'CLINICIAN', patient: 'MRN-DEMO-1001', action: 'READ_TIMELINE', reason: undefined },
  { timestamp: '2024-10-28T10:20:00Z', actor: 'clinician-demo-01', role: 'CLINICIAN', patient: 'MRN-DEMO-1003', action: 'READ_TIMELINE', reason: undefined },
  { timestamp: '2024-09-05T14:32:00Z', actor: 'clinician-demo-02', role: 'SPECIALIST', patient: 'MRN-DEMO-1001', action: 'READ_FULL', reason: 'Cardiology referral review' },
  { timestamp: '2024-08-11T08:55:00Z', actor: 'clinician-demo-04', role: 'CLINICIAN', patient: 'MRN-DEMO-1003', action: 'BREAK_GLASS', reason: 'Emergency review — patient admitted acutely' },
]

export default function AuditPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-slate-900">Audit Log</h1>
        <p className="text-slate-400 text-sm mt-1">
          Synthetic audit events — no real patient data. All events are fabricated for demonstration
          purposes.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Timestamp</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Actor</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Role</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Patient</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Action</th>
              <th className="text-left px-5 py-3 font-semibold text-slate-600">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {auditEvents.map((event, i) => (
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-mono text-xs text-slate-500">{event.timestamp}</td>
                <td className="px-5 py-3 font-mono text-xs text-slate-700">{event.actor}</td>
                <td className="px-5 py-3">
                  <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold">
                    {event.role}
                  </span>
                </td>
                <td className="px-5 py-3 font-mono text-xs text-slate-600">{event.patient}</td>
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
                <td className="px-5 py-3 text-xs text-slate-400">{event.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
