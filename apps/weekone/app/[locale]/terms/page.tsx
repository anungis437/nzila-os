import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WeekOne Terms of Service',
  description: 'Terms governing access and use of WeekOne.',
}

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold text-navy sm:text-5xl">Terms of Service</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
        <p>By using WeekOne, you agree to operate within lawful business and data practices.</p>
        <p>Subscription plans can be changed or canceled according to plan terms shown at checkout.</p>
        <p>WeekOne is provided as-is with commercially reasonable uptime and support commitments.</p>
      </div>
    </main>
  )
}
