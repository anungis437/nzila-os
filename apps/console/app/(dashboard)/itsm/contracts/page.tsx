/**
 * ITSM Client Contracts — MSP contract portfolio
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Client Contracts | ITSM',
}

const CONTRACT_STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  expiring_soon: 'bg-yellow-100 text-yellow-700',
  expired: 'bg-red-100 text-red-600',
  terminated: 'bg-gray-100 text-gray-400',
}

export default async function ClientContractsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  // TODO: fetch contracts from DB scoped by orgId
  const contracts: Array<{
    id: string
    contractNumber: string
    clientName: string
    status: string
    startDate: string
    endDate: string | null
    value: string | null
    serviceScope: string[]
    slaProfileName: string | null
  }> = []

  const activeCount = contracts.filter((c) => c.status === 'active').length
  const expiringSoonCount = contracts.filter((c) => c.status === 'expiring_soon').length

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Client Contracts</h1>
          <p className="text-sm text-gray-500 mt-1">
            {activeCount} active · {expiringSoonCount > 0 && (
              <span className="text-yellow-600 font-medium">{expiringSoonCount} expiring soon</span>
            )}
          </p>
        </div>
        <button className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          + New Contract
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{contracts.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total Contracts</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{activeCount}</p>
          <p className="text-xs text-gray-500 mt-1">Active</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{expiringSoonCount}</p>
          <p className="text-xs text-gray-500 mt-1">Expiring Soon</p>
        </div>
      </div>

      {/* Contracts table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Contract</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">SLA Profile</th>
              <th className="px-4 py-3 text-left">Period</th>
              <th className="px-4 py-3 text-left">Value</th>
              <th className="px-4 py-3 text-left">Services</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {contracts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  No contracts yet.
                </td>
              </tr>
            ) : (
              contracts.map((contract) => (
                <tr key={contract.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-mono text-xs text-gray-400">{contract.contractNumber}</p>
                    <p className="font-medium text-gray-900">{contract.clientName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CONTRACT_STATUS_COLOR[contract.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {contract.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    {contract.slaProfileName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {contract.startDate} – {contract.endDate ?? '∞'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    {contract.value ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contract.serviceScope.slice(0, 3).map((s) => (
                        <span key={s} className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                          {s}
                        </span>
                      ))}
                      {contract.serviceScope.length > 3 && (
                        <span className="text-xs text-gray-400">+{contract.serviceScope.length - 3}</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
