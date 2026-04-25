import Link from 'next/link'

export function MarketingSiteFooter({ locale }: { locale: string }) {
  return (
    <footer className="bg-slate-950 pb-10 pt-12 text-slate-300">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-extrabold text-white">W1</span>
            <span className="text-lg font-semibold text-white">WeekOne</span>
          </div>
          <p className="mt-4 max-w-sm text-sm text-slate-300">
            The founder execution OS for teams that want calm, accountable weekly operations.
          </p>
          <div className="mt-5 flex items-center gap-2 text-xs">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 font-semibold text-emerald-300">Founder pilot active</span>
            <span className="rounded-full bg-blue-500/20 px-3 py-1 font-semibold text-blue-300">Canadian teams</span>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Product</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href={`/${locale}/platform`} className="transition hover:text-white">Platform</Link></li>
            <li><Link href={`/${locale}/how-it-works`} className="transition hover:text-white">How it works</Link></li>
            <li><Link href={`/${locale}/outcomes`} className="transition hover:text-white">Outcomes</Link></li>
            <li><Link href={`/${locale}/pricing`} className="transition hover:text-white">Pricing</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Company</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href={`/${locale}/about`} className="transition hover:text-white">About</Link></li>
            <li><Link href={`/${locale}/contact`} className="transition hover:text-white">Contact</Link></li>
            <li><Link href={`/${locale}/resources`} className="transition hover:text-white">Resources</Link></li>
            <li><Link href={`/${locale}/changelog`} className="transition hover:text-white">Changelog</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-white">Legal</h3>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href={`/${locale}/privacy`} className="transition hover:text-white">Privacy</Link></li>
            <li><Link href={`/${locale}/terms`} className="transition hover:text-white">Terms</Link></li>
            <li><Link href={`/${locale}/security`} className="transition hover:text-white">Security</Link></li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-white/10 px-4 pt-6 text-xs text-slate-400 sm:px-6">
        <p>© {new Date().getFullYear()} WeekOne. Built for founder-led teams in Canada and beyond.</p>
      </div>
    </footer>
  )
}
