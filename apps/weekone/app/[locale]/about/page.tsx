import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'About WeekOne',
  description: 'Why WeekOne exists: simple weekly systems for founders and operators.',
}

export default function AboutPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold text-navy sm:text-5xl">Built by an operator, for operators.</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground sm:text-base">
        <p>
          WeekOne exists because too many teams run the week without a trusted system of record. Meetings happen, tasks move,
          but execution drifts.
        </p>
        <p>
          We built WeekOne around one belief: simple systems beat chaos. Every Monday should start with clarity, accountability,
          and a clear growth move.
        </p>
        <p>
          This is not another generic task tool. WeekOne is a weekly execution system for founders and operators who want to ship,
          reduce noise, and build momentum with discipline.
        </p>
      </div>
    </main>
  )
}
