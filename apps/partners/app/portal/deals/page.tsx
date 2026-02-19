import Link from 'next/link'
import {
  PlusIcon,
  FunnelIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

const stages = [
  { id: 'registered', label: 'Registered', color: 'bg-slate-100 text-slate-700' },
  { id: 'submitted', label: 'Submitted', color: 'bg-blue-100 text-blue-700' },
  { id: 'approved', label: 'Approved', color: 'bg-amber-100 text-amber-700' },
  { id: 'won', label: 'Won', color: 'bg-green-100 text-green-700' },
  { id: 'lost', label: 'Lost', color: 'bg-red-100 text-red-700' },
]

export default function DealsPage() {
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

      {/* Filters bar */}
      <div className="mt-6 flex items-center gap-3">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search deals by account name, vertical, or ID…"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50 transition">
          <FunnelIcon className="w-4 h-4" />
          Filters
        </button>
      </div>

      {/* Pipeline stages */}
      <div className="flex gap-2 mt-4">
        {stages.map((s) => (
          <button
            key={s.id}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${s.color} hover:opacity-80 transition`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        {stages.filter((s) => s.id !== 'lost').map((stage) => (
          <div key={stage.id} className="bg-white rounded-xl border border-slate-200 p-4 min-h-[320px]">
            <div className="flex items-center justify-between mb-4">
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${stage.color}`}>
                {stage.label}
              </span>
              <span className="text-xs text-slate-400">0</span>
            </div>

            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center mb-2">
                <FunnelIcon className="w-4 h-4 text-slate-300" />
              </div>
              <p className="text-xs text-slate-400">No deals in this stage</p>
            </div>
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
