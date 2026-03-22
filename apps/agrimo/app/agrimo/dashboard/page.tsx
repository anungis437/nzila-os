import { listProducers, listHarvests, listLots, listBatches, listShipments, listPayments } from '@/lib/actions'

export default async function DashboardPage() {
  const [producers, harvests, lots, batches, shipments, payments] = await Promise.all([
    listProducers(),
    listHarvests(),
    listLots(),
    listBatches(),
    listShipments(),
    listPayments(),
  ])

  const kpis = [
    { label: 'Producers', value: producers.data?.producers.length ?? 0, href: '/agrimo/producers' },
    { label: 'Harvests', value: harvests.data?.harvests.length ?? 0, href: '/agrimo/harvests' },
    { label: 'Lots', value: lots.data?.lots.length ?? 0, href: '/agrimo/lots' },
    { label: 'Batches', value: batches.data?.batches.length ?? 0, href: '/agrimo/warehouse' },
    { label: 'Shipments', value: shipments.data?.shipments.length ?? 0, href: '/agrimo/shipments' },
    { label: 'Payments', value: payments.data?.payments.length ?? 0, href: '/agrimo/payments' },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="text-gray-600 mb-6">
        Overview of agricultural operations — producers, harvests, lots, warehousing, and payments.
      </p>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((kpi) => (
          <a
            key={kpi.label}
            href={kpi.href}
            className="rounded-lg border p-4 hover:shadow transition-shadow"
          >
            <p className="text-sm text-gray-500">{kpi.label}</p>
            <p className="text-3xl font-bold">{kpi.value}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
