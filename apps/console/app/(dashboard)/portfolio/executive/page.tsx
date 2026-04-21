import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@nzila/platform-auth/entra/server'

export const dynamic = 'force-dynamic'

const AGENTS = [
  {
    href: '/portfolio/executive/allocator',
    title: 'Portfolio Allocator',
    tagline: 'Initiative balance, ownership, zone coverage.',
    domain: 'portfolio',
  },
  {
    href: '/portfolio/executive/pmo',
    title: 'PMO',
    tagline: 'Every initiative has an owner, a due date, visible progress.',
    domain: 'portfolio',
  },
  {
    href: '/portfolio/executive/product',
    title: 'Product Strategy',
    tagline: 'Product health, shipment cadence, bug load.',
    domain: 'portfolio',
  },
  {
    href: '/portfolio/executive/hiring',
    title: 'Hiring',
    tagline: 'Open roles, pipeline health, application SLA.',
    domain: 'people',
  },
] as const

export default async function PortfolioExecutiveHub() {
  const user = await currentUser()
  if (!user) redirect('/sign-in')

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold text-slate-900">Portfolio — Executive</h1>
        <p className="mt-2 text-sm text-slate-600">Portfolio, PMO, Product, and People agents. Live data, human-in-the-loop.</p>
      </header>
      <nav className="mb-6 flex flex-wrap gap-2 text-xs">
        <Link href="/chief-of-staff/synthesis" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Chief of Staff v2</Link>
        <Link href="/ops/coo" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">COO</Link>
        <Link href="/actions" className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-slate-700 hover:bg-slate-50">Actions queue</Link>
      </nav>
      <ul className="grid gap-3 md:grid-cols-2">
        {AGENTS.map((a) => (
          <li key={a.href}>
            <Link href={a.href} className="block rounded-lg border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900">{a.title}</h2>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-600">{a.domain}</span>
              </div>
              <p className="mt-2 text-sm text-slate-600">{a.tagline}</p>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
