/**
 * Zonga — Integrity Page (Server Component).
 *
 * ML-powered content integrity checks: duplicate detection,
 * rights verification, metadata validation, audio fingerprinting.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import { getIntegrityChecks } from '@/lib/actions/release-actions'

export default async function IntegrityPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { checks, summary } = await getIntegrityChecks()

  const severityColors: Record<string, string> = {
    critical: 'bg-red-500/10 text-red-600 border-red-200',
    high: 'bg-orange-500/10 text-orange-600 border-orange-200',
    medium: 'bg-amber-500/10 text-amber-600 border-amber-200',
    low: 'bg-blue-500/10 text-blue-600 border-blue-200',
    info: 'bg-muted text-muted-foreground border-border',
  }

  const severityIcons: Record<string, string> = {
    critical: '🔴',
    high: '🟠',
    medium: '🟡',
    low: '🔵',
    info: 'ℹ️',
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Content Integrity</h1>
        <p className="text-muted-foreground mt-1">
          ML-powered content verification &amp; compliance monitoring
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🛡️</span>
              <p className="text-xs text-muted-foreground">Total Checks</p>
            </div>
            <p className="text-2xl font-bold text-navy">{summary.total ?? 0}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">✅</span>
              <p className="text-xs text-muted-foreground">Passed</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{summary.passed ?? 0}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">⚠️</span>
              <p className="text-xs text-muted-foreground">Flagged</p>
            </div>
            <p className="text-2xl font-bold text-amber-600">{summary.flagged ?? 0}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🔴</span>
              <p className="text-xs text-muted-foreground">Critical</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{summary.critical ?? 0}</p>
          </div>
        </Card>
      </div>

      {/* Health Bar */}
      {summary.total > 0 && (
        <Card>
          <div className="p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-foreground">Integrity Score</p>
              <p className="text-sm font-bold text-emerald-600">
                {Math.round(((summary.passed ?? 0) / summary.total) * 100)}%
              </p>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{
                  width: `${Math.round(((summary.passed ?? 0) / summary.total) * 100)}%`,
                }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Checks List */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">🔍 Integrity Checks</h2>
        {checks.length === 0 ? (
          <Card>
            <div className="p-12 text-center">
              <div className="text-5xl mb-4">🛡️</div>
              <p className="font-semibold text-foreground text-lg">All clear</p>
              <p className="text-muted-foreground text-sm mt-1">
                No integrity issues detected. Content is in good shape.
              </p>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {checks.map((c: { id: string; assetTitle?: string; checkType?: string; severity?: string; message?: string; confidence?: number | null; checkedAt?: string }) => {
              const severity = c.severity ?? 'info'
              const colors = severityColors[severity] ?? severityColors.info
              const icon = severityIcons[severity] ?? 'ℹ️'

              return (
                <Card key={c.id}>
                  <div className={`p-4 border-l-4 rounded-lg ${colors}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <span className="text-xl mt-0.5">{icon}</span>
                        <div>
                          <p className="font-medium text-sm">
                            {c.assetTitle ?? 'Unknown asset'}
                          </p>
                          <p className="text-xs mt-0.5 opacity-80">
                            {c.message ?? 'No details available'}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs opacity-70">
                            <span>Type: {c.checkType ?? '—'}</span>
                            {c.confidence != null && (
                              <span>Confidence: {Math.round(c.confidence * 100)}%</span>
                            )}
                            {c.checkedAt && (
                              <span>
                                Checked: {new Date(c.checkedAt).toLocaleDateString('en-CA')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <span className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
                        {severity}
                      </span>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
