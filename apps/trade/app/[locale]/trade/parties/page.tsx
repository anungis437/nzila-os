import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Parties',
}

export default function PartiesPage() {
  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Parties</h1>
        <Link
          href="/trade/parties/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Add Party
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <select className="rounded-md border px-3 py-2 text-sm">
          <option value="">All Roles</option>
          <option value="seller">Sellers</option>
          <option value="buyer">Buyers</option>
          <option value="broker">Brokers</option>
          <option value="agent">Agents</option>
        </select>
      </div>

      {/* Table placeholder */}
      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Company</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Country</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                No parties found. Add your first trade party to get started.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  )
}
