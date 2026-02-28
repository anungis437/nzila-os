import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Commissions',
}

export default function CommissionsPage() {
  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Commissions</h1>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <select className="rounded-md border px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="previewed">Previewed</option>
          <option value="finalized">Finalized</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Deal</th>
              <th className="px-4 py-3 text-left font-medium">Party</th>
              <th className="px-4 py-3 text-left font-medium">Amount</th>
              <th className="px-4 py-3 text-left font-medium">Currency</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                No commissions found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  )
}
