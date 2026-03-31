/**
 * Zonga — Payouts Page (Server Component).
 *
 * Payout history, preview, and execution via Stripe Connect
 * or mobile money rails (M-Pesa, MTN MoMo, etc.).
 */
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import { listPayouts } from '@/lib/actions/payout-actions'
import { formatCurrencyAmount } from '@/lib/stripe'

/** Payout rail display labels. */
const railLabels: Record<string, string> = {
  stripe_connect: 'Stripe (Card)',
  mpesa: 'M-Pesa (Safaricom)',
  mtn_momo: 'MTN Mobile Money',
  airtel_money: 'Airtel Money',
  orange_money: 'Orange Money',
  bank_transfer: 'Bank Transfer',
  chipper_cash: 'Chipper Cash',
  flutterwave: 'Flutterwave',
  vodacom_mpesa: 'Vodacom M-Pesa',
  moov_money: 'Moov Money',
  wave: 'Wave',
  ecocash: 'EcoCash',
  paga: 'Paga',
  paystack: 'Paystack',
}

function formatAmount(cents: number, currency = 'USD'): string {
  return formatCurrencyAmount(cents, currency)
}

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const { payouts, total, totalPaid } = await listPayouts({ page: Number(params.page ?? '1') })

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Payouts</h1>
          <p className="text-muted-foreground mt-1">Creator earnings and payout history</p>
        </div>
        <a
          href="payouts/new"
          className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white hover:bg-electric/90"
        >
          New Payout
        </a>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Total Payouts</p>
            <p className="text-2xl font-bold text-foreground">{total}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Total Paid Out</p>
            <p className="text-2xl font-bold text-emerald-600">{formatAmount(Math.round(totalPaid * 100))}</p>
          </div>
        </Card>
        <Card>
          <div className="p-5">
            <p className="text-xs text-muted-foreground">Average Payout</p>
            <p className="text-2xl font-bold text-foreground">
              {total > 0 ? formatAmount(Math.round((totalPaid / total) * 100)) : '—'}
            </p>
          </div>
        </Card>
      </div>

      {/* Payout List */}
      {payouts.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <p className="font-semibold text-foreground text-lg">No payouts yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Artist payouts will appear here once earnings have been distributed.
            </p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border">
                <tr>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Creator</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Amount</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Rail</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Date</th>
                  <th className="px-5 py-3 text-xs font-medium text-muted-foreground">Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payouts.map((p: { id: string; creatorName?: string; creatorId?: string; amount?: number; currency?: string; payoutRail?: string | null; status?: string; createdAt?: string; stripeTransferId?: string; reference?: string }) => (
                  <tr key={p.id} className="hover:bg-muted/50">
                    <td className="px-5 py-3">
                      <span className="font-medium text-foreground">
                        {p.creatorName ?? p.creatorId?.slice(0, 8) ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 font-semibold text-emerald-600">
                      {formatAmount(Math.round(Number(p.amount ?? 0) * 100), p.currency ?? 'USD')}
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600">
                        {railLabels[p.payoutRail ?? 'stripe_connect'] ?? p.payoutRail ?? 'Stripe'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        p.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : p.status === 'pending'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-muted text-muted-foreground'
                      }`}>
                        {(p.status ?? 'unknown').charAt(0).toUpperCase() + (p.status ?? 'unknown').slice(1)}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-CA') : '—'}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground/70 font-mono">
                      {(p.stripeTransferId ?? p.reference) ? (p.stripeTransferId ?? p.reference ?? '').slice(0, 16) + '…' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
