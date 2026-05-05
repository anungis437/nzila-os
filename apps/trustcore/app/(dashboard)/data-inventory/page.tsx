import { getAuthContext } from '@/lib/auth/getAuthContext'

export const dynamic = 'force-dynamic'

export default async function DataInventoryPage() {
  const ctx = await getAuthContext()

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Data Inventory</h1>
        <p className="text-sm text-gray-500 mt-1 font-mono">{ctx.orgId}</p>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        <p className="text-sm">Data will appear here once the schema is wired.</p>
      </div>
    </div>
  )
}
