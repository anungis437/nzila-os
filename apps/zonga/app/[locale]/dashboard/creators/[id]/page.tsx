/**
 * Zonga — Creator Detail Page (Server Component).
 *
 * Shows creator profile, stats, catalog, and payout history.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { getCreatorDetail } from '@/lib/actions/creator-actions'
import { getWalletBalance, listPayouts } from '@/lib/actions/payout-actions'
import { formatCurrencyAmount } from '@/lib/stripe'
import { StatusBadge, SystemGuidance } from '@/components'

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
        <h2 className="text-xl font-bold text-navy">Creator Not Found</h2>
        <p className="text-gray-500 mt-2">This creator may have been removed.</p>
        <Link
          href="../"
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white"
        >
          ← Back to Creators
        </Link>
      </div>
    )
  }

  const wallet = await getWalletBalance(id)
  const { payouts: recentPayouts } = await listPayouts({ creatorId: id })

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link href="../" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-navy transition">
        ← All Creators
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-electric/10 text-3xl">
          🎤
        </div>
        <div>
          <h1 className="text-2xl font-bold text-navy">{creator.displayName ?? 'Unnamed Creator'}</h1>
          <p className="text-gray-500">{creator.bio ?? '—'}</p>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={creator.status ?? 'pending'} />
            {creator.genre && (
              <span className="text-xs text-gray-400">
                {(creator.genre as string).replace(/_/g, ' ')}
              </span>
            )}
            {creator.country && (
              <span className="text-xs text-gray-400">
                {creator.country as string}
              </span>
            )}
          </div>
        </div>
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
            <p className="text-xs text-gray-500">Assets</p>
            <p className="text-2xl font-bold text-navy">{assets}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-emerald-600">
              {formatCurrencyAmount(Math.round(revenue * 100), wallet.currency)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-gray-500">Pending Balance</p>
            <p className="text-2xl font-bold text-navy">
              {formatCurrencyAmount(Math.round(wallet.pendingBalance * 100), wallet.currency)}
            </p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-gray-500">Total Payouts</p>
            <p className="text-2xl font-bold text-navy">{payoutCount}</p>
          </div>
        </Card>
      </div>

      {/* Wallet */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-navy mb-4">Wallet Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500">Gross Revenue</p>
              <p className="font-medium text-navy">
                {formatCurrencyAmount(Math.round(wallet.grossRevenue * 100), wallet.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total Paid Out</p>
              <p className="font-medium text-navy">
                {formatCurrencyAmount(Math.round(wallet.totalPaid * 100), wallet.currency)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Last Payout</p>
              <p className="font-medium text-navy">
                {wallet.lastPayoutAt
                  ? new Date(wallet.lastPayoutAt).toLocaleDateString('en-CA')
                  : 'Never'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent Payouts */}
      <Card>
        <div className="p-6">
          <h2 className="text-lg font-semibold text-navy mb-4">Recent Payouts</h2>
          {recentPayouts.length === 0 ? (
            <p className="text-sm text-gray-400">No payouts yet for this creator.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b">
                    <th className="pb-2">Date</th>
                    <th className="pb-2">Amount</th>
                    <th className="pb-2">Currency</th>
                    <th className="pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentPayouts.slice(0, 10).map((p: { id: string; amount?: number; currency?: string; status?: string; createdAt?: string }) => (
                    <tr key={p.id}>
                      <td className="py-2 text-gray-500">
                        {p.createdAt
                          ? new Date(p.createdAt).toLocaleDateString('en-CA')
                          : '—'}
                      </td>
                      <td className="py-2 font-medium text-navy">
                        {formatCurrencyAmount(Math.round(Number(p.amount ?? 0) * 100), p.currency ?? 'USD')}
                      </td>
                      <td className="py-2 text-gray-400 uppercase">{p.currency ?? 'USD'}</td>
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
  )
}
