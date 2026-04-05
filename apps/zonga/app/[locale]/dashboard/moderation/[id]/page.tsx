/**
 * Zonga — Moderation Case Detail (Server + Client Components).
 *
 * Full case view with resolve/dismiss actions, assignment,
 * related integrity signals, and entity context.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import {
  getModerationCase,
  listIntegritySignals,
} from '@/lib/actions/moderation-actions'
import { ModerationActions } from './moderation-actions-client'

function severityBadge(severity: string) {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-muted text-muted-foreground',
  }
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${colors[severity] ?? colors.low}`}>
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
    <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${colors[status] ?? colors.open}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

export default async function ModerationCaseDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  const modCase = await getModerationCase(id)
  if (!modCase) notFound()

  // Fetch related integrity signals
  const signals = await listIntegritySignals({
    targetEntityId: modCase.targetEntityId,
  })

  const isOpen = modCase.status === 'open' || modCase.status === 'under_review'

  return (
    <div className="space-y-8">
      <Link
        href="../"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to Moderation
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            🔒 Case: {modCase.caseType.replace(/_/g, ' ')}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            {severityBadge(modCase.severity)}
            {statusBadge(modCase.status)}
            <span className="text-xs text-muted-foreground/70">
              ID: {id.slice(0, 12)}…
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="space-y-6 lg:col-span-2">
          {/* Case Details */}
          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">📋 Case Details</h2>
              <dl className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-muted-foreground">Case Type</dt>
                  <dd className="col-span-2 font-medium text-foreground">
                    {modCase.caseType.replace(/_/g, ' ')}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-muted-foreground">Entity Type</dt>
                  <dd className="col-span-2 text-foreground">{modCase.entityType}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-muted-foreground">Target Entity</dt>
                  <dd className="col-span-2 font-mono text-xs text-foreground">
                    {modCase.targetEntityId}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-muted-foreground">Severity</dt>
                  <dd className="col-span-2">{severityBadge(modCase.severity)}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="col-span-2">{statusBadge(modCase.status)}</dd>
                </div>
                {modCase.assignedTo && (
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-muted-foreground">Assigned To</dt>
                    <dd className="col-span-2 font-mono text-xs text-foreground">
                      {modCase.assignedTo}
                    </dd>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-muted-foreground">Created</dt>
                  <dd className="col-span-2 text-foreground">
                    {modCase.createdAt
                      ? new Date(modCase.createdAt).toLocaleString()
                      : '—'}
                  </dd>
                </div>
                {modCase.resolvedAt && (
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-muted-foreground">Resolved</dt>
                    <dd className="col-span-2 text-foreground">
                      {new Date(modCase.resolvedAt).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
              {modCase.notes && (
                <div className="mt-4 rounded-lg bg-muted p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{modCase.notes}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Related Integrity Signals */}
          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                🚨 Related Integrity Signals ({signals.length})
              </h2>
              {signals.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground/70">
                  No integrity signals for this entity
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {signals.map((s) => (
                    <div key={s.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {s.signalType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.explanation ?? 'No details'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {severityBadge(s.severity)}
                        <span className="text-xs text-muted-foreground/70">
                          {s.createdAt
                            ? new Date(s.createdAt).toLocaleDateString()
                            : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actions */}
          {isOpen && (
            <Card>
              <div className="p-5">
                <h2 className="mb-3 text-sm font-semibold text-foreground">⚡ Actions</h2>
                <ModerationActions caseId={id} currentStatus={modCase.status} />
              </div>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-foreground">📅 Timeline</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">
                    Case opened{' '}
                    {modCase.createdAt
                      ? new Date(modCase.createdAt).toLocaleDateString()
                      : ''}
                  </span>
                </div>
                {modCase.assignedTo && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    <span className="text-muted-foreground">
                      Assigned to {modCase.assignedTo.slice(0, 8)}…
                    </span>
                  </div>
                )}
                {modCase.resolvedAt && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-muted-foreground">
                      {modCase.status === 'dismissed' ? 'Dismissed' : 'Resolved'}{' '}
                      {new Date(modCase.resolvedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
