/**
 * TrustCore — Billing Status Banner
 *
 * Client component that reads ?success=1 or ?canceled=1 from the URL
 * (set by Stripe redirect) and displays an appropriate banner.
 * Fires upgrade_completed analytics event on success.
 */

'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { trackEvent } from '@/lib/analytics/track'

export function BillingStatusBanner() {
  const params = useSearchParams()
  const success = params.get('success')
  const canceled = params.get('canceled')

  useEffect(() => {
    if (success === '1') {
      trackEvent('upgrade_completed', {})
    }
  }, [success])

  if (success === '1') {
    return (
      <div className="mb-6 flex items-start gap-3 px-5 py-4 bg-teal-50 border border-teal-200 rounded-xl">
        <CheckCircleIcon className="h-5 w-5 text-teal-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-teal-800 text-sm">You&apos;re now on Pro 🎉</p>
          <p className="text-xs text-teal-600 mt-0.5">
            Export buttons, your Trust Center, and unlimited reminders are now active.
          </p>
        </div>
      </div>
    )
  }

  if (canceled === '1') {
    return (
      <div className="mb-6 flex items-start gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl">
        <XCircleIcon className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
        <div>
          <p className="font-semibold text-amber-800 text-sm">Upgrade canceled</p>
          <p className="text-xs text-amber-600 mt-0.5">
            No charge was made. You can upgrade anytime from this page.
          </p>
        </div>
      </div>
    )
  }

  return null
}
