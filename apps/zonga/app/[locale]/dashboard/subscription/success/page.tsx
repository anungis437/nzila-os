/**
 * Zonga — Subscription Success Page.
 *
 * Shown after a successful Stripe Checkout for premium or label plans.
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card } from '@nzila/ui'

export default async function SubscriptionSuccessPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const { locale } = await params

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card>
        <div className="p-12 text-center max-w-md">
          <div className="text-6xl mb-6">🎉</div>
          <h1 className="text-2xl font-bold text-foreground mb-3">
            Welcome to Premium!
          </h1>
          <p className="text-muted-foreground mb-8">
            Your subscription is now active. Enjoy ad-free streaming, offline
            downloads, hi-fi audio, and exclusive releases.
          </p>

          <div className="space-y-3">
            <Link
              href={`/${locale}/dashboard/listener`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-electric px-6 py-3 text-sm font-semibold text-white hover:bg-electric/90 transition-colors"
            >
              🎧 Start Listening
            </Link>
            <Link
              href={`/${locale}/dashboard/subscription`}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-6 py-3 text-sm font-medium text-foreground hover:bg-muted/50 transition-colors"
            >
              Manage Subscription
            </Link>
          </div>
        </div>
      </Card>
    </div>
  )
}
