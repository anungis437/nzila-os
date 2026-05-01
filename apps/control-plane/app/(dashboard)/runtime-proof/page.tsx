import { Suspense } from 'react'
import { ShieldCheck, AlertTriangle, Activity, CheckCircle2, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { SummaryCard } from '@/components/ui/summary-card'
import { CardSkeleton } from '@/components/ui/loading'
import { getRuntimeProofData } from '@/server/runtime-proof-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Runtime Proof — Nzila OS Control Plane',
  description: 'Scored, validated runtime evidence: release, deploy, health, drift, restore, security, and seal dimensions.',
}

function GradeBadge({ grade }: { grade: string }) {
  const colours: Record<string, string> = {
    A: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    B: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    C: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    D: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    F: 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100',
  }
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-sm font-bold ${colours[grade] ?? colours['F']}`}>
      {grade}
    </span>
  )
}

function StatusDot({ status }: { status: string }) {
  const cls =
    status === 'healthy' ? 'bg-emerald-500'
    : status === 'degraded' ? 'bg-yellow-500'
    : status === 'critical' ? 'bg-red-500'
    : 'bg-muted-foreground'
  return <span className={`inline-block h-2 w-2 rounded-full ${cls}`} />
}

async function RuntimeProofContent() {
  const proof = await getRuntimeProofData()

  if (!proof) {
    return (
      <section className="rounded-lg border border-border bg-card p-8 text-center">
        <XCircle className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
        <h2 className="text-base font-semibold text-foreground">No proof data available</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Run <code className="rounded bg-muted px-1 py-0.5 text-xs">pnpm proof:runtime</code> to generate a runtime proof document.
        </p>
      </section>
    )
  }

  const healthColour =
    proof.overallHealth === 'healthy' ? 'text-emerald-600'
    : proof.overallHealth === 'degraded' ? 'text-yellow-600'
    : 'text-red-600'

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Score"
          icon={<Activity className="h-5 w-5" />}
          value={`${proof.score} / 100`}
          subtitle={`Period: ${proof.period}`}
        />
        <SummaryCard
          title="Grade"
          icon={<ShieldCheck className="h-5 w-5" />}
          value={proof.grade}
          subtitle={proof.bootstrapSources.length > 0 ? 'Bootstrap cap active' : 'No bootstrap cap'}
        />
        <SummaryCard
          title="Blocking Findings"
          icon={<XCircle className="h-5 w-5" />}
          value={proof.blockingFindings.length}
          subtitle={proof.blockingFindings.length > 0 ? 'Must resolve' : 'None'}
        />
        <SummaryCard
          title="Advisory Findings"
          icon={<AlertTriangle className="h-5 w-5" />}
          value={proof.advisoryFindings.length}
          subtitle="Non-blocking"
        />
      </div>

      {/* Overall status */}
      <section className="rounded-lg border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <GradeBadge grade={proof.grade} />
          <span className={`text-sm font-medium ${healthColour}`}>{proof.overallHealth}</span>
          <span className="text-xs text-muted-foreground">Proof ID: {proof.proofId}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date(proof.timestamp).toLocaleString()}
          </span>
        </div>
        {proof.bootstrapSources.length > 0 && (
          <p className="mt-3 rounded bg-yellow-50 px-3 py-2 text-xs text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200">
            ⚠ Bootstrap cap: grade A → B because bootstrap sources were used for:{' '}
            {proof.bootstrapSources.join(', ')}
          </p>
        )}
      </section>

      {/* Scoring breakdown */}
      <section className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Scoring Breakdown</h2>
        <p className="mt-1 text-sm text-muted-foreground">7 dimensions — total weight 100 pts.</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left text-muted-foreground">Dimension</th>
                <th className="px-3 py-2 text-right text-muted-foreground">Weight</th>
                <th className="px-3 py-2 text-right text-muted-foreground">Earned</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Rationale</th>
                <th className="px-3 py-2 text-left text-muted-foreground">Bootstrap</th>
              </tr>
            </thead>
            <tbody>
              {proof.scoringBreakdown.map((d) => (
                <tr key={d.dimension} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground capitalize">{d.dimension}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{d.weight}</td>
                  <td className="px-3 py-2 text-right font-semibold text-foreground">
                    <span className={d.earned === 0 ? 'text-red-500' : d.earned < d.weight ? 'text-yellow-500' : 'text-emerald-600'}>
                      {d.earned}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{d.rationale}</td>
                  <td className="px-3 py-2">
                    {d.bootstrapEvidence && (
                      <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">bootstrap</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Findings */}
      {(proof.blockingFindings.length > 0 || proof.advisoryFindings.length > 0) && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">Findings</h2>
          {proof.blockingFindings.length > 0 && (
            <div className="mt-3">
              <h3 className="mb-2 text-sm font-medium text-red-600">Blocking</h3>
              <ul className="space-y-1">
                {proof.blockingFindings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {proof.advisoryFindings.length > 0 && (
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-medium text-yellow-600">Advisory</h3>
              <ul className="space-y-1">
                {proof.advisoryFindings.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-yellow-500" />
                    <span className="text-foreground">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Next required evidence */}
      {proof.nextRequiredEvidence.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">Next Required Evidence</h2>
          <p className="mt-1 text-sm text-muted-foreground">Actions needed to improve the proof score.</p>
          <ul className="mt-3 space-y-2">
            {proof.nextRequiredEvidence.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="text-foreground">{e}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Metrics table */}
      {proof.metrics.length > 0 && (
        <section className="rounded-lg border border-border bg-card p-5">
          <h2 className="text-base font-semibold text-foreground">Collected Metrics</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-3 py-2 text-left text-muted-foreground">Metric</th>
                  <th className="px-3 py-2 text-right text-muted-foreground">Value</th>
                  <th className="px-3 py-2 text-left text-muted-foreground">Unit</th>
                  <th className="px-3 py-2 text-left text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {proof.metrics.map((m) => (
                  <tr key={m.name} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono text-xs text-foreground">{m.name}</td>
                    <td className="px-3 py-2 text-right text-foreground">{m.value ?? '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{m.unit || '—'}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1.5">
                        <StatusDot status={m.status} />
                        <span className="text-muted-foreground">{m.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

export default function RuntimeProofPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Runtime Proof"
        description="Scored, validated evidence across release, deploy, health, drift, restore, security, and seal dimensions."
      />
      <Suspense fallback={<CardSkeleton />}>
        <RuntimeProofContent />
      </Suspense>
    </div>
  )
}
