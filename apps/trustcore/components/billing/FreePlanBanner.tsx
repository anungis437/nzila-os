/**
 * TrustCore — Free Plan Banner
 *
 * Shown on the dashboard when the org is on the FREE plan.
 * Prompts upgrade to unlock audit reports and Trust Center.
 */

'use client'

import { SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useState } from 'react'
import Link from 'next/link'

export function FreePlanBanner() {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  return (
    <div className="flex items-center justify-between gap-4 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-6">
      <div className="flex items-center gap-3">
        <SparklesIcon className="h-5 w-5 text-amber-600 shrink-0" />
        <p className="text-sm font-medium text-amber-800">
          You&apos;re on the Free plan.{' '}
          <span className="text-amber-700 font-normal">
            Unlock audit reports, evidence bundles, and your public Trust Center.
          </span>
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <Link
          href="/billing"
          className="text-sm font-semibold text-amber-800 underline hover:text-amber-900"
        >
          Upgrade to Pro
        </Link>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="text-amber-500 hover:text-amber-700"
          aria-label="Dismiss"
        >
          <XMarkIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
