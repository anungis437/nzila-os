/**
 * Zonga — Moderation Dashboard (Server Component).
 *
 * Operator view for moderation cases, integrity signals, and content review.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import {
  listModerationCases,
  listIntegritySignals,
  getModerationStats,
} from '@/lib/actions/moderation-actions'

function severityBadge(severity: string) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-muted text-muted-foreground',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[severity] ?? colors.low}`}>
      {severity}
    </span>
  )
}

function statusBadge(status: string) {
  const colors: Record<string, string> = {
    open: 'bg-blue-100 text-blue-700',
    under_review: 'bg-purple-100 text-purple-700',
    resolved: 'bg-green-100 text-green-700',
    dismissed: 'bg-muted text-muted-foreground',
    escalated: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] ?? colors.open}`}>
      {status.replace('_', ' ')}
    </span>
  )
}

export default async function ModerationPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [stats, cases, signals] = await Promise.all([
    getModerationStats(),
    listModerationCases(),
    listIntegritySignals({ severity: 'critical' }),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Moderation</h1>
        <p className="text-muted-foreground mt-1">Content review, integrity signals &amp; case management</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Open Cases</p>
            <p className="text-2xl font-bold text-foreground">{stats.openCases}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Pending Review</p>
            <p className="text-2xl font-bold text-orange-600">{stats.pendingReview}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Resolved</p>
            <p className="text-2xl font-bold text-emerald-600">{stats.resolvedCases}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground mb-1">Critical Signals (7d)</p>
            <p className="text-2xl font-bold text-red-600">{stats.criticalSignals}</p>
          </div>
        </Card>
      </div>

      {/* Critical Integrity Signals */}
      {signals.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">Critical Integrity Signals</h2>
          <Card>
            <div className="divide-y divide-gray-50">
              {signals.slice(0, 10).map((s) => (
                <div key={s.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🚨</span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.signalType}</p>
                      <p className="text-xs text-muted-foreground/70">
                        {s.entityType} · {s.explanation ?? 'No details'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {severityBadge(s.severity)}
                    {s.createdAt && (
                      <span className="text-xs text-muted-foreground/70">
                        {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Moderation Cases */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Moderation Cases</h2>
        {cases.length === 0 ? (
          <Card>
            <div className="p-8 text-center">
              <p className="text-muted-foreground text-sm">No moderation cases. Content is clean!</p>
            </div>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border">
                  <tr>
                    <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Type</th>
                    <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Entity</th>
                    <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Severity</th>
                    <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Assigned</th>
                    <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Created</th>
                    <th className="px-5 py-3 text-xs font-medium text-muted-foreground"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {cases.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <td className="px-5 py-3 font-medium text-foreground">
                        <Link href={`moderation/${c.id}`} className="hover:text-electric">
                          {c.caseType}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">
                        {c.entityType}
                        <span className="text-gray-300 mx-1">/</span>
                        <span className="font-mono text-xs">{c.targetEntityId.slice(0, 8)}</span>
                      </td>
                      <td className="px-5 py-3">{severityBadge(c.severity)}</td>
                      <td className="px-5 py-3">{statusBadge(c.status)}</td>
                      <td className="px-5 py-3 text-muted-foreground/70 text-xs">
                        {c.assignedTo ? c.assignedTo.slice(0, 8) + '…' : '—'}
                      </td>
                      <td className="px-5 py-3 text-muted-foreground/70 text-xs">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`moderation/${c.id}`}
                          className="text-xs text-electric hover:underline"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
