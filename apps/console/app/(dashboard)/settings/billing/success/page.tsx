/**
 * Billing success page — shown after Stripe Checkout redirect.
 *
 * URL: /settings/billing/success?session_id=cs_xxx
 *
 * Verifies the checkout session and shows confirmation or redirects
 * back to /settings/billing if the session is still open / invalid.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import { headers } from 'next/headers'

interface PageProps {
  searchParams: Promise<{ session_id?: string }>
}

async function getSessionStatus(sessionId: string, baseUrl: string) {
  try {
    const res = await fetch(
      `${baseUrl}/api/stripe/checkout/session-status?session_id=${encodeURIComponent(sessionId)}`,
      {
        // Forward cookies so the server-side auth guard passes
        headers: { cookie: (await headers()).get('cookie') ?? '' },
        cache: 'no-store',
      },
    )
    if (!res.ok) return null
    return res.json() as Promise<{
      status: string
      paymentStatus: string
      subscriptionId: string | null
      subscriptionStatus: string | null
    }>
  } catch {
    return null
  }
}

export default async function BillingSuccessPage({ searchParams }: PageProps) {
  const { session_id: sessionId } = await searchParams

  if (!sessionId) {
    redirect('/settings/billing')
  }

  // Derive origin from request headers (works in Next.js server components)
  const headersList = await headers()
  const host = headersList.get('host') ?? 'localhost:3000'
  const proto = host.startsWith('localhost') ? 'http' : 'https'
  const baseUrl = `${proto}://${host}`

  const data = await getSessionStatus(sessionId, baseUrl)

  // If the session is still open (user abandoned checkout), go back
  if (!data || data.status === 'open' || data.status === 'expired') {
    redirect('/settings/billing')
  }

  const isSuccess = data.status === 'complete' && data.paymentStatus === 'paid'

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      {isSuccess ? (
        <>
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
            <CheckCircleIcon className="h-12 w-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription activated!</h1>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Your plan is now active.
            {data.subscriptionStatus && (
              <>
                {' '}
                Status: <span className="font-medium capitalize">{data.subscriptionStatus}</span>.
              </>
            )}
          </p>
          <div className="mt-8 flex gap-4">
            <Link
              href="/settings/billing"
              className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
            >
              View billing
            </Link>
            <Link
              href="/dashboard"
              className="rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Go to dashboard
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
            <ExclamationTriangleIcon className="h-12 w-12 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Payment pending</h1>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Your payment is processing. We&apos;ll activate your plan once it clears. Check your email
            for confirmation.
          </p>
          <Link
            href="/settings/billing"
            className="mt-8 rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back to billing
          </Link>
        </>
      )}
    </div>
  )
}
