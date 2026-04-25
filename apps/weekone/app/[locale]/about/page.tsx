import type { Metadata } from 'next'
import { MarketingSiteFooter } from '@/components/marketing/site-footer'
import { MarketingSiteNavigation } from '@/components/marketing/site-navigation'

export const metadata: Metadata = {
  title: 'About WeekOne',
  description: 'Why WeekOne exists: simple weekly systems for founders and operators.',
}

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params

  return (
    <main className="min-h-screen bg-white">
      <MarketingSiteNavigation locale={locale} />

      <section className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
        <h1 className="text-3xl font-bold text-navy sm:text-5xl">Built by operators, for teams that need execution confidence.</h1>
        <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base">
          <p>
            WeekOne exists because too many companies run every week without a trusted operating system. Meetings happen, tasks move,
            and yet outcomes still drift.
          </p>
          <p>
            We built WeekOne around one belief: simple systems beat chaos. Each week should begin with clarity, maintain operating
            signal, and close with accountable outcomes.
          </p>
          <p>
            WeekOne is designed for founders, operators, and stakeholder teams that need a shared execution narrative, not another
            disconnected productivity tool.
          </p>
        </div>
      </section>

      <MarketingSiteFooter locale={locale} />
    </main>
  )
}
