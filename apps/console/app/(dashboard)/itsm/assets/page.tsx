/**
 * ITSM CMDB — Asset registry
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ASSET_TYPES } from '@nzila/itsm-core'
import { platformDb } from '@nzila/db/platform'
import { itsmAssets } from '@nzila/db/schema'
import { getExecutiveOrgId } from '@/lib/executive-os'
import { desc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Assets / CMDB | ITSM',
}

const LIFECYCLE_COLOR: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  in_stock: 'bg-blue-100 text-blue-700',
  deployed: 'bg-indigo-100 text-indigo-700',
  under_repair: 'bg-yellow-100 text-yellow-700',
  retired: 'bg-gray-100 text-gray-500',
  disposed: 'bg-red-100 text-red-700',
}

export default async function AssetsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const orgId = await getExecutiveOrgId()

  let assets: Array<{
    id: string
    type: string
    name: string
    manufacturer: string | null
    model: string | null
    ownerId: string | null
    lifecycle: string
    riskScore: number
    warrantyExpiry: string | null
  }> = []

  if (orgId) {
    const rows = await platformDb
      .select({
        id: itsmAssets.id,
        type: itsmAssets.type,
        name: itsmAssets.name,
        manufacturer: itsmAssets.manufacturer,
        model: itsmAssets.model,
        ownerId: itsmAssets.ownerId,
        lifecycle: itsmAssets.lifecycle,
        riskScore: itsmAssets.riskScore,
        warrantyExpiry: itsmAssets.warrantyExpiry,
      })
      .from(itsmAssets)
      .where(eq(itsmAssets.orgId, orgId))
      .orderBy(desc(itsmAssets.updatedAt))
      .limit(500)
      .catch(() => [])

    assets = rows.map((row) => ({
      ...row,
      riskScore: row.riskScore ?? 0,
    }))
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assets / CMDB</h1>
          <p className="text-sm text-gray-500 mt-1">{assets.length} assets registered</p>
        </div>
        <Link
          href="/itsm/assets/new"
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Register Asset
        </Link>
      </div>

      {/* Type filter chips */}
      <div className="flex flex-wrap gap-2">
        {ASSET_TYPES.map((type) => (
          <span
            key={type}
            className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 cursor-pointer hover:bg-gray-200"
          >
            {type.replace(/_/g, ' ')}
          </span>
        ))}
      </div>

      {/* Asset table */}
      <div className="rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Lifecycle</th>
              <th className="px-4 py-3 text-left">Owner</th>
              <th className="px-4 py-3 text-left">Risk Score</th>
              <th className="px-4 py-3 text-left">Warranty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {assets.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  No assets registered yet.
                </td>
              </tr>
            ) : (
              assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/itsm/assets/${asset.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {asset.name}
                    </Link>
                    <p className="text-xs text-gray-400">
                      {[asset.manufacturer, asset.model].filter(Boolean).join(' · ')}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">
                    {asset.type.replace(/_/g, ' ')}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${LIFECYCLE_COLOR[asset.lifecycle] ?? 'bg-gray-100 text-gray-600'}`}>
                      {asset.lifecycle.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{asset.ownerId ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-gray-200 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${asset.riskScore >= 70 ? 'bg-red-500' : asset.riskScore >= 40 ? 'bg-yellow-400' : 'bg-green-400'}`}
                          style={{ width: `${asset.riskScore}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{asset.riskScore}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {asset.warrantyExpiry ?? '—'}
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
