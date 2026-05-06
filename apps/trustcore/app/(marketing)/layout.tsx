/**
 * TrustCore — Marketing Layout
 */

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Badge, Container } from '@nzila/ui'
import { LanguageSwitcher } from '@/components/marketing/LanguageSwitcher'
import { TRUSTCORE_DEFAULT_LOCALE, type TrustcoreLocale } from '@/i18n'

const navItems = [
  { href: '/how-it-works', key: 'howItWorks' },
  { href: '/features', key: 'features' },
  { href: '/pricing', key: 'pricing' },
  { href: '/trust', key: 'trust' },
]

export const metadata: Metadata = {
  title: 'TrustCore — Get Law 25 Compliant in 15 Minutes',
  description:
    'Set up, assess, and prove your privacy compliance under Quebec Law 25 — without legal complexity. Free to start.',
}

const FRAME_CLASS = 'max-w-6xl px-5 sm:px-8 lg:px-10 xl:px-12'

function resolveLocale(rawLocale: string | undefined): TrustcoreLocale {
  if (rawLocale === 'en' || rawLocale === 'en-CA') return 'en-CA'
  if (rawLocale === 'fr' || rawLocale === 'fr-CA') return 'fr-CA'
  return TRUSTCORE_DEFAULT_LOCALE
}

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get('NEXT_LOCALE')?.value)
  const messages = await getMessages({ locale })

  const navLabels = {
    howItWorks: messages.nav?.howItWorks as string,
    features: messages.nav?.features as string,
    pricing: messages.nav?.pricing as string,
    trust: messages.nav?.trust as string,
    signIn: messages.nav?.signIn as string,
    startFree: messages.nav?.startFree as string,
    menu: messages.nav?.menu as string,
    footerTagline: messages.footer?.tagline as string,
    footerStartFree: messages.footer?.startFree as string,
    footerDashboard: messages.footer?.dashboard as string,
    footerBadge: messages.footer?.badge as string,
    footerCtaTitle: messages.footer?.ctaTitle as string,
    footerCtaDescription: messages.footer?.ctaDescription as string,
    footerCtaPrimary: messages.footer?.ctaPrimary as string,
    footerCtaSecondary: messages.footer?.ctaSecondary as string,
    footerSystemHeading: messages.footer?.systemHeading as string,
    footerSystemLink1: messages.footer?.systemLink1 as string,
    footerSystemLink2: messages.footer?.systemLink2 as string,
    footerSystemLink3: messages.footer?.systemLink3 as string,
    footerResourcesHeading: messages.footer?.resourcesHeading as string,
    footerResourcesLink1: messages.footer?.resourcesLink1 as string,
    footerResourcesLink2: messages.footer?.resourcesLink2 as string,
    footerResourcesLink3: messages.footer?.resourcesLink3 as string,
    footerLegalHeading: messages.footer?.legalHeading as string,
    footerLegalLink1: messages.footer?.legalLink1 as string,
    footerLegalLink2: messages.footer?.legalLink2 as string,
    footerLegalLink3: messages.footer?.legalLink3 as string,
    footerBadge1: messages.footer?.badge1 as string,
    footerBadge2: messages.footer?.badge2 as string,
    footerBadge3: messages.footer?.badge3 as string,
    footerBottom: messages.footer?.bottom as string,
    footerBuiltBy: messages.footer?.builtBy as string,
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <header className="sticky top-0 z-40 border-b border-gray-200/70 bg-white/85 backdrop-blur-xl">
        <Container size="lg" className={`h-16 flex items-center justify-between gap-4 ${FRAME_CLASS}`}>
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-slate-900 to-teal-700 text-white shadow-sm">
              <ShieldCheckIcon className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-base font-bold text-gray-900">TrustCore</p>
              <p className="text-[11px] text-gray-500">Nzila OS</p>
            </div>
            <Badge variant="accent" className="hidden lg:inline-flex">{navLabels.footerBadge}</Badge>
          </Link>

          <nav className="hidden md:flex items-center gap-5">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-gray-600 transition hover:text-teal-700"
              >
                {navLabels[item.key as keyof typeof navLabels] as string}
              </Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <LanguageSwitcher currentLocale={locale} />
            <Link href="/dashboard" className="text-sm font-medium text-gray-600 transition hover:text-gray-900">
              {navLabels.signIn}
            </Link>
            <Link
              href="/onboarding"
              className="inline-flex items-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {navLabels.startFree}
            </Link>
          </div>

          <details className="md:hidden group relative">
            <summary className="list-none cursor-pointer rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700">
              {navLabels.menu}
            </summary>
            <div className="absolute right-0 mt-2 w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
              <div className="flex flex-col gap-1">
                <div className="mb-2 px-2">
                  <LanguageSwitcher currentLocale={locale} />
                </div>
                {navItems.map((item) => (
                  <Link key={item.href} href={item.href} className="rounded-md px-2 py-2 text-sm text-gray-700 hover:bg-gray-50">
                    {navLabels[item.key as keyof typeof navLabels] as string}
                  </Link>
                ))}
                <Link href="/dashboard" className="rounded-md px-2 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  {navLabels.signIn}
                </Link>
                <Link href="/onboarding" className="mt-1 rounded-md bg-slate-900 px-2 py-2 text-center text-sm font-semibold text-white hover:bg-slate-800">
                  {navLabels.startFree}
                </Link>
              </div>
            </div>
          </details>
        </Container>
      </header>

      {children}

      <footer className="mt-24 border-t border-slate-200 bg-slate-950 text-slate-200">
        <div className="border-b border-white/10">
          <Container size="lg" className={`${FRAME_CLASS} py-10 sm:py-12`}>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <h3 className="text-2xl font-bold text-white sm:text-3xl">{navLabels.footerCtaTitle}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300 sm:text-base">{navLabels.footerCtaDescription}</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/onboarding"
                  className="inline-flex items-center justify-center rounded-xl bg-teal-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-400"
                >
                  {navLabels.footerCtaPrimary}
                </Link>
                <Link
                  href="/trust-center/sample"
                  className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {navLabels.footerCtaSecondary}
                </Link>
              </div>
            </div>
          </Container>
        </div>

        <Container size="lg" className={`${FRAME_CLASS} py-12 sm:py-14`}>
          <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5 lg:gap-8">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-white/15 to-teal-500/40">
                  <ShieldCheckIcon className="h-5 w-5 text-teal-200" />
                </div>
                <span className="text-lg font-bold text-white">TrustCore</span>
              </div>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">
                {navLabels.footerTagline}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                  {navLabels.footerBadge1}
                </span>
                <span className="inline-flex items-center rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-300">
                  {navLabels.footerBadge2}
                </span>
                <span className="inline-flex items-center rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-300">
                  {navLabels.footerBadge3}
                </span>
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{navLabels.footerSystemHeading}</p>
              <div className="space-y-2 text-sm">
                <Link href="/how-it-works" className="block text-slate-300 transition hover:text-white">{navLabels.footerSystemLink1}</Link>
                <Link href="/features" className="block text-slate-300 transition hover:text-white">{navLabels.footerSystemLink2}</Link>
                <Link href="/pricing" className="block text-slate-300 transition hover:text-white">{navLabels.footerSystemLink3}</Link>
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{navLabels.footerResourcesHeading}</p>
              <div className="space-y-2 text-sm">
                <Link href="/trust" className="block text-slate-300 transition hover:text-white">{navLabels.footerResourcesLink1}</Link>
                <Link href="/trust-center/sample" className="block text-slate-300 transition hover:text-white">{navLabels.footerResourcesLink2}</Link>
                <Link href="/dashboard" className="block text-slate-300 transition hover:text-white">{navLabels.footerResourcesLink3}</Link>
              </div>
            </div>

            <div>
              <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{navLabels.footerLegalHeading}</p>
              <div className="space-y-2 text-sm">
                <Link href="/legal/privacy" className="block text-slate-300 transition hover:text-white">{navLabels.footerLegalLink1}</Link>
                <Link href="/legal/terms" className="block text-slate-300 transition hover:text-white">{navLabels.footerLegalLink2}</Link>
                <Link href="/legal/security" className="block text-slate-300 transition hover:text-white">{navLabels.footerLegalLink3}</Link>
              </div>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-xs text-slate-400 sm:flex-row">
            <p>{navLabels.footerBottom}</p>
            <div className="flex items-center gap-3">
              <span>{navLabels.footerBuiltBy}</span>
              <span className="text-slate-600">|</span>
              <Link href="/onboarding" className="transition hover:text-white">{navLabels.footerStartFree}</Link>
              <Link href="/dashboard" className="transition hover:text-white">{navLabels.footerDashboard}</Link>
            </div>
          </div>
        </Container>
      </footer>
    </NextIntlClientProvider>
  )
}
