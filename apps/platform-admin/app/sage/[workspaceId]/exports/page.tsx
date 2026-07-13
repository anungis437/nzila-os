/**
 * Platform Admin — SAGE controlled exports (Phase 7)
 *
 * The internal export-control surface: request an export over an explicit
 * evidence/governance scope, independently approve/deny another user's request,
 * and generate one immutable internal package. EXTERNAL DELIVERY IS DISABLED —
 * there is no recipient, public link, email, webhook, or transmission control.
 *
 * All data is server-fetched, tenant-scoped, and authorization-filtered; a
 * missing / cross-org / denied workspace renders 404.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { SAGE_EXPORT_PACKAGE_TYPES } from '@nzila/sage-core'
import { getPageOrgContext } from '../../../../lib/page-org-context'
import { ForbiddenPanel, OrgPickerPanel } from '../../../../lib/org-page-fallbacks'
import { canWrite } from '../../../../lib/org-scope-guard'
import { getSageWorkspaceForScope } from '../../../../lib/sage/workspace-service'
import { listSageEvidenceItemsForScope } from '../../../../lib/sage/evidence-service'
import {
  listSageBoundaryFlagsForScope,
  listSageDecisionRecordsForScope,
  listSageReviewNotesForScope,
} from '../../../../lib/sage/governance-service'
import {
  listSageExportPackagesForScope,
  listSageExportRequestsForScope,
} from '../../../../lib/sage/export-service'
import {
  CreateExportRequestForm,
  type ExportResourceOption,
} from '../../components/exports/create-export-request-form'
import { ExportRequestList } from '../../components/exports/export-request-list'
import { ExportPackageList } from '../../components/exports/export-package-list'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'SAGE Controlled Exports | Platform Admin',
}

export default async function SageExportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ orgId?: string }>
}) {
  const [{ workspaceId }, sp, t] = await Promise.all([
    params,
    searchParams,
    getTranslations('sageExports'),
  ])
  const result = await getPageOrgContext(sp)
  if (result.status === 'unauthenticated') notFound()
  if (result.status === 'no-selection') return <OrgPickerPanel candidates={result.candidates} returnTo={`/sage/${workspaceId}/exports`} />
  if (result.status === 'forbidden') return <ForbiddenPanel orgId={result.orgId} />

  const ctx = result.context
  const workspace = await getSageWorkspaceForScope(ctx, workspaceId)
  if (!workspace) notFound()

  const [items, flags, notes, decisions, requests, packages] = await Promise.all([
    listSageEvidenceItemsForScope(ctx, workspaceId),
    listSageBoundaryFlagsForScope(ctx, workspaceId),
    listSageReviewNotesForScope(ctx, workspaceId),
    listSageDecisionRecordsForScope(ctx, workspaceId),
    listSageExportRequestsForScope(ctx, workspaceId),
    listSageExportPackagesForScope(ctx, workspaceId),
  ])

  const evidenceOptions: ExportResourceOption[] = (items?.items ?? [])
    .filter((i) => !i.excludedFromExternalReview)
    .map((i) => ({ id: i.id, label: `Evidence ${i.id.slice(0, 8)} (${i.lifecycleState})`, authorizationLevel: i.lifecycleState }))
  const flagOptions: ExportResourceOption[] = (flags?.flags ?? [])
    .filter((f) => f.authorizationLevel !== 'excluded')
    .map((f) => ({ id: f.id, label: `Flag ${f.flagType} ${f.id.slice(0, 8)}`, authorizationLevel: f.authorizationLevel }))
  const noteOptions: ExportResourceOption[] = (notes?.notes ?? [])
    .filter((n) => n.authorizationLevel !== 'excluded')
    .map((n) => ({ id: n.id, label: `Note ${n.noteType} ${n.id.slice(0, 8)}`, authorizationLevel: n.authorizationLevel }))
  const decisionOptions: ExportResourceOption[] = (decisions?.decisions ?? [])
    .filter((d) => d.authorizationLevel !== 'excluded' && !d.excludedFromExternalReview)
    .map((d) => ({ id: d.id, label: `Decision ${d.id.slice(0, 8)}`, authorizationLevel: d.authorizationLevel }))

  const requestRows = requests?.requests ?? []
  const packageRows = packages?.packages ?? []
  const packagedRequestIds = new Set(packageRows.map((p) => p.exportRequestId))
  const generatableRequestIds = requestRows
    .filter((r) => r.status === 'approved' && !packagedRequestIds.has(r.id))
    .map((r) => r.id)

  const canApprove = canWrite(ctx.orgRole)

  return (
    <main className="mx-auto max-w-5xl space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{t('title')}</h1>
          <p className="text-sm text-gray-500">{workspace.name}</p>
        </div>
        <nav className="flex gap-3 text-sm">
          <Link href={`/sage/${workspaceId}?orgId=${ctx.orgId}`} className="text-blue-600 hover:underline">
            {t('nav.overview')}
          </Link>
          <Link href={`/sage/${workspaceId}/evidence?orgId=${ctx.orgId}`} className="text-blue-600 hover:underline">
            {t('nav.evidence')}
          </Link>
          <Link href={`/sage/${workspaceId}/governance?orgId=${ctx.orgId}`} className="text-blue-600 hover:underline">
            {t('nav.governance')}
          </Link>
        </nav>
      </div>

      {/* Explicit, non-color banner: internal generation only. */}
      <div role="note" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        {t('internalOnlyBanner')}
      </div>

      <section aria-labelledby="sage-export-request-section" className="space-y-3">
        <h2 id="sage-export-request-section" className="text-lg font-semibold text-gray-900">
          {t('sections.requests')}
        </h2>
        {canWrite(ctx.orgRole) && (
          <CreateExportRequestForm
            orgId={ctx.orgId}
            workspaceId={workspaceId}
            requesterId={ctx.actorId}
            packageTypes={SAGE_EXPORT_PACKAGE_TYPES}
            evidenceItems={evidenceOptions}
            boundaryFlags={flagOptions}
            reviewNotes={noteOptions}
            decisionRecords={decisionOptions}
          />
        )}
        <ExportRequestList
          orgId={ctx.orgId}
          workspaceId={workspaceId}
          currentActorId={ctx.actorId}
          canApprove={canApprove}
          requests={requestRows}
        />
      </section>

      <section aria-labelledby="sage-export-package-section" className="space-y-3">
        <h2 id="sage-export-package-section" className="text-lg font-semibold text-gray-900">
          {t('sections.packages')}
        </h2>
        <ExportPackageList
          orgId={ctx.orgId}
          workspaceId={workspaceId}
          generatableRequestIds={generatableRequestIds}
          packages={packageRows}
        />
      </section>
    </main>
  )
}
