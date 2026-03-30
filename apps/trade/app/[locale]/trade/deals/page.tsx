import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Deals',
}

/**
 * Deals list — Kanban / table view of all deals in the org.
 * Each deal's stage is FSM-managed.
 */
export default function DealsPage() {
  const stages = [
    'lead',
    'qualified',
    'quoted',
    'accepted',
    'funded',
    'shipped',
    'delivered',
    'closed',
  ]

  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Deals</h1>
        <Link
          href="/trade/deals/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          New Deal
        </Link>
      </div>

      {/* Stage pipeline visualization */}
      <div className="flex gap-1 mb-6">
        {stages.map((stage) => (
          <div
            key={stage}
            className="flex-1 rounded-md bg-gray-100 p-2 text-center text-xs font-medium uppercase"
          >
            {stage}
          </div>
        ))}
      </div>

      {/* Table view */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Ref #</th>
              <th className="px-4 py-3 text-left font-medium">Seller</th>
              <th className="px-4 py-3 text-left font-medium">Buyer</th>
              <th className="px-4 py-3 text-left font-medium">Value</th>
              <th className="px-4 py-3 text-left font-medium">Stage</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                No deals found. Create your first deal to get started.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  )
}
