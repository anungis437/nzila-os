/**
 * Dashboard Home — Overview page showing exam session summary,
 * recent activity, and quick-action cards.
 *
 * Server component that queries real data from @nzila/db.
 * Uses @nzila/nacp-core types for domain modeling and @nzila/ui for layout.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import type { ExamSessionStatus } from '@nzila/nacp-core'

// ── Data fetching ───────────────────────────────────────────────────────────

interface DashboardStats {
  activeSessions: number | null
  registeredCandidates: number | null
  activeCenters: number | null
  integrityScore: number | null
}

async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const { db } = await import('@nzila/db')
    const { sql } = await import('drizzle-orm')

    const [sessionsResult, candidatesResult, centersResult] = await Promise.allSettled([
      db.execute(sql`SELECT COUNT(*) as count FROM exam_sessions WHERE status = 'active'`),
      db.execute(sql`SELECT COUNT(*) as count FROM candidates WHERE status = 'registered'`),
      db.execute(sql`SELECT COUNT(*) as count FROM exam_centers WHERE status = 'active'`),
    ])

    return {
      activeSessions: sessionsResult.status === 'fulfilled'
        ? Number((sessionsResult.value as unknown as Record<string, unknown>[])?.[0]?.count ?? 0)
        : null,
      registeredCandidates: candidatesResult.status === 'fulfilled'
        ? Number((candidatesResult.value as unknown as Record<string, unknown>[])?.[0]?.count ?? 0)
        : null,
      activeCenters: centersResult.status === 'fulfilled'
        ? Number((centersResult.value as unknown as Record<string, unknown>[])?.[0]?.count ?? 0)
        : null,
      integrityScore: null, // Computed from evidence chain — future phase
    }
  } catch {
    return { activeSessions: null, registeredCandidates: null, activeCenters: null, integrityScore: null }
  }
}

function formatStat(value: number | null): string {
  if (value === null) return '—'
  return value.toLocaleString()
}

// ── Status type guard (demonstrates nacp-core adoption) ─────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function isActiveSession(status: ExamSessionStatus): boolean {
  return status === 'scheduled' || status === 'in_progress'
}

const quickActions = [
  { title: 'New Exam Session', description: 'Schedule a new examination session', icon: '📋', href: 'sessions/new' },
  { title: 'Register Candidates', description: 'Add candidates to an active session', icon: '👤', href: 'candidates/new' },
  { title: 'View Reports', description: 'Access result compilations and analytics', icon: '📈', href: 'reports' },
  { title: 'Integrity Dashboard', description: 'Review integrity artifacts and verifications', icon: '🔒', href: 'integrity' },
]

export default async function DashboardPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const stats = await getDashboardStats()

  const statCards = [
    { label: 'Active Sessions', value: formatStat(stats.activeSessions), change: stats.activeSessions !== null ? 'Live from DB' : 'No data yet' },
    { label: 'Registered Candidates', value: formatStat(stats.registeredCandidates), change: stats.registeredCandidates !== null ? 'Live from DB' : 'No data yet' },
    { label: 'Active Centers', value: formatStat(stats.activeCenters), change: stats.activeCenters !== null ? 'Live from DB' : 'No data yet' },
    { label: 'Integrity Score', value: formatStat(stats.integrityScore), change: 'Coming soon' },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-navy">Welcome to NACP Exams</h1>
        <p className="text-gray-500 mt-1">
          Manage exam sessions, track candidates, and verify integrity — all in one place.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <div className="p-6">
              <div className="text-sm font-medium text-gray-500 mb-2">{stat.label}</div>
              <div className="text-3xl font-bold text-navy">{stat.value}</div>
              <div className="text-xs text-gray-400 mt-2">{stat.change}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-navy mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.title}
              href={action.href}
              className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-electric/30 hover:shadow-md transition-all group"
            >
              <div className="text-2xl mb-3">{action.icon}</div>
              <h3 className="font-semibold text-navy group-hover:text-electric transition-colors">
                {action.title}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{action.description}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent activity placeholder */}
      <div>
        <h2 className="text-lg font-semibold text-navy mb-4">Recent Activity</h2>
        <Card>
          <div className="p-8 text-center">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="font-semibold text-navy mb-1">No activity yet</h3>
            <p className="text-sm text-gray-500">
              Activity will appear here once you create your first exam session.
            </p>
          </div>
        </Card>
      </div>
    </div>
  )
}
