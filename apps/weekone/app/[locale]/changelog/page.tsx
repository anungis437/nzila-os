import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WeekOne Changelog',
  description: 'Public product updates and launch progress for WeekOne.',
}

const entries = [
  {
    date: '2026-04-23',
    title: 'Launch marketing stack and pricing funnel',
    notes: 'New homepage funnel, pricing page, growth lead capture flows, and analytics wiring for CTAs.',
  },
  {
    date: '2026-04-18',
    title: 'Billing settings and Stripe webhook support',
    notes: 'Added billing checkout API, settings billing page, and subscription webhook persistence.',
  },
  {
    date: '2026-04-12',
    title: 'Monday reset and founder templates',
    notes: 'Added Monday reset flow and reusable weekly template presets.',
  },
]

export default function ChangelogPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold text-navy sm:text-5xl">Changelog</h1>
      <p className="mt-3 text-sm text-muted-foreground">Transparent product updates as WeekOne evolves.</p>

      <div className="mt-8 space-y-4">
        {entries.map((entry) => (
          <article key={entry.date} className="rounded-xl border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-electric">{entry.date}</p>
            <h2 className="mt-1 text-lg font-semibold text-navy">{entry.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{entry.notes}</p>
          </article>
        ))}
      </div>
    </main>
  )
}
