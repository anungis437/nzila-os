import { listLots } from '@/lib/actions'

export default async function LotsPage() {
  const result = await listLots()
  const lots = (result.data?.lots ?? []) as Array<{
    id: string; cropId: string; season: string; status: string; totalWeight: number; createdAt: string
  }>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Lots</h1>
      <p className="text-gray-600 mb-6">Aggregation lots and producer contributions.</p>
      {lots.length === 0 ? (
        <p className="text-gray-400 italic">No lots created yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Season</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Total Weight</th>
                <th className="px-4 py-2 text-left font-medium">Crop</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {lots.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-2 font-medium">{l.season}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      l.status === 'certified' ? 'bg-green-100 text-green-800' :
                      l.status === 'graded' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{l.status}</span>
                  </td>
                  <td className="px-4 py-2">{l.totalWeight.toLocaleString()} kg</td>
                  <td className="px-4 py-2 font-mono text-xs">{l.cropId.slice(0, 8)}</td>
                  <td className="px-4 py-2">{new Date(l.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
