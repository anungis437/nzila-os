/**
 * Client Portal — My Cases
 *
 * Shows the client's active immigration cases with progress tracking.
 */
export const dynamic = 'force-dynamic'

const stages = ['Intake', 'Eligibility', 'KYC/AML', 'Documents', 'Application', 'Submitted', 'Review', 'Approved']

function ProgressBar({ currentStage }: { currentStage: number }) {
  return (
    <div className="flex gap-1 mt-3">
      {stages.map((stage, i) => (
        <div key={stage} className="flex-1">
          <div
            className={`h-2 rounded-full ${
              i < currentStage ? 'bg-green-500' :
              i === currentStage ? 'bg-[var(--accent)]' :
              'bg-gray-200'
            }`}
          />
          <p className={`text-[10px] mt-1 ${i <= currentStage ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>
            {stage}
          </p>
        </div>
      ))}
    </div>
  )
}

export default async function MyCasesPage() {
  // TODO: Replace with real client-scoped query
  const cases = [
    {
      id: 'c-001',
      program: 'Malta Permanent Residence Programme',
      country: 'MT',
      stage: 3,
      advisor: 'Sarah Nkemelu',
      lastUpdate: '2026-03-09',
      nextAction: 'Upload certified bank statements',
    },
    {
      id: 'c-002',
      program: 'Portugal Golden Visa',
      country: 'PT',
      stage: 1,
      advisor: 'David Kimani',
      lastUpdate: '2026-03-07',
      nextAction: 'Complete eligibility questionnaire',
    },
  ]

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Cases</h1>
        <p className="text-gray-500 mt-1">Track progress on your immigration applications</p>
      </div>

      <div className="space-y-6">
        {cases.map((c) => (
          <div key={c.id} className="bg-white border border-[var(--border)] rounded-xl p-6">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{c.program}</h3>
                <p className="text-sm text-gray-500">Advisor: {c.advisor}</p>
              </div>
              <span className="text-sm text-gray-400">{c.country}</span>
            </div>

            <ProgressBar currentStage={c.stage} />

            <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Next action:</span> {c.nextAction}
              </p>
            </div>

            <p className="text-xs text-gray-400 mt-3">Last updated: {c.lastUpdate}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
