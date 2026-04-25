import type { Metadata } from 'next'
import Link from 'next/link'
import { MarketingSiteNavigation } from '@/components/marketing/site-navigation'
import { MarketingSiteFooter } from '@/components/marketing/site-footer'

export const metadata: Metadata = {
  title: 'WeekOne Resources | Guides for founder execution',
  description: 'Explore WeekOne resources including blog articles, changelog updates, and implementation content for stakeholder-ready execution.',
}

export default async function ResourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  const resourceCards = [
    {
      title: 'Execution guides',
      description: 'Practical operating guidance for founders and operators.',
      href: `/${locale}/blog`,
      cta: 'Read the blog',
    },
    {
      title: 'Product updates',
      description: 'Track shipped improvements and platform direction.',
      href: `/${locale}/changelog`,
      cta: 'View changelog',
    },
    {
      title: 'Pricing and rollout',
      description: 'Choose the right plan and launch your first weekly cycle.',
      href: `/${locale}/pricing`,
      cta: 'Explore pricing',
    },
    {
      title: 'Trust and security',
      description: 'Understand how WeekOne handles governance and data trust.',
      href: `/${locale}/security`,
      cta: 'See security',
    },
  ]

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <MarketingSiteNavigation locale={locale} />

      <section className="border-b border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-900 py-16 text-white sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-200">Resources</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-bold leading-tight sm:text-6xl">Content that helps teams execute with confidence.</h1>
          <p className="mt-5 max-w-2xl text-base text-slate-200 sm:text-lg">
            Everything founders and stakeholders need to understand the system, rollout path, and operating impact.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20">
        <div className="grid gap-4 md:grid-cols-2">
          {resourceCards.map((card) => (
            <article key={card.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-slate-900">{card.title}</h2>
              <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
              <Link href={card.href} className="mt-5 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-700">
                {card.cta}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <MarketingSiteFooter locale={locale} />
    </main>
  )
}
