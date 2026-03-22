import { listShipments } from '@/lib/actions'

export default async function ShipmentsPage() {
  const result = await listShipments()
  const shipments = (result.data?.shipments ?? []) as Array<{
    id: string; batchId: string; status: string; destination: { country: string }; allocatedWeight: number; createdAt: string
  }>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Shipments</h1>
      <p className="text-gray-600 mb-6">Shipping plans and milestone tracking.</p>
      {shipments.length === 0 ? (
        <p className="text-gray-400 italic">No shipments created yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Destination</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Weight</th>
                <th className="px-4 py-2 text-left font-medium">Batch</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-medium">{s.destination.country}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      s.status === 'delivered' ? 'bg-green-100 text-green-800' :
                      s.status === 'in_transit' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{s.status}</span>
                  </td>
                  <td className="px-4 py-2">{s.allocatedWeight.toLocaleString()} kg</td>
                  <td className="px-4 py-2 font-mono text-xs">{s.batchId.slice(0, 8)}</td>
                  <td className="px-4 py-2">{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
