import { AppLayout } from '@/components/layout/app-layout'
import { BillingCheckoutClient } from './ui-client'

export default async function WeekoneBillingPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Billing</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upgrade faster with annual pricing, optional coupon support, and instant checkout.
          </p>
        </div>

        <BillingCheckoutClient locale={locale} />
      </div>
    </AppLayout>
  )
}
