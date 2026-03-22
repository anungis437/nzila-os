import { listPayments } from '@/lib/actions'

export default async function PaymentsPage() {
  const result = await listPayments()
  const plans = (result.data?.payments ?? []) as Array<{
    id: string; lotId: string; totalAmount: number; currency: string; status: string; createdAt: string
  }>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Payments</h1>
      <p className="text-gray-600 mb-6">Distribution plans and producer payouts.</p>
      {plans.length === 0 ? (
        <p className="text-gray-400 italic">No payment plans yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">Lot</th>
                <th className="px-4 py-2 text-left font-medium">Status</th>
                <th className="px-4 py-2 text-left font-medium">Total Amount</th>
                <th className="px-4 py-2 text-left font-medium">Currency</th>
                <th className="px-4 py-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {plans.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-mono text-xs">{p.lotId.slice(0, 8)}</td>
                  <td className="px-4 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      p.status === 'completed' ? 'bg-green-100 text-green-800' :
                      p.status === 'active' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>{p.status}</span>
                  </td>
                  <td className="px-4 py-2">{p.totalAmount.toLocaleString()}</td>
                  <td className="px-4 py-2">{p.currency}</td>
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
