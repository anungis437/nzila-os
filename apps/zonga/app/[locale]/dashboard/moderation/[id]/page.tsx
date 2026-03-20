/**
 * Zonga — Moderation Case Detail (Server + Client Components).
 *
 * Full case view with resolve/dismiss actions, assignment,
 * related integrity signals, and entity context.
 */
import { auth } from '@clerk/nextjs/server'
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
    low: 'bg-gray-100 text-gray-600',
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
    dismissed: 'bg-gray-100 text-gray-600',
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
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-navy"
      >
        ← Back to Moderation
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">
            🔒 Case: {modCase.caseType.replace(/_/g, ' ')}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            {severityBadge(modCase.severity)}
            {statusBadge(modCase.status)}
            <span className="text-xs text-gray-400">
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
              <h2 className="mb-3 text-sm font-semibold text-navy">📋 Case Details</h2>
              <dl className="space-y-3 text-sm">
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-gray-500">Case Type</dt>
                  <dd className="col-span-2 font-medium text-navy">
                    {modCase.caseType.replace(/_/g, ' ')}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-gray-500">Entity Type</dt>
                  <dd className="col-span-2 text-navy">{modCase.entityType}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-gray-500">Target Entity</dt>
                  <dd className="col-span-2 font-mono text-xs text-navy">
                    {modCase.targetEntityId}
                  </dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-gray-500">Severity</dt>
                  <dd className="col-span-2">{severityBadge(modCase.severity)}</dd>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-gray-500">Status</dt>
                  <dd className="col-span-2">{statusBadge(modCase.status)}</dd>
                </div>
                {modCase.assignedTo && (
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500">Assigned To</dt>
                    <dd className="col-span-2 font-mono text-xs text-navy">
                      {modCase.assignedTo}
                    </dd>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2">
                  <dt className="text-gray-500">Created</dt>
                  <dd className="col-span-2 text-navy">
                    {modCase.createdAt
                      ? new Date(modCase.createdAt).toLocaleString()
                      : '—'}
                  </dd>
                </div>
                {modCase.resolvedAt && (
                  <div className="grid grid-cols-3 gap-2">
                    <dt className="text-gray-500">Resolved</dt>
                    <dd className="col-span-2 text-navy">
                      {new Date(modCase.resolvedAt).toLocaleString()}
                    </dd>
                  </div>
                )}
              </dl>
              {modCase.notes && (
                <div className="mt-4 rounded-lg bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-navy whitespace-pre-wrap">{modCase.notes}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Related Integrity Signals */}
          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-navy">
                🚨 Related Integrity Signals ({signals.length})
              </h2>
              {signals.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400">
                  No integrity signals for this entity
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {signals.map((s) => (
                    <div key={s.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-navy">
                          {s.signalType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-gray-500">
                          {s.explanation ?? 'No details'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {severityBadge(s.severity)}
                        <span className="text-xs text-gray-400">
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
                <h2 className="mb-3 text-sm font-semibold text-navy">⚡ Actions</h2>
                <ModerationActions caseId={id} currentStatus={modCase.status} />
              </div>
            </Card>
          )}

          {/* Timeline */}
          <Card>
            <div className="p-5">
              <h2 className="mb-3 text-sm font-semibold text-navy">📅 Timeline</h2>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  <span className="text-gray-600">
                    Case opened{' '}
                    {modCase.createdAt
                      ? new Date(modCase.createdAt).toLocaleDateString()
                      : ''}
                  </span>
                </div>
                {modCase.assignedTo && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-500" />
                    <span className="text-gray-600">
                      Assigned to {modCase.assignedTo.slice(0, 8)}…
                    </span>
                  </div>
                )}
                {modCase.resolvedAt && (
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-gray-600">
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
