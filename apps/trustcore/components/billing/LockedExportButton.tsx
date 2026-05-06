/**
 * TrustCore — Locked Export Button
 *
 * Renders a disabled-looking export button that opens the UpgradeModal
 * when clicked. Used wherever a feature is gated behind Pro/Premium.
 *
 * 'use client' — modal state must be client-side.
 */

'use client'

import { useState } from 'react'
import { LockClosedIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { UpgradeModal } from '@/components/billing/UpgradeModal'
import { trackEvent } from '@/lib/analytics/track'
import type { AnalyticsEvent } from '@/lib/analytics/track'

type LockedFeature = 'audit_export' | 'evidence_export' | 'trust_center'

interface LockedExportButtonProps {
  label: string
  feature: LockedFeature
  trackAs?: AnalyticsEvent
}

export function LockedExportButton({ label, feature, trackAs = 'export_attempt_blocked' }: LockedExportButtonProps) {
  const [modalOpen, setModalOpen] = useState(false)

  function handleClick() {
    trackEvent(trackAs, { feature })
    setModalOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-gray-200 rounded-lg text-gray-500 bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
        title="Upgrade to Pro to unlock this feature"
      >
        <LockClosedIcon className="h-4 w-4 text-amber-500 shrink-0" />
        <ArrowDownTrayIcon className="h-4 w-4 shrink-0" />
        {label}
      </button>

      <UpgradeModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        feature={feature}
      />
    </>
  )
}
