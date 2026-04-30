import { Suspense } from 'react'
import { PageHeader } from '@/components/ui/page-header'
import { CardSkeleton } from '@/components/ui/loading'
import { getSimulatedEconomics } from '@/server/simulated-economics-data'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Simulated Economics — Nzila OS Control Plane',
  description: 'Synthetic commercial realism: CAC proxy, LTV proxy, expansion indicators, and customer conversion signals.',
}

async function SimulatedEconomicsContent() {
  const data = await getSimulatedEconomics(120)

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">Simulated economics</h2>
      <p className="mt-1 text-sm text-muted-foreground">100-org model with realistic funnel and expansion behavior.</p>
      <dl className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3 text-sm">
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Organizations</dt><dd className="text-xl font-semibold text-foreground">{data.orgCount}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Customer orgs</dt><dd className="text-xl font-semibold text-foreground">{data.customerOrgs}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">Acquisition spend</dt><dd className="text-xl font-semibold text-foreground">${data.acquisitionSpend.toLocaleString()}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">MRR proxy</dt><dd className="text-xl font-semibold text-foreground">${data.monthlyRecurringRevenue.toLocaleString()}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">CAC proxy</dt><dd className="text-xl font-semibold text-foreground">${data.cacProxy.toLocaleString()}</dd></div>
        <div className="rounded border border-border p-3"><dt className="text-muted-foreground">LTV proxy</dt><dd className="text-xl font-semibold text-foreground">${data.ltvProxy.toLocaleString()}</dd></div>
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">Expansion signals observed: {data.expansionSignals}</p>
    </section>
  )
}

export default function SimulatedEconomicsPage() {
  return (
    <>
      <PageHeader
        title="Simulated Economics"
        description="Commercial model realism with CAC/LTV proxies and expansion indicators."
      />
      <Suspense fallback={<CardSkeleton count={2} />}>
        <SimulatedEconomicsContent />
      </Suspense>
    </>
  )
}
