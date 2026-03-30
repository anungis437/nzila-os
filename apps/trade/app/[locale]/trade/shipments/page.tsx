import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Shipments',
}

export default function ShipmentsPage() {
  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Shipments</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <select className="rounded-md border px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="booked">Booked</option>
          <option value="in_transit">In Transit</option>
          <option value="customs">Customs</option>
          <option value="delivered">Delivered</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Deal</th>
              <th className="px-4 py-3 text-left font-medium">Route</th>
              <th className="px-4 py-3 text-left font-medium">Carrier</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">ETA</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                No shipments found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  )
}
