/**
 * TrustCore — Upgrade Button
 *
 * Client component that calls POST /api/billing/create-checkout-session
 * and redirects to the returned sessionUrl.
 */

'use client'

import { useState } from 'react'
import { SparklesIcon } from '@heroicons/react/24/outline'

interface UpgradeButtonProps {
  targetPlan: 'pro' | 'premium'
  label?: string
  className?: string
}

export function UpgradeButton({
  targetPlan,
  label = 'Upgrade to Pro',
  className = '',
}: UpgradeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUpgrade() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: targetPlan }),
      })
      const data = (await res.json()) as { success?: boolean; sessionUrl?: string; error?: string }
      if (!res.ok || !data.success) {
        setError(data.error ?? 'Something went wrong. Please try again.')
        return
      }
      if (data.sessionUrl) {
        window.location.href = data.sessionUrl
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleUpgrade}
        disabled={loading}
        className={`inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white text-sm font-semibold rounded-lg shadow hover:bg-teal-700 transition disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
      >
        {loading ? (
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        ) : (
          <SparklesIcon className="h-4 w-4" />
        )}
        {loading ? 'Loading…' : label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
