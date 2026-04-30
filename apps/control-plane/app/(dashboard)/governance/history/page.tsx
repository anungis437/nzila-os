import { Suspense } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { CardSkeleton } from '@/components/ui/loading'
import { getOperatingEvidenceDashboard } from '@/server/operating-evidence-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Governance History — Nzila OS Control Plane',
  description: 'Longitudinal governance retention with sealed daily snapshots, drift detection, and integrity score trends.',
}

async function GovernanceHistoryContent() {
  const data = await getOperatingEvidenceDashboard(90)

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">90-day governance history</h2>
      <p className="mt-1 text-sm text-muted-foreground">Daily compliance state with drift/anomaly markers and integrity trend evidence.</p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="px-3 py-2 text-left text-muted-foreground">Day</th>
              <th className="px-3 py-2 text-right text-muted-foreground">Integrity Score</th>
              <th className="px-3 py-2 text-left text-muted-foreground">Compliance</th>
              <th className="px-3 py-2 text-left text-muted-foreground">Drift</th>
              <th className="px-3 py-2 text-left text-muted-foreground">Anomalies</th>
              <th className="px-3 py-2 text-left text-muted-foreground">Sealed</th>
            </tr>
          </thead>
          <tbody>
            {data.integrityHistory.length === 0 ? (
              <tr>
                <td className="px-3 py-6 text-muted-foreground" colSpan={6}>
                  No daily snapshots yet. Trigger `/api/control-plane/ops/evidence/export` to seal the first daily snapshot.
                </td>
              </tr>
            ) : (
              data.integrityHistory.map((entry) => (
                <tr key={entry.day} className="border-b border-border">
                  <td className="px-3 py-2 font-mono text-xs">{entry.day}</td>
                  <td className="px-3 py-2 text-right">{entry.integrityScore}</td>
                  <td className="px-3 py-2">{entry.complianceStatus}</td>
                  <td className="px-3 py-2">{entry.driftDetected ? 'drift' : 'stable'}</td>
                  <td className="px-3 py-2">{entry.anomalyFlags.join(', ') || 'none'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{entry.hmac.slice(0, 16)}…</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default function GovernanceHistoryPage() {
  return (
    <>
      <PageHeader
        title="Governance History"
        description="90-day retention with daily sealed evidence snapshots, drift detection, and integrity scoring."
      />
      <Suspense fallback={<CardSkeleton count={2} />}>
        <GovernanceHistoryContent />
      </Suspense>
    </>
  )
}
