/**
 * Zonga — Creator Wallet & Payout Detail (Server Component).
 *
 * Shows a single creator's wallet balance, payout history,
 * and royalty split earnings across releases.
 */
import { auth } from '@clerk/nextjs/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'
import { getCreatorDetail } from '@/lib/actions/creator-actions'
import { getWalletBalance, listPayouts } from '@/lib/actions/payout-actions'

const RAIL_LABELS: Record<string, string> = {
  stripe_connect: '💳 Stripe',
  mpesa: '📱 M-Pesa',
  mtn_momo: '📱 MTN MoMo',
  airtel_money: '📱 Airtel Money',
  orange_money: '📱 Orange Money',
  bank_transfer: '🏦 Bank Transfer',
  chipper_cash: '📱 Chipper Cash',
  flutterwave: '🌊 Flutterwave',
}

function formatAmount(amount: number, currency: string = 'USD') {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function CreatorPayoutDetailPage({
  params,
}: {
  params: Promise<{ creatorId: string; locale: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { creatorId } = await params
  const [detail, wallet, payoutResult] = await Promise.all([
    getCreatorDetail(creatorId),
    getWalletBalance(creatorId),
    listPayouts({ creatorId }),
  ])

  if (!detail.creator) notFound()

  const creator = detail.creator

  return (
    <div className="space-y-8">
      <Link
        href="../"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        ← Back to Payouts
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-electric/10 text-2xl">
          🎤
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {(creator as unknown as Record<string, unknown>).name as string ?? 'Creator'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Wallet & Payout History
          </p>
        </div>
      </div>

      {/* Wallet Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">
              {formatAmount(wallet.pendingBalance, wallet.currency)}
            </p>
            <p className="text-xs text-muted-foreground">Available Balance</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">
              {formatAmount(wallet.grossRevenue, wallet.currency)}
            </p>
            <p className="text-xs text-muted-foreground">Total Revenue</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-2xl font-bold text-electric">
              {formatAmount(wallet.totalPaid, wallet.currency)}
            </p>
            <p className="text-xs text-muted-foreground">Total Paid Out</p>
          </div>
        </Card>
        <Card>
          <div className="p-4 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              {wallet.lastPayoutAt
                ? new Date(wallet.lastPayoutAt).toLocaleDateString('en-CA')
                : 'Never'}
            </p>
            <p className="text-xs text-muted-foreground">Last Payout</p>
          </div>
        </Card>
      </div>

      {/* Revenue vs Paid Visual */}
      <Card>
        <div className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Revenue Breakdown</h2>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Total Revenue</span>
                <span>{formatAmount(wallet.grossRevenue, wallet.currency)}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-navy" style={{ width: '100%' }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Paid Out</span>
                <span>{formatAmount(wallet.totalPaid, wallet.currency)}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500"
                  style={{
                    width: wallet.grossRevenue > 0
                      ? `${(wallet.totalPaid / wallet.grossRevenue) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Pending</span>
                <span>{formatAmount(wallet.pendingBalance, wallet.currency)}</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-amber-500"
                  style={{
                    width: wallet.grossRevenue > 0
                      ? `${(wallet.pendingBalance / wallet.grossRevenue) * 100}%`
                      : '0%',
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Payout History */}
      <Card>
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">📋 Payout History</h2>
            <Link
              href={`../new?creator=${creatorId}`}
              className="rounded-lg bg-electric px-3 py-1.5 text-xs font-medium text-white hover:bg-electric/90 transition"
            >
              New Payout
            </Link>
          </div>
          {payoutResult.payouts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground/70">
              No payouts yet for this creator
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Date</th>
                    <th className="py-2 pr-4 font-medium">Amount</th>
                    <th className="py-2 pr-4 font-medium">Rail</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium">Transfer ID</th>
                  </tr>
                </thead>
                <tbody>
                  {payoutResult.payouts.map((p) => {
                    const payout = p as unknown as Record<string, unknown>
                    return (
                      <tr key={payout.id as string} className="border-b border-gray-50">
                        <td className="py-2.5 pr-4 text-muted-foreground text-xs">
                          {payout.createdAt
                            ? new Date(payout.createdAt as string).toLocaleDateString('en-CA')
                            : '—'}
                        </td>
                        <td className="py-2.5 pr-4 font-medium text-foreground">
                          {formatAmount(
                            Number(payout.amount ?? 0),
                            (payout.currency as string) ?? 'USD',
                          )}
                        </td>
                        <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                          {RAIL_LABELS[(payout.payoutRail as string) ?? ''] ?? String(payout.payoutRail ?? '—')}
                        </td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              payout.status === 'completed'
                                ? 'bg-emerald-100 text-emerald-700'
                                : payout.status === 'pending'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {String(payout.status)}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-xs text-muted-foreground">
                          {payout.stripeTransferId
                            ? String(payout.stripeTransferId).slice(0, 16)
                            : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {/* Summary */}
      <Card>
        <div className="p-5">
          <h2 className="mb-3 text-sm font-semibold text-foreground">📊 Stats</h2>
          <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Total Payouts</dt>
              <dd className="text-lg font-bold text-foreground">{payoutResult.total}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Catalog Size</dt>
              <dd className="text-lg font-bold text-foreground">{detail.assets} tracks</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Total Revenue</dt>
              <dd className="text-lg font-bold text-foreground">
                {formatAmount(detail.revenue)}
              </dd>
            </div>
          </dl>
        </div>
      </Card>
    </div>
  )
}
