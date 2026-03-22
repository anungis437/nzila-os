import { listBatches } from '@/lib/actions'

export default async function WarehousePage() {
  const result = await listBatches()
  const batches = (result.data?.batches ?? []) as Array<{
    id: string; warehouseId: string; cropId: string; status: string; totalWeight: number; availableWeight: number; createdAt: string
  }>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Warehouse</h1>
      <p className="text-gray-600 mb-6">Inventory batches, storage facilities, and allocations.</p>
      {batches.length === 0 ? (
        <p className="text-gray-400 italic">No inventory batches yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Warehouse</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Total Weight</th>
                <th className="px-4 py-2 text-left font-medium">Available</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {batches.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-2 font-mono text-xs">{b.warehouseId.slice(0, 8)}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      b.status === 'available' ? 'bg-green-100 text-green-800' :
                      b.status === 'depleted' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{b.status}</span>
                  </td>
                  <td className="px-4 py-2">{b.totalWeight.toLocaleString()} kg</td>
                  <td className="px-4 py-2">{b.availableWeight.toLocaleString()} kg</td>
                  <td className="px-4 py-2">{new Date(b.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
