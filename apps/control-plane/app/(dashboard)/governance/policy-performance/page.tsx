import { Suspense } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { CardSkeleton } from '@/components/ui/loading'
import { getPolicyPerformance } from '@/server/policy-performance-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Policy Performance — Nzila OS Control Plane',
  description: 'Stress test quality across domains with false-positive and false-negative tracking.',
}

async function PolicyPerformanceContent() {
  const data = getPolicyPerformance(75)

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">Policy stress test performance</h2>
      <p className="mt-1 text-sm text-muted-foreground">50-100 edge cases per domain with block/allow/override expectation matching.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-muted-foreground">Domain</th>
              <th className="px-3 py-2 text-right text-muted-foreground">Cases</th>
              <th className="px-3 py-2 text-right text-muted-foreground">Allow</th>
              <th className="px-3 py-2 text-right text-muted-foreground">Warn</th>
              <th className="px-3 py-2 text-right text-muted-foreground">Challenge</th>
              <th className="px-3 py-2 text-right text-muted-foreground">Block</th>
              <th className="px-3 py-2 text-right text-muted-foreground">Override</th>
              <th className="px-3 py-2 text-right text-muted-foreground">Override rate</th>
              <th className="px-3 py-2 text-right text-muted-foreground">False +</th>
              <th className="px-3 py-2 text-right text-muted-foreground">False -</th>
              <th className="px-3 py-2 text-right text-muted-foreground">Accuracy</th>
            </tr>
          </thead>
          <tbody>
            {data.domains.map((row) => (
              <tr key={row.domain} className="border-b border-border">
                <td className="px-3 py-2">{row.domain}</td>
                <td className="px-3 py-2 text-right">{row.totalCases}</td>
                <td className="px-3 py-2 text-right">{row.allowCount}</td>
                <td className="px-3 py-2 text-right">{row.warnCount}</td>
                <td className="px-3 py-2 text-right">{row.challengeCount}</td>
                <td className="px-3 py-2 text-right">{row.blockCount}</td>
                <td className="px-3 py-2 text-right">{row.overrideCount}</td>
                <td className="px-3 py-2 text-right">{(row.overrideRate * 100).toFixed(2)}%</td>
                <td className="px-3 py-2 text-right">{row.falsePositives}</td>
                <td className="px-3 py-2 text-right">{row.falseNegatives}</td>
                <td className="px-3 py-2 text-right">{(row.accuracy * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Overall accuracy: {(data.totals.accuracy * 100).toFixed(2)}% · false positives: {data.totals.falsePositives} · false negatives: {data.totals.falseNegatives}
      </p>
    </section>
  )
}

export default function PolicyPerformancePage() {
  return (
    <>
      <PageHeader
        title="Policy Performance"
        description="Stress-tested correctness profile for domain policy decisions."
      />
      <Suspense fallback={<CardSkeleton count={2} />}>
        <PolicyPerformanceContent />
      </Suspense>
    </>
  )
}
