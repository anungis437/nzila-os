/**
 * Platform Admin — SAGE workspace overview
 *
 * Shows workspace identity, institution context, boundary posture, status, and
 * counts-only summary. No raw JSON, no audit internals, no score/rank/grade/
 * certification, and no conclusions inferred from counts.
 */
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getPageOrgContext } from '../../../lib/page-org-context'
import { ForbiddenPanel, OrgPickerPanel } from '../../../lib/org-page-fallbacks'
import {
  getSageWorkspaceForScope,
  getSageWorkspaceSummaryForScope,
} from '../../../lib/sage/workspace-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'SAGE Workspace | Platform Admin',
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function BoundaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-gray-400">—</p>
      ) : (
        <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-gray-600">
          {items.map((item) => (
            <li key={item}>{humanize(item)}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-2xl font-semibold text-gray-900">{value}</div>
      <div className="mt-1 text-xs text-gray-500">{label}</div>
    </div>
  )
}

export default async function SageWorkspaceOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ orgId?: string }>
}) {
  const [{ workspaceId }, sp, t] = await Promise.all([
    params,
    searchParams,
    getTranslations('sage'),
  ])
  const result = await getPageOrgContext(sp)

  if (result.status === 'unauthenticated') redirect('/sign-in')
  if (result.status === 'no-selection') {
    return <OrgPickerPanel candidates={result.candidates} returnTo={`/sage/${workspaceId}`} />
  }
  if (result.status === 'forbidden') {
    return <ForbiddenPanel orgId={result.orgId} />
  }

  const scope = {
    actorId: result.context.actorId,
    orgId: result.context.orgId,
    orgRole: result.context.orgRole,
  }
  const [detail, summary] = await Promise.all([
    getSageWorkspaceForScope(scope, workspaceId),
    getSageWorkspaceSummaryForScope(scope, workspaceId),
  ])

  // Non-disclosure: missing or cross-org workspace renders a 404.
  if (!detail || !summary) notFound()

  return (
    <div className="space-y-8 p-6">
      <div>
        <Link href="/sage" className="text-sm text-gray-400 hover:text-gray-600">
          ← {t('pageTitle')}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{detail.name}</h1>
      </div>

      <section aria-labelledby="sage-identity-heading" className="space-y-3">
        <h2 id="sage-identity-heading" className="text-lg font-semibold text-gray-900">
          {t('sections.identity')}
        </h2>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('institutionType')}</dt>
            <dd className="text-sm text-gray-700">{humanize(detail.institutionType)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('riskSurface')}</dt>
            <dd className="text-sm text-gray-700">{humanize(detail.riskSurface)}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-400">{t('status')}</dt>
            <dd className="text-sm text-gray-700">{humanize(detail.status)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="sage-boundary-heading" className="space-y-3">
        <h2 id="sage-boundary-heading" className="text-lg font-semibold text-gray-900">
          {t('sections.boundaryProfile')}
        </h2>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <BoundaryList title={t('boundary.prohibitedUses')} items={detail.boundaryProfile.prohibitedUses} />
          <BoundaryList
            title={t('boundary.excludedSourceClasses')}
            items={detail.boundaryProfile.excludedSourceClasses}
          />
          <BoundaryList title={t('boundary.requiredReviewers')} items={detail.boundaryProfile.requiredReviewers} />
          <BoundaryList
            title={t('boundary.exportRestrictions')}
            items={detail.boundaryProfile.exportRestrictions}
          />
        </div>
      </section>

      <section aria-labelledby="sage-counts-heading" className="space-y-3">
        <h2 id="sage-counts-heading" className="text-lg font-semibold text-gray-900">
          {t('sections.counts')}
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <CountCard label={t('counts.evidenceSources')} value={summary.counts.evidenceSources} />
          <CountCard label={t('counts.evidenceItems')} value={summary.counts.evidenceItems} />
          <CountCard label={t('counts.boundaryFlags')} value={summary.counts.boundaryFlags} />
          <CountCard label={t('counts.decisionRecords')} value={summary.counts.decisionRecords} />
          <CountCard label={t('counts.openExportRequests')} value={summary.counts.openExportRequests} />
        </div>
      </section>
    </div>
  )
}
