/**
 * Mobility OS — Compliance Dashboard
 *
 * Overview of compliance workflows, pending reviews, risk scores,
 * and audit trail.
 */
export const dynamic = 'force-dynamic'

const workflowSteps = [
  { name: 'KYC Intake', key: 'kyc_intake' },
  { name: 'AML Screening', key: 'aml_screening' },
  { name: 'PEP Check', key: 'pep_check' },
  { name: 'Source of Funds', key: 'source_of_funds_review' },
  { name: 'Document Verification', key: 'document_verification' },
  { name: 'Compliance Approval', key: 'compliance_approval' },
]

export default async function CompliancePage() {
  // TODO: Replace with real compliance data
  const summary = {
    pendingReviews: 7,
    completedToday: 3,
    highRiskCases: 2,
    averageProcessingDays: 4.2,
  }

  const pendingCases = [
    { id: 'c-001', client: 'Jean-Pierre Mokolo', step: 'aml_screening', riskScore: 45, daysInStep: 2 },
    { id: 'c-002', client: 'Amina Diallo', step: 'pep_check', riskScore: 72, daysInStep: 1 },
    { id: 'c-004', client: 'Fatima Al-Hassan', step: 'source_of_funds_review', riskScore: 38, daysInStep: 3 },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Compliance</h1>
        <p className="text-gray-500 mt-1">KYC/AML workflows and compliance monitoring</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Pending Reviews</p>
          <p className="text-2xl font-bold text-amber-600 mt-1">{summary.pendingReviews}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Completed Today</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{summary.completedToday}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">High-Risk Cases</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{summary.highRiskCases}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-sm text-gray-500">Avg. Processing</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{summary.averageProcessingDays}d</p>
        </div>
      </div>

      {/* Workflow Pipeline */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Workflow Pipeline</h2>
        <div className="flex gap-2">
          {workflowSteps.map((step, i) => (
            <div key={step.key} className="flex items-center">
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center min-w-[120px]">
                <p className="text-xs text-gray-500 font-medium">{step.name}</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {pendingCases.filter((c) => c.step === step.key).length}
                </p>
              </div>
              {i < workflowSteps.length - 1 && (
                <svg className="h-4 w-4 text-gray-300 mx-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pending Reviews Table */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Pending Reviews</h2>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Client</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Current Step</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Risk Score</th>
                <th className="text-left px-6 py-3 font-medium text-gray-500">Days in Step</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pendingCases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition">
                  <td className="px-6 py-4 font-medium text-gray-900">{c.client}</td>
                  <td className="px-6 py-4 text-gray-600">{c.step.replace(/_/g, ' ')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      c.riskScore >= 70 ? 'bg-red-100 text-red-700' :
                      c.riskScore >= 40 ? 'bg-amber-100 text-amber-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {c.riskScore}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{c.daysInStep}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
