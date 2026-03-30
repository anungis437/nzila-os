import {
  AcademicCapIcon,
  CheckBadgeIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import { getCertProgress } from '@/lib/actions/certification-actions'

type TrackStatus = 'not-started' | 'in-progress' | 'completed'

const badges: Record<string, string> = {
  fundamentals: '🎯',
  'sales-essentials': '💼',
  'vertical-specialist': '🏦',
  'advanced-architecture': '🏗️',
  'co-sell-mastery': '🤝',
  'partner-leadership': '🌟',
}

function statusIcon(status: TrackStatus) {
  switch (status) {
    case 'completed':
      return <CheckBadgeIcon className="w-5 h-5 text-green-600" />
    case 'in-progress':
      return <PlayIcon className="w-5 h-5 text-blue-600" />
    default:
      return <AcademicCapIcon className="w-5 h-5 text-slate-400" />
  }
}

function statusLabel(status: TrackStatus) {
  switch (status) {
    case 'completed':
      return <span className="text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">Completed</span>
    case 'in-progress':
      return <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">In Progress</span>
    default:
      return <span className="text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-full">Not Started</span>
  }
}

export default async function CertificationsPage() {
  const progress = await getCertProgress()
  const tracks = progress.tracks

  const completedCount = tracks.filter((t) => t.status === 'completed').length
  const totalModules = tracks.reduce((a, t) => a + t.modules, 0)
  const completedModules = tracks.reduce((a, t) => a + t.completedModules, 0)

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Certifications</h1>
          <p className="mt-1 text-sm text-slate-500">
            Complete learning tracks to earn badges, unlock tier advancement, and specialise.
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-slate-900">{completedCount} / {tracks.length}</p>
          <p className="text-xs text-slate-500">Tracks completed</p>
        </div>
      </div>

      {/* Overall progress */}
      <div className="mt-6 bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Overall Certification Progress</span>
          <span className="text-sm font-bold text-slate-900">
            {completedModules} / {totalModules} modules
          </span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all"
            style={{
              width: `${totalModules > 0 ? (completedModules / totalModules) * 100 : 0}%`,
            }}
          />
        </div>
      </div>

      {/* Track grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {tracks.map((track) => {
          const pct = track.modules > 0 ? Math.round((track.completedModules / track.modules) * 100) : 0
          return (
            <div
              key={track.id}
              className={`bg-white rounded-xl border p-5 transition ${
                track.status === 'not-started'
                  ? 'border-slate-100 opacity-60'
                  : 'border-slate-200 hover:shadow-sm cursor-pointer'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{badges[track.id] ?? '📘'}</span>
                  {statusIcon(track.status)}
                </div>
                {statusLabel(track.status)}
              </div>

              <h3 className="mt-3 font-semibold text-slate-900">{track.name}</h3>

              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-500">{track.completedModules} / {track.modules} modules</span>
                  <span className="text-slate-400">{pct}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
