/**
 * Mobility OS — Programs Directory
 *
 * Browse and compare investment migration programs.
 * Data sourced from @nzila/mobility-programs catalog.
 */
export const dynamic = 'force-dynamic'

import { PROGRAM_CATALOG } from '@nzila/mobility-programs'

const typeColors: Record<string, string> = {
  citizenship_by_investment: 'bg-emerald-100 text-emerald-700',
  residency_by_investment: 'bg-blue-100 text-blue-700',
  golden_visa: 'bg-amber-100 text-amber-800',
  digital_nomad: 'bg-purple-100 text-purple-700',
  startup_visa: 'bg-cyan-100 text-cyan-700',
  retirement: 'bg-pink-100 text-pink-700',
}

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount)
}

export default async function ProgramsPage() {
  const programs = PROGRAM_CATALOG

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Programs</h1>
        <p className="text-gray-500 mt-1">Investment migration program directory</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {programs.map((program) => (
          <div
            key={program.countryCode}
            className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-sm transition"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">{program.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{program.countryCode}</p>
              </div>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${typeColors[program.programType] ?? 'bg-gray-100 text-gray-600'}`}>
                {program.programType.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Min. investment</span>
                <span className="font-medium text-gray-900">
                  {formatCurrency(program.minimumInvestment, program.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Processing</span>
                <span className="text-gray-700">{program.processingTimeDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Investment types</span>
                <span className="text-gray-700">{program.investmentTypes.length} options</span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex flex-wrap gap-1">
                {program.requiredDocuments.slice(0, 3).map((doc) => (
                  <span key={doc} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
                    {doc.replace(/_/g, ' ')}
                  </span>
                ))}
                {program.requiredDocuments.length > 3 && (
                  <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
                    +{program.requiredDocuments.length - 3} more
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
