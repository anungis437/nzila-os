import { Suspense } from 'react'

import { PageHeader } from '@/components/ui/page-header'
import { CardSkeleton, TableSkeleton } from '@/components/ui/loading'
import { StatusBadge } from '@/components/ui/status-badge'
import { getAiGovernanceEvidenceSummary, getAiOperatingDashboard } from '@/server/ai-governance-data'
import type { MonthlyGovernanceArtifact } from '@nzila/platform-evidence-pack'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'AI Ops - Nzila OS Control Plane',
  description:
    'Operating intelligence for AI cost, performance, quality, incidents, queue pressure, and immutable monthly governance evidence.',
}

function fmtPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

function fmtUsd(value: number | null): string {
  if (value === null) return '-'
  return `$${value.toFixed(2)}`
}

async function AiOpsContent() {
  const [dashboard, evidence] = await Promise.all([
    getAiOperatingDashboard(30),
    getAiGovernanceEvidenceSummary(30),
  ])

  const appMetrics = Object.values(dashboard.metrics.byApp).sort((a, b) => b.cost.tokenSpendUsd - a.cost.tokenSpendUsd)

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Data mode</p>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge
              status={dashboard.state === 'live' ? 'healthy' : dashboard.state === 'demo' ? 'degraded' : 'failed'}
              label={dashboard.state}
            />
            {dashboard.errorMessage ? (
              <span className="text-xs text-amber-600 dark:text-amber-400">{dashboard.errorMessage}</span>
            ) : null}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Live-first telemetry from AI requests and actions, with deterministic fallback when no events exist.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Immutable evidence digest</p>
          <p className="mt-2 text-sm font-mono text-foreground break-all">{evidence.monthlyPack.immutableDigest}</p>
          <p className="mt-3 text-xs text-muted-foreground">Pack ID: {evidence.monthlyPack.packId}</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Trend windows</p>
          <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
            <div className="rounded border border-border p-2">
              <p className="text-muted-foreground">3m spend</p>
              <p className="font-semibold">{fmtUsd(evidence.trendSummary.window3m.avgSpendUsd)}</p>
            </div>
            <div className="rounded border border-border p-2">
              <p className="text-muted-foreground">6m incidents</p>
              <p className="font-semibold">{evidence.trendSummary.window6m.totalIncidents}</p>
            </div>
            <div className="rounded border border-border p-2">
              <p className="text-muted-foreground">12m blocked</p>
              <p className="font-semibold">{evidence.trendSummary.window12m.totalBlockedActions}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Per-app AI operating intelligence</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Cost, performance, quality and operations metrics for UNION EYES, FLOW, ZONGA, CFO, ABR, PARTNERS, and EXAMS.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 px-3 text-left font-medium text-muted-foreground">App</th>
                <th className="py-3 px-3 text-right font-medium text-muted-foreground">Spend</th>
                <th className="py-3 px-3 text-right font-medium text-muted-foreground">P95</th>
                <th className="py-3 px-3 text-right font-medium text-muted-foreground">Timeout</th>
                <th className="py-3 px-3 text-right font-medium text-muted-foreground">Approval</th>
                <th className="py-3 px-3 text-right font-medium text-muted-foreground">Override</th>
                <th className="py-3 px-3 text-right font-medium text-muted-foreground">Rejection</th>
                <th className="py-3 px-3 text-right font-medium text-muted-foreground">Evidence%</th>
                <th className="py-3 px-3 text-right font-medium text-muted-foreground">Queue max</th>
              </tr>
            </thead>
            <tbody>
              {appMetrics.map((app) => (
                <tr key={app.appKey} className="border-b border-border">
                  <td className="py-3 px-3 text-foreground font-medium">{app.appKey}</td>
                  <td className="py-3 px-3 text-right text-foreground">{fmtUsd(app.cost.tokenSpendUsd)}</td>
                  <td className="py-3 px-3 text-right text-foreground">{app.performance.p95LatencyMs}ms</td>
                  <td className="py-3 px-3 text-right text-foreground">{fmtPercent(app.performance.timeoutPct)}</td>
                  <td className="py-3 px-3 text-right text-foreground">{fmtPercent(app.quality.approvalRatePct)}</td>
                  <td className="py-3 px-3 text-right text-foreground">{fmtPercent(app.quality.overrideRatePct)}</td>
                  <td className="py-3 px-3 text-right text-foreground">{fmtPercent(app.quality.rejectionRatePct)}</td>
                  <td className="py-3 px-3 text-right text-foreground">{fmtPercent(app.quality.evidenceAttachedPct)}</td>
                  <td className="py-3 px-3 text-right text-foreground">
                    {Object.values(app.operations.queueBacklog).reduce((max, value) => Math.max(max, value), 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Monthly governance artifacts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Immutable artifact hashes and retention-class evidence pointers for diligence and board reporting.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 px-3 text-left font-medium text-muted-foreground">Artifact</th>
                <th className="py-3 px-3 text-left font-medium text-muted-foreground">Hash</th>
              </tr>
            </thead>
            <tbody>
              {evidence.monthlyPack.artifacts.map((artifact: MonthlyGovernanceArtifact) => (
                <tr key={artifact.artifactId} className="border-b border-border">
                  <td className="py-3 px-3 text-foreground">{artifact.name}</td>
                  <td className="py-3 px-3 text-foreground font-mono text-xs break-all">{artifact.sha256}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default function AiOpsPage() {
  return (
    <>
      <PageHeader
        title="AI Operating Intelligence"
        description="Cost, performance, quality, ops pressure, and immutable monthly governance evidence across all core apps."
      />
      <Suspense
        fallback={
          <>
            <CardSkeleton count={3} />
            <TableSkeleton rows={7} />
          </>
        }
      >
        <AiOpsContent />
      </Suspense>
    </>
  )
}
