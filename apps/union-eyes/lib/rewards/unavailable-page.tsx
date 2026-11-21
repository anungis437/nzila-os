import Link from 'next/link'
import { redirect } from 'next/navigation'
import { hasMinRole } from '@/lib/api-auth-guard'
import { resolveOrgContext } from '@/lib/resolve-org'

/** Existing routes remain truthful while their institutional credit authority
 * is deferred. This page performs no wallet, budget or provider operation. */
export async function RewardsUnavailablePage({
  params,
  administrator = false,
}: {
  params: Promise<{ locale: string }>
  administrator?: boolean
}) {
  const { locale } = await params
  return resolveOrgContext({}, async () => {
    if (administrator && !(await hasMinRole('admin'))) redirect(`/${locale}/dashboard`)
    const french = locale === 'fr'
    return (
      <main className="container mx-auto max-w-3xl space-y-4 py-8">
        <h1 className="text-2xl font-bold">
          {french ? 'Crédits de reconnaissance indisponibles' : 'Recognition credits unavailable'}
        </h1>
        <p>
          {french
            ? 'Les crédits, portefeuilles, budgets, échanges et automatisations sont indisponibles dans la version actuelle, en attente de leur autorité institutionnelle consignée.'
            : 'Credits, wallets, budgets, redemption and automation are unavailable in the current release, pending their recorded institutional authority.'}
        </p>
        <p>
          {french
            ? 'Vous pouvez proposer un collègue avec un message de reconnaissance. Une proposition ne crée aucun crédit ni paiement.'
            : 'You can nominate a colleague with a recognition message. A nomination creates no credit or payment.'}
        </p>
        <Link className="underline" href={`/${locale}/dashboard/rewards/recognition`}>
          {french ? 'Reconnaître un collègue' : 'Recognize a colleague'}
        </Link>
      </main>
    )
  })
}
