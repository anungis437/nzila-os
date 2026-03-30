import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Listings',
}

export default function ListingsPage() {
  return (
    <main className="mx-auto max-w-7xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Listings</h1>
        <Link
          href="/trade/listings/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
        >
          Create Listing
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <select className="rounded-md border px-3 py-2 text-sm">
          <option value="">All Types</option>
          <option value="generic">Generic</option>
          <option value="vehicle">Vehicle</option>
        </select>
        <select className="rounded-md border px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="reserved">Reserved</option>
          <option value="sold">Sold</option>
        </select>
      </div>

      {/* Grid placeholder */}
      <div className="rounded-lg border p-8 text-center text-gray-500">
        No listings found. Create your first listing to get started.
      </div>
    </main>
  )
}
