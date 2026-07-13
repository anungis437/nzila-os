/**
 * Platform Admin — SAGE Phase 8A secure delivery surface
 *
 * The controlled external-access surface over immutable export packages: verified
 * recipients, delivery requests, independent approvals, active/revoked grants,
 * and durable delivery receipts. External recipients never receive workspace or
 * organization access — this page only surfaces delivery lifecycle state.
 *
 * All data is server-fetched, tenant-scoped, and authorization-filtered; a
 * missing / cross-org / denied workspace renders 404.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getPageOrgContext } from '../../../../lib/page-org-context'
import { ForbiddenPanel, OrgPickerPanel } from '../../../../lib/org-page-fallbacks'
import { getSageWorkspaceForScope } from '../../../../lib/sage/workspace-service'
import {
  listDeliveryGrantsForScope,
  listDeliveryRecipientsForScope,
  listDeliveryRequestsForScope,
} from '../../../../lib/sage/delivery-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'SAGE Secure Delivery | Platform Admin',
}

export default async function SageDeliveryPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ orgId?: string }>
}) {
  const [{ workspaceId }, sp, t] = await Promise.all([
    params,
    searchParams,
    getTranslations('sageDelivery'),
  ])
  const result = await getPageOrgContext(sp)
  if (result.status === 'unauthenticated') notFound()
  if (result.status === 'no-selection')
    return <OrgPickerPanel candidates={result.candidates} returnTo={`/sage/${workspaceId}/delivery`} />
  if (result.status === 'forbidden') return <ForbiddenPanel orgId={result.orgId} />

  const ctx = result.context
  const workspace = await getSageWorkspaceForScope(ctx, workspaceId)
  if (!workspace) notFound()

  const [recipients, requests, grants] = await Promise.all([
    listDeliveryRecipientsForScope(ctx, workspaceId),
    listDeliveryRequestsForScope(ctx, workspaceId),
    listDeliveryGrantsForScope(ctx, workspaceId),
  ])

  const requestRows = requests ?? []
  const grantRows = grants ?? []
  const activeGrants = grantRows.filter((g) => g.status === 'issued' || g.status === 'active')
  const closedGrants = grantRows.filter((g) => g.status === 'revoked' || g.status === 'expired')

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{workspace.name}</p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href={`/sage/${workspaceId}?orgId=${ctx.orgId}`} className="text-blue-600 hover:underline">
            Overview
          </Link>
          <Link href={`/sage/${workspaceId}/exports?orgId=${ctx.orgId}`} className="text-blue-600 hover:underline">
            Exports
          </Link>
        </nav>
      </div>

      <div role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        {t('intro')} {t('externalAccessRevocable')}
      </div>

      <section aria-labelledby="delivery-recipients">
        <h2 id="delivery-recipients" className="mb-2 text-sm font-semibold text-gray-800">
          {t('verifiedRecipient')}
        </h2>
        <ul className="divide-y rounded-md border text-sm">
          {(recipients ?? []).map((r) => (
            <li key={r.id} className="flex justify-between p-3">
              <span>{r.displayName}</span>
              <span className="text-gray-500">{r.verificationStatus}</span>
            </li>
          ))}
          {(recipients ?? []).length === 0 && <li className="p-3 text-gray-500">—</li>}
        </ul>
      </section>

      <section aria-labelledby="delivery-requests">
        <h2 id="delivery-requests" className="mb-2 text-sm font-semibold text-gray-800">
          {t('sections.requests')}
        </h2>
        <ul className="divide-y rounded-md border text-sm">
          {requestRows.map((r) => (
            <li key={r.id} className="flex justify-between p-3">
              <span>{r.id.slice(0, 12)}</span>
              <span className="text-gray-500">{r.status}</span>
            </li>
          ))}
          {requestRows.length === 0 && <li className="p-3 text-gray-500">—</li>}
        </ul>
      </section>

      <section aria-labelledby="delivery-grants">
        <h2 id="delivery-grants" className="mb-2 text-sm font-semibold text-gray-800">
          {t('sections.grants')}
        </h2>
        <ul className="divide-y rounded-md border text-sm">
          {activeGrants.map((g) => (
            <li key={g.id} className="flex justify-between p-3">
              <span>
                {g.id.slice(0, 12)} · {t('maxAccesses')}: {g.accessCount}/{g.maxAccesses}
              </span>
              <span className="text-gray-500">{g.status}</span>
            </li>
          ))}
          {activeGrants.length === 0 && <li className="p-3 text-gray-500">—</li>}
        </ul>
      </section>

      <section aria-labelledby="delivery-closed">
        <h2 id="delivery-closed" className="mb-2 text-sm font-semibold text-gray-800">
          {t('sections.revoked')}
        </h2>
        <ul className="divide-y rounded-md border text-sm">
          {closedGrants.map((g) => (
            <li key={g.id} className="flex justify-between p-3">
              <span>{g.id.slice(0, 12)}</span>
              <span className="text-gray-500">{g.status}</span>
            </li>
          ))}
          {closedGrants.length === 0 && <li className="p-3 text-gray-500">—</li>}
        </ul>
      </section>
    </main>
  )
}
