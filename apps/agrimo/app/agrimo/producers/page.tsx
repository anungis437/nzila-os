import { listProducers } from '@/lib/actions'

export default async function ProducersPage() {
  const result = await listProducers()
  const producers = (result.data?.producers ?? []) as Array<{
    id: string; name: string; status: string; contactPhone: string | null; contactEmail: string | null; createdAt: string
  }>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Producers</h1>
      <p className="text-gray-600 mb-6">Smallholder farmers and cooperative profiles.</p>
      {producers.length === 0 ? (
        <p className="text-gray-400 italic">No producers registered yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Name</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Phone</th>
                <th className="px-4 py-2 text-left font-medium">Email</th>
                <th className="px-4 py-2 text-left font-medium">Registered</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {producers.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium">{p.name}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2">{p.contactPhone ?? '—'}</td>
                  <td className="px-4 py-2">{p.contactEmail ?? '—'}</td>
                  <td className="px-4 py-2">{new Date(p.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
