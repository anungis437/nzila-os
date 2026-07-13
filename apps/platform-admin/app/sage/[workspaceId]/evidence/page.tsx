/**
 * Platform Admin — SAGE evidence workspace
 *
 * The first operational SAGE evidence surface: register a source, classify it,
 * create evidence items under a classified source, and link an item. All data is
 * server-fetched through the durable SAGE service (authorization-filtered,
 * tenant-scoped); a missing / cross-org / access-denied workspace renders a 404.
 *
 * The page shows only factual attributes and lifecycle *state* — never a score,
 * rank, grade, certification, availability claim, or conclusion.
 */
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import {
  SAGE_AUTHORIZATION_LEVELS,
  SAGE_CONFIDENCE_LEVELS,
  SAGE_SOURCE_QUALITIES,
  SAGE_SOURCE_TYPES,
} from '@nzila/sage-core'
import { getPageOrgContext } from '../../../../lib/page-org-context'
import { ForbiddenPanel, OrgPickerPanel } from '../../../../lib/org-page-fallbacks'
import { canWrite } from '../../../../lib/org-scope-guard'
import { getSageWorkspaceForScope } from '../../../../lib/sage/workspace-service'
import {
  listSageEvidenceItemsForScope,
  listSageEvidenceSourcesForScope,
} from '../../../../lib/sage/evidence-service'
import { CreateSourceForm } from '../../components/evidence/create-source-form'
import { SourceList } from '../../components/evidence/source-list'
import { CreateItemForm } from '../../components/evidence/create-item-form'
import { ItemList } from '../../components/evidence/item-list'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'SAGE Evidence | Platform Admin',
}

export default async function SageEvidencePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ orgId?: string }>
}) {
  const [{ workspaceId }, sp, t] = await Promise.all([
    params,
    searchParams,
    getTranslations('sageEvidence'),
  ])
  const result = await getPageOrgContext(sp)

  if (result.status === 'unauthenticated') redirect('/sign-in')
  if (result.status === 'no-selection') {
    return (
      <OrgPickerPanel candidates={result.candidates} returnTo={`/sage/${workspaceId}/evidence`} />
    )
  }
  if (result.status === 'forbidden') {
    return <ForbiddenPanel orgId={result.orgId} />
  }

  const scope = {
    actorId: result.context.actorId,
    orgId: result.context.orgId,
    orgRole: result.context.orgRole,
  }

  const detail = await getSageWorkspaceForScope(scope, workspaceId)
  if (!detail) notFound()

  const [sourceList, itemList] = await Promise.all([
    listSageEvidenceSourcesForScope(scope, workspaceId),
    listSageEvidenceItemsForScope(scope, workspaceId),
  ])
  // Non-disclosure: if the actor cannot read this workspace's evidence at all,
  // render a 404 rather than an empty page that confirms the workspace exists.
  if (!sourceList || !itemList) notFound()

  const canContribute = canWrite(scope.orgRole)
  const sources = sourceList.sources
  const items = itemList.items
  const classifiedSources = sources.filter((s) => s.classified)

  return (
    <div className="space-y-8 p-6">
      <div>
        <Link
          href={`/sage/${workspaceId}`}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ← {detail.name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">{t('pageTitle')}</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">{t('pageDescription')}</p>
        <Link
          href={`/sage/${workspaceId}/governance`}
          className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {t('governanceTab')} →
        </Link>
        <Link
          href={`/sage/${workspaceId}/exports`}
          className="mt-2 ml-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          {t('exportsTab')} →
        </Link>
      </div>

      <section aria-labelledby="sage-sources-heading" className="space-y-4">
        <h2 id="sage-sources-heading" className="text-lg font-semibold text-gray-900">
          {t('sourcesHeading')}
        </h2>
        {canContribute && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <CreateSourceForm
              orgId={scope.orgId}
              workspaceId={workspaceId}
              sourceTypes={SAGE_SOURCE_TYPES}
            />
          </div>
        )}
        <SourceList
          orgId={scope.orgId}
          workspaceId={workspaceId}
          sources={sources}
          canContribute={canContribute}
          sourceQualities={SAGE_SOURCE_QUALITIES}
          authorizationLevels={SAGE_AUTHORIZATION_LEVELS}
        />
      </section>

      <section aria-labelledby="sage-items-heading" className="space-y-4">
        <h2 id="sage-items-heading" className="text-lg font-semibold text-gray-900">
          {t('itemsHeading')}
        </h2>
        {canContribute && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <CreateItemForm
              orgId={scope.orgId}
              workspaceId={workspaceId}
              classifiedSources={classifiedSources}
              confidenceLevels={SAGE_CONFIDENCE_LEVELS}
            />
          </div>
        )}
        <ItemList
          orgId={scope.orgId}
          workspaceId={workspaceId}
          items={items}
          canContribute={canContribute}
        />
      </section>
    </div>
  )
}
