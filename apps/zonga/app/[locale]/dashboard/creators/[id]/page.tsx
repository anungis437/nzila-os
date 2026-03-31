/**
 * Zonga — Creator Detail Page (Server Component).
 *
 * Shows creator profile, stats, catalog with play buttons, wallet,
 * payout history, and revenue breakdown.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { getCreatorDetail } from '@/lib/actions/creator-actions'
import { getWalletBalance, listPayouts } from '@/lib/actions/payout-actions'
import { listCatalogAssets } from '@/lib/actions/catalog-actions'
import { formatCurrencyAmount } from '@/lib/stripe'
import { StatusBadge, SystemGuidance } from '@/components'
import { CreatorCatalog } from '@/components/dashboard/creator-catalog'

export default async function CreatorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { id } = await params
  const { creator, assets, revenue, payouts: payoutCount } = await getCreatorDetail(id)

  if (!creator) {
    return (
      <div className="max-w-lg mx-auto mt-16 text-center">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="text-xl font-bold text-foreground">Creator Not Found</h2>
        <p className="text-muted-foreground mt-2">This creator may have been removed.</p>
        <Link
          href="../"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white"
        >
          ← Back to Creators
        </Link>
      </div>
    )
  }

  const [wallet, { payouts: recentPayouts }, catalogResult] = await Promise.all([
    getWalletBalance(id),
    listPayouts({ creatorId: id }),
    listCatalogAssets({ pageSize: 50 }),
  ])

  // Filter to this creator's assets from the catalog
  const creatorAssets = catalogResult.assets.filter(
    (a) => a.creatorId === id || (a as unknown as Record<string, unknown>).creator_id === id,
  )

  const payoutRailBadge = (rail: string) => {
    const colors: Record<string, string> = {
      mpesa: 'bg-green-100 text-green-700',
      mtn_momo: 'bg-yellow-100 text-yellow-700',
      airtel_money: 'bg-red-100 text-red-700',
      orange_money: 'bg-orange-100 text-orange-700',
      stripe: 'bg-purple-100 text-purple-700',
      bank_transfer: 'bg-blue-100 text-blue-700',
    }
    return colors[rail] ?? 'bg-muted text-muted-foreground'
  }

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link href="../" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition">
        ← All Creators
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-electric/10 text-3xl">
            🎤
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{creator.displayName ?? 'Unnamed Creator'}</h1>
            <p className="text-muted-foreground max-w-md">{creator.bio ?? '—'}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <StatusBadge status={creator.status ?? 'pending'} />
              {creator.genre && (
                <span className="rounded-full bg-navy/10 px-2 py-0.5 text-[10px] text-foreground">
                  {(creator.genre as string).replace(/_/g, ' ')}
                </span>
              )}
              {creator.country && (
                <span className="rounded-full bg-electric/10 px-2 py-0.5 text-[10px] text-electric">
                  🌍 {creator.country as string}
                </span>
              )}
              {creator.createdAt && (
                <span className="text-[10px] text-muted-foreground/70">
                  Joined {new Date(creator.createdAt as string).toLocaleDateString('en-CA')}
                </span>
              )}
            </div>
          </div>
        </div>
        <Link
          href={`${id}/edit`}
          className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted/50 transition shrink-0"
        >
          ✏️ Edit Profile
        </Link>
      </div>

      {/* Guidance */}
      {creator.status === 'pending' && (
        <SystemGuidance severity="info" title="Complete onboarding">
          This creator hasn&apos;t been activated yet. Verify their profile and payout details before publishing content.
        </SystemGuidance>
      )}
      {creator.status === 'suspended' && (
        <SystemGuidance severity="warning" title="Creator suspended">
          This creator account is suspended. Content will not be visible until the suspension is lifted.
        </SystemGuidance>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Catalog Size</p>
            <p className="text-2xl font-bold text-foreground">{assets}</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">{creatorAssets.filter((a) => a.status === 'published').length} published</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Total Revenue</p>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrencyAmount(Math.round(revenue * 100), wallet.currency)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Pending Balance</p>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrencyAmount(Math.round(wallet.pendingBalance * 100), wallet.currency)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Total Payouts</p>
            <p className="text-2xl font-bold text-foreground">{payoutCount}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Creator Catalog with Play Buttons */}
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-foreground">🎵 Catalog</h2>
                <Link
                  href={`../../catalog/upload?creatorId=${id}`}
                  className="rounded-lg bg-electric/10 px-3 py-1.5 text-xs font-medium text-electric hover:bg-electric/20 transition"
                >
                  + Upload Track
                </Link>
              </div>
              {creatorAssets.length === 0 ? (
                <div className="text-center py-10">
                  <div className="text-4xl mb-3">🎶</div>
                  <p className="text-sm text-muted-foreground">No tracks uploaded yet.</p>
                  <Link
                    href={`../../catalog/upload?creatorId=${id}`}
                    className="mt-3 inline-flex rounded-lg bg-electric px-4 py-2 text-xs font-medium text-white"
                  >
                    Upload First Track
                  </Link>
                </div>
              ) : (
                <CreatorCatalog assets={creatorAssets} />
              )}
            </div>
          </Card>

          {/* Recent Payouts */}
          <Card>
            <div className="p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">💸 Recent Payouts</h2>
              {recentPayouts.length === 0 ? (
                <p className="text-sm text-muted-foreground/70 py-4 text-center">No payouts yet for this creator.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-foreground border-b">
                        <th className="pb-2">Date</th>
                        <th className="pb-2">Amount</th>
                        <th className="pb-2">Rail</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {recentPayouts.slice(0, 10).map((p: { id: string; amount?: number; currency?: string; status?: string; createdAt?: string; rail?: string }) => (
                        <tr key={p.id}>
                          <td className="py-2 text-muted-foreground">
                            {p.createdAt
                              ? new Date(p.createdAt).toLocaleDateString('en-CA')
                              : '—'}
                          </td>
                          <td className="py-2 font-medium text-foreground">
                            {formatCurrencyAmount(Math.round(Number(p.amount ?? 0) * 100), p.currency ?? 'USD')}
                          </td>
                          <td className="py-2">
                            {p.rail ? (
                              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${payoutRailBadge(p.rail)}`}>
                                {p.rail.replace(/_/g, ' ')}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/70">—</span>
                            )}
                          </td>
                          <td className="py-2">
                            <StatusBadge status={p.status ?? 'pending'} />
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

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Wallet Summary */}
          <Card>
            <div className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-3">💰 Wallet</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Gross Revenue</dt>
                  <dd className="font-medium text-foreground">
                    {formatCurrencyAmount(Math.round(wallet.grossRevenue * 100), wallet.currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Paid Out</dt>
                  <dd className="font-medium text-emerald-600">
                    {formatCurrencyAmount(Math.round(wallet.totalPaid * 100), wallet.currency)}
                  </dd>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <dt className="text-muted-foreground font-medium">Pending</dt>
                  <dd className="font-bold text-foreground">
                    {formatCurrencyAmount(Math.round(wallet.pendingBalance * 100), wallet.currency)}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Currency</dt>
                  <dd className="uppercase font-mono text-xs text-foreground">{wallet.currency}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Last Payout</dt>
                  <dd className="text-foreground">
                    {wallet.lastPayoutAt
                      ? new Date(wallet.lastPayoutAt).toLocaleDateString('en-CA')
                      : 'Never'}
                  </dd>
                </div>
              </dl>
            </div>
          </Card>

          {/* Quick Actions */}
          <Card>
            <div className="p-5 space-y-2">
              <h2 className="text-sm font-semibold text-foreground mb-3">⚡ Actions</h2>
              <Link
                href={`../../catalog/upload?creatorId=${id}`}
                className="block w-full rounded-lg bg-electric px-3 py-2 text-center text-xs font-medium text-white hover:bg-electric/90 transition"
              >
                Upload Track
              </Link>
              <Link
                href={`../../releases/create`}
                className="block w-full rounded-lg border border-border px-3 py-2 text-center text-xs font-medium text-foreground hover:bg-muted/50 transition"
              >
                Create Release
              </Link>
              <Link
                href={`../../revenue?creatorId=${id}`}
                className="block w-full rounded-lg border border-border px-3 py-2 text-center text-xs font-medium text-foreground hover:bg-muted/50 transition"
              >
                View Revenue
              </Link>
              <Link
                href={`../../analytics?creatorId=${id}`}
                className="block w-full rounded-lg border border-border px-3 py-2 text-center text-xs font-medium text-foreground hover:bg-muted/50 transition"
              >
                View Analytics
              </Link>
            </div>
          </Card>

          {/* Creator ID */}
          <Card>
            <div className="p-5">
              <h2 className="text-sm font-semibold text-foreground mb-2">📋 Details</h2>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Creator ID</dt>
                  <dd className="font-mono text-foreground">{id.slice(0, 12)}…</dd>
                </div>
                {creator.payoutRail && (
                  <div className="flex justify-between">
                    <dt className="text-muted-foreground">Payout Rail</dt>
                    <dd className="text-foreground capitalize">{creator.payoutRail.replace(/_/g, ' ')}</dd>
                  </div>
                )}
              </dl>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
