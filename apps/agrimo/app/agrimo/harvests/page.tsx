import { listHarvests } from '@/lib/actions'

export default async function HarvestsPage() {
  const result = await listHarvests()
  const harvests = (result.data?.harvests ?? []) as Array<{
    id: string; producerId: string; cropId: string; season: string; harvestDate: string; quantity: number; createdAt: string
  }>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Harvests</h1>
      <p className="text-gray-600 mb-6">Harvest records linked to producers and crops.</p>
      {harvests.length === 0 ? (
        <p className="text-gray-400 italic">No harvests recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Season</th>
                <th className="px-4 py-2 text-left font-medium">Harvest Date</th>
                <th className="px-4 py-2 text-left font-medium">Quantity</th>
                <th className="px-4 py-2 text-left font-medium">Producer</th>
                <th className="px-4 py-2 text-left font-medium">Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {harvests.map((h) => (
                <tr key={h.id}>
                  <td className="px-4 py-2 font-medium">{h.season}</td>
                  <td className="px-4 py-2">{h.harvestDate}</td>
                  <td className="px-4 py-2">{h.quantity.toLocaleString()}</td>
                  <td className="px-4 py-2 font-mono text-xs">{h.producerId.slice(0, 8)}</td>
                  <td className="px-4 py-2">{new Date(h.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
