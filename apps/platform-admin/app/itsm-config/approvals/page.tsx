import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'

export const dynamic = 'force-dynamic'

const APPROVAL_CHAIN_EXAMPLES = [
  {
    name: 'Standard Change',
    steps: ['Change Manager Review', 'CAB Approval'],
    trigger: 'change_request — standard',
  },
  {
    name: 'Emergency Change',
    steps: ['Emergency CAB (e-CAB)', 'CISO Sign-off'],
    trigger: 'change_request — emergency',
  },
  {
    name: 'Procurement > $5k',
    steps: ['Department Head', 'CFO Approval'],
    trigger: 'procurement — above_threshold',
  },
]

export default async function ApprovalsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Approval Workflows</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure multi-step approval chains for changes, procurement, and escalations.
          </p>
        </div>
        <Link
          href="/itsm-config"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← Back to ITSM Config
        </Link>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Chains', value: '3' },
          { label: 'Pending Approvals', value: '0' },
          { label: 'Avg. Cycle Time', value: '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="text-2xl font-semibold text-gray-900 mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Approval chains */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700">Approval Chains</h2>
          <button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700">
            + New Chain
          </button>
        </div>
        <div className="space-y-3">
          {APPROVAL_CHAIN_EXAMPLES.map((chain) => (
            <div
              key={chain.name}
              className="rounded-lg border border-gray-200 bg-white p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-gray-900 text-sm">{chain.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Trigger: {chain.trigger}</p>
                </div>
                <button className="text-xs text-blue-600 hover:underline">Edit</button>
              </div>
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                {chain.steps.map((step, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-700">
                      {i + 1}. {step}
                    </span>
                    {i < chain.steps.length - 1 && (
                      <span className="text-gray-400 text-xs">→</span>
                    )}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Approval records stored in <code className="font-mono">itsm_approvals</code> table.
        DB-backed dynamic chains available in a future release.
      </p>
    </div>
  )
}
