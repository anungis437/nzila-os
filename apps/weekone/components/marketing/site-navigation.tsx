import Link from 'next/link'

export function MarketingSiteNavigation({ locale }: { locale: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-extrabold text-white">W1</span>
          <span className="text-sm font-bold tracking-wide text-slate-900">WeekOne</span>
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex">
          <Link href={`/${locale}/platform`} className="transition hover:text-slate-900">Platform</Link>
          <Link href={`/${locale}/how-it-works`} className="transition hover:text-slate-900">How it works</Link>
          <Link href={`/${locale}/outcomes`} className="transition hover:text-slate-900">Outcomes</Link>
          <Link href={`/${locale}/pricing`} className="transition hover:text-slate-900">Pricing</Link>
          <Link href={`/${locale}/faq`} className="transition hover:text-slate-900">FAQ</Link>
          <Link href={`/${locale}/resources`} className="transition hover:text-slate-900">Resources</Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={`/${locale}/sign-in`}
            className="hidden rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
          >
            Sign in
          </Link>
          <Link
            href={`/${locale}/onboarding`}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700"
          >
            Start free
          </Link>
        </div>
      </div>
    </header>
  )
}
