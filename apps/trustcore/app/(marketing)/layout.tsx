/**
 * TrustCore — Marketing Layout
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'
import { Badge, Container } from '@nzila/ui'

const navItems = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#trust', label: 'Trust' },
]

export const metadata: Metadata = {
  title: 'TrustCore — Get Law 25 Compliant in 15 Minutes',
  description:
    'Set up, assess, and prove your privacy compliance under Quebec Law 25 — without legal complexity. Free to start.',
}

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-40 border-b border-gray-200/70 bg-white/85 backdrop-blur-xl">
        <Container size="lg" className="h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-sm">
              <ShieldCheckIcon className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-base font-bold text-gray-900">TrustCore</p>
              <p className="text-[11px] text-gray-500">Nzila OS</p>
            </div>
            <Badge variant="accent" className="hidden lg:inline-flex">Law 25</Badge>
          </Link>

          <nav className="hidden md:flex items-center gap-5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-gray-600 transition hover:text-teal-700"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-medium text-gray-600 transition hover:text-gray-900">
              Sign in
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex items-center rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              Start Free
            </Link>
          </div>

          <details className="md:hidden group relative">
            <summary className="list-none cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700">
              Menu
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
              <div className="flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-md px-2 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    {item.label}
                  </Link>
                ))}
                <Link href="/dashboard" className="rounded-md px-2 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Sign in
                </Link>
                <Link href="/onboarding" className="mt-1 rounded-md bg-teal-600 px-2 py-2 text-center text-sm font-semibold text-white hover:bg-teal-700">
                  Start Free
                </Link>
              </div>
            </div>
          </details>
        </Container>
      </header>

      {children}

      <footer className="mt-24 border-t border-gray-200/80 py-12">
        <Container size="lg" className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-2">
            <ShieldCheckIcon className="h-5 w-5 text-teal-600" />
            <span className="text-sm font-semibold text-gray-700">TrustCore</span>
          </div>
          <p className="text-center text-xs text-gray-500">
            Built for Quebec Law 25. Not legal advice — review with qualified counsel.
          </p>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <Link href="/onboarding" className="hover:text-gray-800 transition">Start Free</Link>
            <Link href="/dashboard" className="hover:text-gray-800 transition">Dashboard</Link>
          </div>
        </Container>
      </footer>
    </>
  )
}
