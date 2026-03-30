import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default function TradeDashboard() {
  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="text-3xl font-bold mb-8">Trade Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Active Deals" value="—" href="/trade/deals" />
        <StatCard title="Listings" value="—" href="/trade/listings" />
        <StatCard title="In Transit" value="—" href="/trade/shipments" />
        <StatCard title="Commissions Due" value="—" href="/trade/commissions" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-4">Recent Deals</h2>
          <p className="text-gray-500 text-sm">No deals yet. Create your first deal to get started.</p>
        </section>

        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-4">Pending Actions</h2>
          <p className="text-gray-500 text-sm">No pending actions.</p>
        </section>
      </div>
    </main>
  )
}

function StatCard({
  title,
  value,
  href,
}: {
  title: string
  value: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </Link>
  )
}
