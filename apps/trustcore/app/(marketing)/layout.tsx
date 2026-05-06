/**
 * TrustCore — Marketing Layout
 *
 * Wraps the public marketing routes (/). No authentication required.
 * Minimal chrome: just a slim navigation bar with CTA.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'

export const metadata: Metadata = {
  title: 'TrustCore — Get Law 25 Compliant in 15 Minutes',
  description:
    'Set up, assess, and prove your privacy compliance under Quebec Law 25 — without legal complexity. Free to start.',
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Nav bar */}
      <nav className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <ShieldCheckIcon className="h-7 w-7 text-teal-600" />
            <span className="text-lg font-bold text-gray-900">TrustCore</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm text-gray-600 hover:text-gray-900 font-medium transition"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              className="text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-lg transition"
            >
              Start Free
            </Link>
          </div>
        </div>
      </nav>

      {children}

      {/* Footer */}
      <footer className="border-t border-gray-100 py-10 mt-24">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="h-5 w-5 text-teal-600" />
            <span className="text-sm font-semibold text-gray-700">TrustCore</span>
          </div>
          <p className="text-xs text-gray-400 text-center">
            Built for Quebec Law 25. Not legal advice — review with qualified counsel.
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <Link href="/onboarding" className="hover:text-gray-700 transition">Start Free</Link>
            <Link href="/dashboard" className="hover:text-gray-700 transition">Dashboard</Link>
          </div>
        </div>
      </footer>
    </>
  )
}
