import { Suspense } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { CardSkeleton } from '@/components/ui/loading'
import { getPolicyRegressionAnalysis } from '@/server/policy-regression-data'
import { PolicyReplayPanel } from '@/components/governance/policy-replay-panel'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Policy Regression Analysis — Nzila OS Control Plane',
  description: 'Baseline vs candidate policy version behavior drift and risk flags by domain.',
}

async function PolicyRegressionContent() {
  const data = getPolicyRegressionAnalysis('v2', 'v1', 75)

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">Policy regression analysis</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Baseline {data.baselineVersion} vs candidate {data.candidateVersion} over {data.perDomain} cases/domain.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-3 text-sm">
        <div className="rounded border border-border p-3"><span className="text-muted-foreground">Changed decisions</span><p className="text-xl font-semibold text-foreground">{data.totalChangedDecisions}</p></div>
        <div className="rounded border border-border p-3"><span className="text-muted-foreground">Regression rate</span><p className="text-xl font-semibold text-foreground">{(data.overallRegressionRate * 100).toFixed(2)}%</p></div>
        <div className="rounded border border-border p-3"><span className="text-muted-foreground">Risk flag</span><p className="text-xl font-semibold text-foreground">{data.riskFlag}</p></div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-muted-foreground">Domain</th>
              <th className="px-3 py-2 text-right text-muted-foreground">Changed</th>
              <th className="px-3 py-2 text-right text-muted-foreground">Rate</th>
              <th className="px-3 py-2 text-left text-muted-foreground">Risk</th>
              <th className="px-3 py-2 text-left text-muted-foreground">Baseline</th>
              <th className="px-3 py-2 text-left text-muted-foreground">Candidate</th>
            </tr>
          </thead>
          <tbody>
            {data.domains.map((row) => (
              <tr key={row.domain} className="border-b border-border">
                <td className="px-3 py-2">{row.domain}</td>
                <td className="px-3 py-2 text-right">{row.changedDecisions}</td>
                <td className="px-3 py-2 text-right">{(row.regressionRate * 100).toFixed(2)}%</td>
                <td className="px-3 py-2">{row.riskFlag}</td>
                <td className="px-3 py-2 font-mono text-xs">A:{row.baselineDecisionDistribution.ALLOW} W:{row.baselineDecisionDistribution.WARN} C:{row.baselineDecisionDistribution.CHALLENGE} B:{row.baselineDecisionDistribution.BLOCK}</td>
                <td className="px-3 py-2 font-mono text-xs">A:{row.candidateDecisionDistribution.ALLOW} W:{row.candidateDecisionDistribution.WARN} C:{row.candidateDecisionDistribution.CHALLENGE} B:{row.candidateDecisionDistribution.BLOCK}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function PolicyRegressionPage() {
  return (
    <>
      <PageHeader
        title="Policy Regression Analysis"
        description="Behavior drift between policy versions with domain-level risk flags."
      />
      <Suspense fallback={<CardSkeleton count={2} />}>
        <PolicyRegressionContent />
      </Suspense>
      <div className="mt-6">
        <PolicyReplayPanel />
      </div>
    </>
  )
}
