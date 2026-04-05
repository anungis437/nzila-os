/**
 * Zonga — Creators Page (Server Component).
 *
 * Creator roster management: list, search, register, view detail.
 * Shows region, payout rail, and preferred currency for African creators.
 */
import Link from 'next/link'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { Card } from '@nzila/ui'
import { listCreators } from '@/lib/actions/creator-actions'
import { formatCurrencyAmount } from '@/lib/stripe'

/** Payout rail display labels. */
const railLabels: Record<string, string> = {
  stripe_connect: 'Stripe',
  mpesa: 'M-Pesa',
  mtn_momo: 'MTN MoMo',
  airtel_money: 'Airtel Money',
  orange_money: 'Orange Money',
  bank_transfer: 'Bank',
  chipper_cash: 'Chipper',
  flutterwave: 'Flutterwave',
}

/** Region flag emojis. */
const regionEmoji: Record<string, string> = {
  west: '🇳🇬',
  east: '🇰🇪',
  central: '🇨🇲',
  southern: '🇿🇦',
  north: '🇲🇦',
  diaspora: '🌍',
}

export default async function CreatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const params = await searchParams
  const page = Number(params.page ?? '1')
  const { creators, total } = await listCreators({ page, search: params.search })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Creators</h1>
          <p className="text-muted-foreground mt-1">{total} creator{total !== 1 ? 's' : ''} registered</p>
        </div>
        <Link
          href="creators/register"
          className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white hover:bg-electric/90"
        >
          👤 Register Creator
        </Link>
      </div>

      {/* Search */}
      <form className="relative" action="" method="GET">
        <input
          type="text"
          name="search"
          defaultValue={params.search ?? ''}
          placeholder="Search creators by name…"
          className="w-full rounded-lg border border-border bg-card py-2 pl-4 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-electric/40"
        />
      </form>

      {/* Creator Grid */}
      {creators.length === 0 ? (
        <Card>
          <div className="p-12 text-center">
            <div className="text-5xl mb-4">👤</div>
            <p className="font-semibold text-foreground text-lg">
              {params.search ? 'No matching creators' : 'No creators yet'}
            </p>
            <p className="text-muted-foreground text-sm mt-1">
              Register your first creator to start managing their catalog.
            </p>
            {!params.search && (
              <Link
                href="creators/register"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white"
              >
                👤 Register Creator
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {creators.map((creator: { id: string; name?: string; email?: string; genre?: string | null; country?: string | null; region?: string | null; payoutRail?: string | null; payoutCurrency?: string | null; language?: string | null; status?: string; assetCount?: string; totalRevenue?: string; createdAt?: string }) => (
            <Link key={creator.id} href={`creators/${creator.id}`}>
              <Card>
                <div className="p-5 hover:bg-muted/50 transition-colors rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-electric/10 text-xl">
                      {creator.region ? (regionEmoji[creator.region] ?? '🎤') : '🎤'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{creator.name ?? 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground truncate">{creator.email ?? '—'}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                      creator.status === 'active'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {creator.status ?? 'pending'}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground/70">
                    <span>{creator.genre?.replace(/_/g, ' ') ?? 'No genre'}</span>
                    <span>{creator.country ?? '—'}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs">
                    <span className="text-foreground font-medium">
                      {creator.assetCount ?? 0} assets
                    </span>
                    <span className="text-emerald-600 font-medium">
                      {formatCurrencyAmount(
                        Math.round(Number(creator.totalRevenue ?? 0) * 100),
                        creator.payoutCurrency ?? 'USD',
                      )}
                    </span>
                  </div>
                  {/* Payout Rail Badge */}
                  {creator.payoutRail && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                        {railLabels[creator.payoutRail] ?? creator.payoutRail}
                      </span>
                      {creator.payoutCurrency && (
                        <span className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {creator.payoutCurrency}
                        </span>
                      )}
                      {creator.language && (
                        <span className="inline-flex rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground uppercase">
                          {creator.language}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
