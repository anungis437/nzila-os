import Link from 'next/link'
import {
  PlusIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { listDeals, getDealStats } from '@/lib/actions/deal-actions'

const stages = [
  { id: 'registered', label: 'Registered', color: 'bg-slate-100 text-slate-700' },
  { id: 'submitted', label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  { id: 'approved', label: 'Approved', color: 'bg-amber-100 text-amber-700' },
  { id: 'won', label: 'Won', color: 'bg-green-100 text-green-700' },
]

export default async function DealsPage() {
  const [{ deals }, stats] = await Promise.all([listDeals(), getDealStats()])

  // Group deals by stage
  const dealsByStage = Object.fromEntries(
    stages.map((s) => [s.id, deals.filter((d) => d.stage === s.id)])
  )

  const stageCounts: Record<string, number> = {
    registered: stats.registered,
    submitted: stats.submitted,
    approved: stats.approved,
    won: stats.won,
  }

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Deal Registration</h1>
          <p className="mt-1 text-sm text-slate-500">
            Register, track, and manage your partnership deals through every stage.
          </p>
        </div>
        <Link
          href="/portal/deals/new"
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition shadow-sm"
        >
          <PlusIcon className="w-4 h-4" />
          Register Deal
        </Link>
      </div>

      {/* Pipeline stages */}
      <div className="flex gap-2 mt-6">
        {stages.map((s) => (
          <span
            key={s.id}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${s.color}`}
          >
            {s.label} ({stageCounts[s.id] ?? 0})
          </span>
        ))}
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        {stages.map((stage) => (
          <div key={stage.id} className="bg-white rounded-xl border border-slate-200 p-4 min-h-80">
            <div className="flex items-center justify-between mb-4">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${stage.color}`}>
                {stage.label}
              </span>
              <span className="text-xs text-slate-400">{dealsByStage[stage.id]?.length ?? 0}</span>
            </div>

            {(dealsByStage[stage.id] ?? []).length > 0 ? (
              <div className="space-y-2">
                {(dealsByStage[stage.id] ?? []).map((deal) => (
                  <div key={deal.id} className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm font-medium text-slate-900">{deal.accountName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{deal.vertical}</p>
                    <p className="text-xs font-medium text-blue-600 mt-1">
                      ${Number(deal.estimatedArr).toLocaleString()} ARR
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                  <FunnelIcon className="w-4 h-4 text-slate-300" />
                </div>
                <p className="text-xs text-slate-400">No deals in this stage</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Deal protection notice */}
      <div className="mt-6 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <p className="text-sm text-blue-800 font-medium">Deal Protection Active</p>
        <p className="text-xs text-blue-600 mt-1">
          Registered deals are locked for 90 days, preventing duplicate registrations
          from other partners. Your pipeline is protected.
        </p>
      </div>
    </div>
  )
}
