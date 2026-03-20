/**
 * Zonga — Rights Management Dashboard (Server Component).
 *
 * Overview of royalty splits across releases, rights disputes,
 * and sync license tracking. African-first rights management.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { listRightsDisputes, listSyncLicenses } from '@/lib/actions/rights-actions'
import { listReleases } from '@/lib/actions/release-actions'

function disputeStatusBadge(status: string) {
  const map: Record<string, string> = {
    open: 'bg-red-100 text-red-700',
    under_review: 'bg-amber-100 text-amber-700',
    resolved: 'bg-emerald-100 text-emerald-700',
    dismissed: 'bg-gray-100 text-gray-600',
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status.replace(/_/g, ' ')}
    </span>
  )
}

function licenseStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    active: 'bg-emerald-100 text-emerald-700',
    expired: 'bg-gray-100 text-gray-600',
    revoked: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${map[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {status}
    </span>
  )
}

export default async function RightsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const [disputes, licenses, releasesResult] = await Promise.all([
    listRightsDisputes(),
    listSyncLicenses(),
    listReleases({ page: 1 }),
  ])

  const openDisputes = disputes.filter((d) => d.status === 'open' || d.status === 'under_review')
  const activeLicenses = licenses.filter((l) => l.status === 'active')
  const totalLicenseFees = activeLicenses.reduce((sum, l) => sum + Number(l.fee), 0)

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">⚖️ Rights Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            Royalty splits, rights disputes, and sync licensing
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-navy">{releasesResult.total}</p>
            <p className="text-xs text-gray-500">Releases with Splits</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">{openDisputes.length}</p>
            <p className="text-xs text-gray-500">Open Disputes</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{activeLicenses.length}</p>
            <p className="text-xs text-gray-500">Active Licenses</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-electric">
              ${totalLicenseFees.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">License Revenue</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Releases with Splits — quick access */}
        <Card>
          <div className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-navy">📀 Release Splits</h2>
            <p className="mb-3 text-xs text-gray-500">
              Manage royalty splits for each release
            </p>
            {releasesResult.releases.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-400">No releases yet</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {releasesResult.releases.slice(0, 10).map((release) => (
                  <div
                    key={release.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div>
                      <Link
                        href={`releases/${release.id}`}
                        className="text-sm font-medium text-navy hover:text-electric"
                      >
                        {release.title}
                      </Link>
                      <p className="text-xs text-gray-500">{release.status}</p>
                    </div>
                    <Link
                      href={`releases/${release.id}/splits`}
                      className="rounded-lg bg-electric/10 px-3 py-1 text-xs font-medium text-electric hover:bg-electric/20 transition"
                    >
                      Edit Splits
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Rights Disputes */}
        <Card>
          <div className="p-5">
            <h2 className="mb-3 text-sm font-semibold text-navy">🔒 Rights Disputes</h2>
            {disputes.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-sm text-gray-400">No disputes filed</p>
                <p className="mt-1 text-xs text-gray-400">
                  Disputes protect creator rights when ownership is contested
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {disputes.slice(0, 8).map((d) => (
                  <div key={d.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-navy">
                          {d.disputeType.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-gray-500">
                          by {d.claimantName} · {new Date(d.createdAt).toLocaleDateString('en-CA')}
                        </p>
                      </div>
                      {disputeStatusBadge(d.status)}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 line-clamp-1">
                      {d.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Sync Licenses */}
      <Card>
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-navy">🎬 Sync Licenses</h2>
          </div>
          {licenses.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-400">No sync licenses</p>
              <p className="mt-1 text-xs text-gray-400">
                Sync licenses track usage rights for film, TV, advertising, and other media
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500">
                    <th className="py-2 pr-4 font-medium">Track</th>
                    <th className="py-2 pr-4 font-medium">Licensee</th>
                    <th className="py-2 pr-4 font-medium">Usage</th>
                    <th className="py-2 pr-4 font-medium">Territory</th>
                    <th className="py-2 pr-4 font-medium">Fee</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Expires</th>
                  </tr>
                </thead>
                <tbody>
                  {licenses.map((l) => (
                    <tr key={l.id} className="border-b border-gray-50">
                      <td className="py-2.5 pr-4 font-medium text-navy">
                        {l.assetTitle ?? l.assetId.slice(0, 8)}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">{l.licensee}</td>
                      <td className="py-2.5 pr-4 text-gray-600">
                        {l.usageType.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">{l.territory}</td>
                      <td className="py-2.5 pr-4 font-mono text-navy">
                        {l.currency} {Number(l.fee).toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-4">{licenseStatusBadge(l.status)}</td>
                      <td className="py-2.5 text-gray-500 text-xs">
                        {l.expiresAt
                          ? new Date(l.expiresAt).toLocaleDateString('en-CA')
                          : 'Perpetual'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
