import { redirect } from 'next/navigation'
import { auth } from '@nzila/platform-auth/entra/server'
import { CheckCircleIcon, ExclamationTriangleIcon, PhoneIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

export const dynamic = 'force-dynamic'

const weeklyChecklist = [
  'Review Autopilot approvals and convert remaining top recommendation to action.',
  'Run collections triage and update overdue receivables owner assignments.',
  'Reconcile venture priority ranking with current founder calendar allocation.',
  'Close or re-scope stale initiatives older than 14 days.',
  'Publish board-ready summary sentence for Friday update.',
]

const monthlyChecklist = [
  'Refresh runway assumptions and validate burn sensitivity.',
  'Run operating model truth audit: pipeline, execution, obligations, governance.',
  'Score decision quality from past month and recalibrate confidence discipline.',
  'Review org-level compliance evidence and unresolved risk flags.',
]

const escalationMap = [
  { trigger: 'Runway < 4 months', owner: 'Founder + CFO', action: 'Immediate expense controls and collection acceleration.' },
  { trigger: 'P0 decision overdue > 7 days', owner: 'COO', action: 'Escalate in daily standup and assign hard deadline.' },
  { trigger: 'Data freshness score < 60%', owner: 'Ops Lead', action: 'Restore adapter syncs and audit source timestamp gaps.' },
  { trigger: 'Founder overload > 70%', owner: 'Founder', action: 'Cut low-leverage meetings and enforce deep-work blocks.' },
]

const sourceOfTruth = [
  { area: 'Runway + Capital', source: 'apps/console/lib/finance-spine.ts' },
  { area: 'Executive signals', source: 'apps/console/lib/executive-intelligence.ts' },
  { area: 'Autopilot logic', source: 'apps/console/lib/autopilot-engine.ts' },
  { area: 'Forecast logic', source: 'apps/console/lib/forecast-engine.ts' },
  { area: 'Decision learning', source: 'packages/db/src/schema/executive.ts + decision_scorebacks' },
]

export default async function OperatorPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Operator Mode</h1>
        <p className="text-sm text-gray-500 mt-1">Transferable operating rhythm for weekly and monthly execution continuity.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircleIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Weekly Checklist</h2>
          </div>
          <ol className="space-y-2 text-sm text-gray-700 list-decimal pl-5">
            {weeklyChecklist.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <DocumentTextIcon className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Monthly Checklist</h2>
          </div>
          <ol className="space-y-2 text-sm text-gray-700 list-decimal pl-5">
            {monthlyChecklist.map((item) => <li key={item}>{item}</li>)}
          </ol>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center gap-2 mb-4">
          <PhoneIcon className="h-5 w-5 text-gray-400" />
          <h2 className="font-semibold text-gray-900">Escalation Map</h2>
        </div>
        <div className="space-y-3 text-sm">
          {escalationMap.map((row) => (
            <div key={row.trigger} className="rounded-lg border border-gray-100 px-3 py-2">
              <p className="font-medium text-gray-900">{row.trigger}</p>
              <p className="text-gray-600">Owner: {row.owner}</p>
              <p className="text-gray-600">{row.action}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <ExclamationTriangleIcon className="h-5 w-5 text-amber-700" />
          <h2 className="font-semibold text-amber-900">Source-of-Truth Locations</h2>
        </div>
        <div className="space-y-2 text-sm text-amber-900">
          {sourceOfTruth.map((item) => (
            <p key={item.area}><span className="font-semibold">{item.area}:</span> {item.source}</p>
          ))}
        </div>
      </div>
    </div>
  )
}
