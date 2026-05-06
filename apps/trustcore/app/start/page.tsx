/**
 * TrustCore — Lead Capture Start Page
 *
 * /start
 *
 * Lightweight pre-onboarding email capture (soft gate).
 * Email input is OPTIONAL — "Continue" always proceeds to /onboarding.
 *
 * On submit:
 *   1. POST /api/leads (fire-and-forget if email provided)
 *   2. Store email in localStorage for lead-conversion on onboarding complete
 *   3. Navigate to /onboarding
 *
 * No auth required — this is the public entry point for new users.
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheckIcon, ArrowRightIcon } from '@heroicons/react/24/outline'
import { trackEvent } from '@/lib/analytics/track'

const LEAD_EMAIL_KEY = 'tc_lead_email'

export default function StartPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const trimmedEmail = email.trim()

    if (trimmedEmail) {
      // Basic client-side format check before firing API
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailPattern.test(trimmedEmail)) {
        setError('Please enter a valid email address.')
        setLoading(false)
        return
      }

      // Store for lead-conversion after onboarding completes
      try {
        localStorage.setItem(LEAD_EMAIL_KEY, trimmedEmail)
      } catch {
        // ignore storage errors
      }

      // Fire-and-forget lead capture — never block navigation on failure
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, source: 'landing' }),
      }).catch(() => {
        // silent — lead capture should never break the funnel
      })

      trackEvent('lead_captured', { source: 'landing' })
    }

    router.push('/onboarding')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-indigo-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 w-full max-w-md p-8">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 bg-teal-50 border border-teal-100 rounded-2xl flex items-center justify-center">
              <ShieldCheckIcon className="h-8 w-8 text-teal-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Get Law 25 compliant in 15 minutes
          </h1>
          <p className="text-sm text-gray-500">
            We&apos;ll send your compliance score and next steps to your inbox.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleContinue} noValidate>
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              Work email{' '}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 placeholder-gray-400"
            />
            {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-6 py-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-semibold rounded-xl transition text-sm"
          >
            {loading ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <ArrowRightIcon className="h-4 w-4" />
            )}
            {loading ? 'Starting…' : 'Continue to setup'}
          </button>

          <p className="mt-3 text-center text-xs text-gray-400">
            No credit card required. Free to start.
          </p>
        </form>

        {/* Trust signals */}
        <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-sm font-bold text-gray-800">15 min</p>
            <p className="text-xs text-gray-500">to complete setup</p>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Quebec Law 25</p>
            <p className="text-xs text-gray-500">fully covered</p>
          </div>
        </div>
      </div>
    </div>
  )
}
