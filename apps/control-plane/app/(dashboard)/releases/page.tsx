import { Suspense } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { CardSkeleton } from '@/components/ui/loading'
import { getReleaseDashboardData } from '@/server/release-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Releases — Nzila OS Control Plane',
  description: 'Industrial release governance with semver discipline, promotion gates, and rollback readiness.',
}

async function ReleasesContent() {
  const data = await getReleaseDashboardData()

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">Release governance status</h2>
      <dl className="mt-4 grid gap-3 md:grid-cols-2 text-sm">
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Current version</dt><dd className="font-mono text-xs">{data.version}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Commit</dt><dd className="font-mono text-xs">{data.commit}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Last deployment</dt><dd>{data.lastDeploymentAt}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Rollback availability</dt><dd>{data.rollbackAvailable ? 'available' : 'not available'}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Semver compliance</dt><dd>{data.semverCompliant ? 'compliant' : 'violation'}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Staging gate</dt><dd>{data.stagingGate}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Production approval</dt><dd>{data.productionApproval}</dd></div>
      </dl>
    </section>
  )
}

export default function ReleasesPage() {
  return (
    <>
      <PageHeader
        title="Releases"
        description="Current version, deployment history, promotion gates, and rollback readiness."
      />
      <Suspense fallback={<CardSkeleton count={2} />}>
        <ReleasesContent />
      </Suspense>
    </>
  )
}
