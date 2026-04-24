import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WeekOne Privacy Policy',
  description: 'How WeekOne handles data, analytics, and account information.',
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="text-3xl font-bold text-navy sm:text-5xl">Privacy Policy</h1>
      <div className="mt-6 space-y-4 text-sm leading-7 text-muted-foreground">
        <p>WeekOne collects account data, usage telemetry, and operational inputs to deliver the product experience.</p>
        <p>We do not sell customer data. Analytics events are used to improve onboarding, pricing, and weekly execution flows.</p>
        <p>Customers can request account export and deletion via support channels.</p>
      </div>
    </main>
  )
}
