/**
 * TrustCore — Upgrade Modal
 *
 * High-conversion upgrade prompt triggered from locked feature surfaces:
 *   - export buttons (audit report, evidence bundle)
 *   - trust center when locked
 *
 * Usage:
 *   const [open, setOpen] = useState(false)
 *   <UpgradeModal open={open} onClose={() => setOpen(false)} feature="audit_export" />
 */

'use client'

import { useEffect } from 'react'
import {
  SparklesIcon,
  XMarkIcon,
  DocumentTextIcon,
  ArchiveBoxIcon,
  GlobeAltIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline'
import { UpgradeButton } from './UpgradeButton'
import { trackEvent } from '@/lib/analytics/track'

type LockedFeature = 'audit_export' | 'evidence_export' | 'trust_center'

interface UpgradeModalProps {
  open: boolean
  onClose: () => void
  feature?: LockedFeature
}

const FEATURE_HEADLINES: Record<LockedFeature, string> = {
  audit_export: 'Unlock your compliance report',
  evidence_export: 'Unlock your evidence bundle',
  trust_center: 'Unlock your Trust Center',
}

const FEATURE_DESCRIPTIONS: Record<LockedFeature, string> = {
  audit_export:
    'Download a structured audit report you can share with customers, regulators, or legal counsel.',
  evidence_export:
    'Export a complete evidence package — all compliance actions, with timestamps and actor attribution.',
  trust_center:
    'Publish a shareable public page that proves your Law 25 compliance to customers and partners.',
}

const UNLOCK_ITEMS = [
  { icon: DocumentTextIcon, label: 'Audit report — PDF + JSON' },
  { icon: ArchiveBoxIcon, label: 'Evidence bundle export' },
  { icon: GlobeAltIcon, label: 'Public Trust Center page' },
  { icon: BellAlertIcon, label: 'Unlimited compliance reminders' },
]

export function UpgradeModal({ open, onClose, feature = 'audit_export' }: UpgradeModalProps) {
  // Track modal open
  useEffect(() => {
    if (open) {
      trackEvent('upgrade_modal_opened', { feature })
    }
  }, [open, feature])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (open) document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 relative animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition"
          aria-label="Close"
        >
          <XMarkIcon className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="h-14 w-14 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center">
            <SparklesIcon className="h-8 w-8 text-teal-600" />
          </div>
        </div>

        {/* Headline */}
        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">
          {FEATURE_HEADLINES[feature]}
        </h2>
        <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
          {FEATURE_DESCRIPTIONS[feature]}
        </p>

        {/* Unlock items */}
        <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-teal-800 uppercase tracking-wide mb-3">
            Pro unlocks:
          </p>
          <ul className="space-y-2">
            {UNLOCK_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <li key={item.label} className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-teal-600 shrink-0" />
                  <span className="text-sm text-teal-800">{item.label}</span>
                </li>
              )
            })}
          </ul>
        </div>

        {/* Pricing hint */}
        <div className="text-center mb-5">
          <p className="text-2xl font-black text-gray-900 mb-0.5">$49<span className="text-base font-medium text-gray-400">/month</span></p>
          <p className="text-xs text-gray-400">No contracts. Cancel anytime. Upgrade or downgrade at any time.</p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3">
          <UpgradeButton
            targetPlan="pro"
            label="Upgrade to Pro — $49/month"
            className="w-full justify-center"
          />
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 border border-gray-200 text-gray-600 font-medium rounded-xl hover:bg-gray-50 transition text-sm"
          >
            Continue with Free
          </button>
        </div>
      </div>
    </div>
  )
}
