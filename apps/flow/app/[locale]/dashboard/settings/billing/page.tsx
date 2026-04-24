import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BillingClient } from './billing-client'

export default async function BillingSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  const { locale } = await params

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <div>
        <Link href={`/${locale}/dashboard/settings`} className="text-sm text-electric hover:underline">
          Back to settings
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-navy">Billing & Plan</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage subscription tier and review latest billing history.
        </p>
      </div>

      <BillingClient />

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-navy">Recent invoices</h2>
        <p className="mt-1 text-sm text-gray-600">
          Invoice history is available in your dashboard invoices module and export endpoints.
        </p>
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">
          To keep this release non-breaking, billing history reuses your existing invoice ledger until Stripe sync
          is enabled in production.
        </div>
      </section>
    </div>
  )
}
