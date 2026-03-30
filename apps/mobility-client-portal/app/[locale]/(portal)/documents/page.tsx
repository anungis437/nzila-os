/**
 * Client Portal — Documents
 *
 * View required documents, upload new ones, check verification status.
 */
export const dynamic = 'force-dynamic'

const statusConfig: Record<string, { label: string; color: string }> = {
  required: { label: 'Required', color: 'bg-red-100 text-red-700' },
  uploaded: { label: 'Uploaded', color: 'bg-blue-100 text-blue-700' },
  verified: { label: 'Verified', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Resubmit', color: 'bg-amber-100 text-amber-700' },
  expired: { label: 'Expired', color: 'bg-gray-100 text-gray-700' },
}

export default async function DocumentsPage() {
  // TODO: Replace with real client-scoped query
  const documents = [
    { id: 'd-001', name: 'Passport (Certified Copy)', type: 'passport', status: 'verified', note: null },
    { id: 'd-002', name: 'Bank Statements (6 months)', type: 'bank_statement', status: 'required', note: 'Must be from primary bank account' },
    { id: 'd-003', name: 'Tax Return 2025', type: 'tax_return', status: 'uploaded', note: null },
    { id: 'd-004', name: 'Police Clearance Certificate', type: 'police_clearance', status: 'rejected', note: 'Must be apostilled — please resubmit with apostille' },
    { id: 'd-005', name: 'Medical Report', type: 'medical_report', status: 'required', note: 'From approved physician only' },
    { id: 'd-006', name: 'Source of Funds Declaration', type: 'source_of_funds', status: 'expired', note: 'Original expired — new declaration needed' },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
        <p className="text-gray-500 mt-1">Upload and track your required documents</p>
      </div>

      <div className="space-y-3">
        {documents.map((doc) => {
          const config = statusConfig[doc.status] ?? statusConfig.required
          return (
            <div key={doc.id} className="bg-white border border-[var(--border)] rounded-xl p-5 flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h3 className="font-medium text-gray-900">{doc.name}</h3>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${config.color}`}>
                    {config.label}
                  </span>
                </div>
                {doc.note && <p className="text-sm text-gray-500 mt-1">{doc.note}</p>}
              </div>

              {(doc.status === 'required' || doc.status === 'rejected' || doc.status === 'expired') && (
                <button className="ml-4 px-4 py-2 text-sm font-medium text-white bg-[var(--primary)] rounded-lg hover:opacity-90 transition">
                  Upload
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
