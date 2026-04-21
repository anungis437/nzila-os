/**
 * ITSM Asset Detail — asset profile with risk score breakdown
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

interface AssetDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AssetDetailPage({ params }: AssetDetailPageProps) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params

  // TODO: fetch asset + related tickets from DB scoped by orgId

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Link href="/itsm/assets" className="text-gray-400 hover:text-gray-600 text-sm">
        ← Assets / CMDB
      </Link>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h1 className="text-xl font-bold text-gray-900 mb-2">Asset {id}</h1>
        <p className="text-gray-500 text-sm">
          Asset profile and risk score will populate once DB service layer is wired.
        </p>
      </div>

      {/* Risk score card */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Risk Analysis</h2>
        <div className="flex items-center gap-4">
          <div className="text-4xl font-bold text-gray-900">—</div>
          <p className="text-sm text-gray-500">Risk score will display after asset data loads.</p>
        </div>
      </div>

      {/* Related tickets */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Related Tickets</h2>
        <p className="text-gray-400 text-sm">No tickets linked to this asset yet.</p>
      </div>
    </div>
  )
}
