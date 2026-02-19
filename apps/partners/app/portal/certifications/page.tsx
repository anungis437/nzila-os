import {
  AcademicCapIcon,
  CheckBadgeIcon,
  LockClosedIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'

type TrackStatus = 'available' | 'locked' | 'in-progress' | 'completed'

interface CertTrack {
  id: string
  title: string
  description: string
  modules: number
  completed: number
  status: TrackStatus
  requiredTier: string | null
  badge: string
}

const tracks: CertTrack[] = [
  {
    id: 'sales-fundamentals',
    title: 'Sales Fundamentals',
    description: 'Master the Nzila value proposition, competitive positioning, and discovery frameworks.',
    modules: 5,
    completed: 0,
    status: 'available',
    requiredTier: null,
    badge: '🎯',
  },
  {
    id: 'technical-integration',
    title: 'Technical Integration',
    description: 'Deep dive into Nzila APIs, webhook patterns, authentication flows, and SDK best practices.',
    modules: 8,
    completed: 0,
    status: 'available',
    requiredTier: null,
    badge: '⚙️',
  },
  {
    id: 'vertical-specialist-finance',
    title: 'Vertical Specialist: Finance',
    description: 'Financial services compliance, use-cases, and deployment patterns specific to fintech.',
    modules: 6,
    completed: 0,
    status: 'locked',
    requiredTier: 'Select',
    badge: '🏦',
  },
  {
    id: 'vertical-specialist-health',
    title: 'Vertical Specialist: Healthcare',
    description: 'HIPAA-compliant deployment, health data integration, and clinical workflow automation.',
    modules: 6,
    completed: 0,
    status: 'locked',
    requiredTier: 'Select',
    badge: '🏥',
  },
  {
    id: 'advanced-architecture',
    title: 'Advanced Architecture',
    description: 'Multi-tenant design, high-availability patterns, and enterprise-grade observability.',
    modules: 10,
    completed: 0,
    status: 'locked',
    requiredTier: 'Premier',
    badge: '🏗️',
  },
  {
    id: 'co-sell-mastery',
    title: 'Co-Sell Mastery',
    description: 'Joint selling methodology, executive engagement, and strategic account planning.',
    modules: 7,
    completed: 0,
    status: 'locked',
    requiredTier: 'Premier',
    badge: '🤝',
  },
]

function statusIcon(status: TrackStatus) {
  switch (status) {
    case 'completed':
      return <CheckBadgeIcon className="w-5 h-5 text-green-600" />
    case 'in-progress':
      return <PlayIcon className="w-5 h-5 text-blue-600" />
    case 'locked':
      return <LockClosedIcon className="w-5 h-5 text-slate-300" />
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
    case 'locked':
      return <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Locked</span>
    default:
      return <span className="text-xs font-medium text-slate-600 bg-slate-50 px-2 py-0.5 rounded-full">Available</span>
  }
}

export default function CertificationsPage() {
  const completedCount = tracks.filter((t) => t.status === 'completed').length

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
            {tracks.reduce((a, t) => a + t.completed, 0)} / {tracks.reduce((a, t) => a + t.modules, 0)} modules
          </span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all"
            style={{
              width: `${(tracks.reduce((a, t) => a + t.completed, 0) / tracks.reduce((a, t) => a + t.modules, 0)) * 100}%`,
            }}
          />
        </div>
      </div>

      {/* Track grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        {tracks.map((track) => (
          <div
            key={track.id}
            className={`bg-white rounded-xl border p-5 transition ${
              track.status === 'locked'
                ? 'border-slate-100 opacity-60'
                : 'border-slate-200 hover:shadow-sm cursor-pointer'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{track.badge}</span>
                {statusIcon(track.status)}
              </div>
              {statusLabel(track.status)}
            </div>

            <h3 className="mt-3 font-semibold text-slate-900">{track.title}</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">{track.description}</p>

            <div className="mt-4">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-500">{track.completed} / {track.modules} modules</span>
                <span className="text-slate-400">{Math.round((track.completed / track.modules) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full"
                  style={{ width: `${(track.completed / track.modules) * 100}%` }}
                />
              </div>
            </div>

            {track.requiredTier && track.status === 'locked' && (
              <p className="mt-3 text-[11px] text-slate-400">
                Requires <span className="font-medium">{track.requiredTier}</span> tier to unlock
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
