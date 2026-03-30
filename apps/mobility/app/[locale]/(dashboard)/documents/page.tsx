/**
 * Mobility OS — Documents Management
 *
 * Document tracking, upload status, and verification workflow.
 */
export const dynamic = 'force-dynamic'

const verificationBadge: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  verified: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-amber-100 text-amber-700',
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string; type?: string }>
}) {
  const params = await searchParams
  const _caseId = params.case
  const _type = params.type

  // TODO: Replace with real DB query
  const documents = [
    { id: 'd-001', name: 'Passport - JP Mokolo', type: 'passport', client: 'Jean-Pierre Mokolo', status: 'verified', uploadedAt: '2026-03-05' },
    { id: 'd-002', name: 'Bank Statement Q4', type: 'bank_statement', client: 'Amina Diallo', status: 'pending', uploadedAt: '2026-03-08' },
    { id: 'd-003', name: 'Tax Return 2025', type: 'tax_return', client: 'Chen Wei', status: 'verified', uploadedAt: '2026-03-02' },
    { id: 'd-004', name: 'Police Clearance', type: 'police_clearance', client: 'Fatima Al-Hassan', status: 'rejected', uploadedAt: '2026-03-07' },
    { id: 'd-005', name: 'Medical Report', type: 'medical_report', client: 'Kwame Asante', status: 'pending', uploadedAt: '2026-03-09' },
    { id: 'd-006', name: 'Source of Funds Declaration', type: 'source_of_funds', client: 'Jean-Pierre Mokolo', status: 'expired', uploadedAt: '2025-09-15' },
  ]

  const counts = {
    total: documents.length,
    pending: documents.filter((d) => d.status === 'pending').length,
    verified: documents.filter((d) => d.status === 'verified').length,
    rejected: documents.filter((d) => d.status === 'rejected').length,
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documents</h1>
          <p className="text-gray-500 mt-1">Track and verify client documents</p>
        </div>
        <button className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:opacity-90 transition">
          Request Documents
        </button>
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-6">
        <span className="text-sm text-gray-500">{counts.total} total</span>
        <span className="text-sm text-amber-600">{counts.pending} pending</span>
        <span className="text-sm text-green-600">{counts.verified} verified</span>
        <span className="text-sm text-red-600">{counts.rejected} rejected</span>
      </div>

      {/* Documents Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Document</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Type</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Client</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Status</th>
              <th className="text-left px-6 py-3 font-medium text-gray-500">Uploaded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-gray-50 transition cursor-pointer">
                <td className="px-6 py-4 font-medium text-gray-900">{doc.name}</td>
                <td className="px-6 py-4 text-gray-600">{doc.type.replace(/_/g, ' ')}</td>
                <td className="px-6 py-4 text-gray-600">{doc.client}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${verificationBadge[doc.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {doc.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">{doc.uploadedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
