import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Deal Room',
}

/**
 * Deal Room — single deal detail page.
 *
 * Shows deal overview, FSM stage with available transitions,
 * quotes, financing, shipments, documents, commissions, and audit trail.
 * This is the "deal room" — the central workspace for a trade deal.
 */
export default async function DealRoomPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <main className="mx-auto max-w-7xl p-6">
      {/* Deal header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Deal Room</h1>
        <p className="text-sm text-gray-500">Deal ID: {id}</p>
      </div>

      {/* Stage indicator */}
      <section className="rounded-lg border p-4 mb-6">
        <h2 className="text-lg font-semibold mb-2">Current Stage</h2>
        <div className="flex items-center gap-4">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800">
            —
          </span>
          <div className="flex gap-2">
            {/* Available transitions rendered as action buttons */}
            <span className="text-sm text-gray-500">
              Load available transitions from FSM engine
            </span>
          </div>
        </div>
      </section>

      {/* Content tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quotes */}
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Quotes</h2>
          <p className="text-sm text-gray-500">No quotes generated yet.</p>
        </section>

        {/* Financing */}
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Financing</h2>
          <p className="text-sm text-gray-500">No financing terms attached.</p>
        </section>

        {/* Shipments */}
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Shipments</h2>
          <p className="text-sm text-gray-500">No shipments created.</p>
        </section>

        {/* Documents */}
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Documents</h2>
          <p className="text-sm text-gray-500">No documents uploaded.</p>
        </section>

        {/* Commissions */}
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Commissions</h2>
          <p className="text-sm text-gray-500">No commissions configured.</p>
        </section>

        {/* Audit trail */}
        <section className="rounded-lg border p-4">
          <h2 className="text-lg font-semibold mb-2">Audit Trail</h2>
          <p className="text-sm text-gray-500">No audit entries yet.</p>
        </section>
      </div>
    </main>
  )
}
