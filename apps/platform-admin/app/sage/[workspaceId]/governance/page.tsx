/**
 * Platform Admin — SAGE review & decisions (human governance)
 *
 * The Phase 6 human-governance surface over the evidence lifecycle. Authorized
 * participants can open/resolve boundary flags, record attributed human review
 * notes, and create named-human decision records that reference accessible
 * evidence and related flags.
 *
 * The page deliberately distinguishes four things and never collapses them:
 *   - Evidence: sourced factual material (managed on the Evidence page)
 *   - Review note: a named human observation
 *   - Boundary flag: a concern / limitation / review condition
 *   - Decision record: a named human judgment and rationale
 *
 * No score, rank, grade, certification, availability claim, automated decision,
 * or conclusion is shown. All data is server-fetched, tenant-scoped, and
 * authorization-filtered; a missing / cross-org / denied workspace renders 404.
 */
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import {
  SAGE_BOUNDARY_FLAG_TYPES,
  SAGE_BOUNDARY_RESOLUTIONS,
  SAGE_REVIEW_NOTE_TYPES,
} from '@nzila/sage-core'
import { getPageOrgContext } from '../../../../lib/page-org-context'
import { ForbiddenPanel, OrgPickerPanel } from '../../../../lib/org-page-fallbacks'
import { canWrite } from '../../../../lib/org-scope-guard'
import { getSageWorkspaceForScope } from '../../../../lib/sage/workspace-service'
import {
  listSageEvidenceItemsForScope,
  listSageEvidenceSourcesForScope,
} from '../../../../lib/sage/evidence-service'
import {
  listSageBoundaryFlagsForScope,
  listSageDecisionRecordsForScope,
  listSageReviewNotesForScope,
} from '../../../../lib/sage/governance-service'
import {
  CreateBoundaryFlagForm,
  type GovernanceTargetOption,
} from '../../components/governance/create-boundary-flag-form'
import { BoundaryFlagList } from '../../components/governance/boundary-flag-list'
import { CreateReviewNoteForm } from '../../components/governance/create-review-note-form'
import { ReviewNoteList } from '../../components/governance/review-note-list'
import {
  CreateDecisionRecordForm,
  type DecisionReferenceOption,
} from '../../components/governance/create-decision-record-form'
import { DecisionRecordList } from '../../components/governance/decision-record-list'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'SAGE Review & Decisions | Platform Admin',
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default async function SageGovernancePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>
  searchParams: Promise<{ orgId?: string }>
}) {
  const [{ workspaceId }, sp, t] = await Promise.all([
    params,
    searchParams,
    getTranslations('sageGovernance'),
  ])
  const result = await getPageOrgContext(sp)

  if (result.status === 'unauthenticated') redirect('/sign-in')
  if (result.status === 'no-selection') {
    return (
      <OrgPickerPanel candidates={result.candidates} returnTo={`/sage/${workspaceId}/governance`} />
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

  const [flagList, noteList, decisionList, sourceList, itemList] = await Promise.all([
    listSageBoundaryFlagsForScope(scope, workspaceId),
    listSageReviewNotesForScope(scope, workspaceId),
    listSageDecisionRecordsForScope(scope, workspaceId),
    listSageEvidenceSourcesForScope(scope, workspaceId),
    listSageEvidenceItemsForScope(scope, workspaceId),
  ])
  // Non-disclosure: if the actor cannot read this workspace's governance data,
  // render 404 rather than an empty page that confirms the workspace exists.
  if (!flagList || !noteList || !decisionList) notFound()

  const canContribute = canWrite(scope.orgRole)

  // Target selectors only offer ACCESSIBLE targets (the server already filtered).
  const targets: GovernanceTargetOption[] = [
    { value: 'workspace:', label: t('targetWorkspace') },
    ...(sourceList?.sources ?? []).map((s) => ({
      value: `evidence_source:${s.id}`,
      label: `${t('targetSourcePrefix')} ${humanize(s.sourceType)}`,
    })),
    ...(itemList?.items ?? []).map((i) => ({
      value: `evidence_item:${i.id}`,
      label: `${t('targetItemPrefix')} ${i.confidenceLevel ? humanize(i.confidenceLevel) : humanize(i.lifecycleState)}`,
    })),
  ]

  const evidenceOptions: DecisionReferenceOption[] = (itemList?.items ?? []).map((i) => ({
    id: i.id,
    label: `${t('targetItemPrefix')} ${i.confidenceLevel ? humanize(i.confidenceLevel) : humanize(i.lifecycleState)}`,
  }))
  const boundaryFlagOptions: DecisionReferenceOption[] = flagList.flags.map((f) => ({
    id: f.id,
    label: `${humanize(f.flagType)} (${t(`flagStatus.${f.status}` as never)})`,
  }))

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
      </div>

      <section aria-labelledby="sage-distinctions-heading" className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 id="sage-distinctions-heading" className="text-sm font-semibold text-gray-900">
          {t('distinctions.heading')}
        </h2>
        <dl className="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-600 sm:grid-cols-2">
          <div>
            <dt className="font-medium text-gray-800">{t('distinctions.evidenceTerm')}</dt>
            <dd>{t('distinctions.evidence')}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-800">{t('distinctions.reviewTerm')}</dt>
            <dd>{t('distinctions.review')}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-800">{t('distinctions.flagTerm')}</dt>
            <dd>{t('distinctions.flag')}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-800">{t('distinctions.decisionTerm')}</dt>
            <dd>{t('distinctions.decision')}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="sage-flags-heading" className="space-y-4">
        <h2 id="sage-flags-heading" className="text-lg font-semibold text-gray-900">
          {t('boundaryFlags')}
        </h2>
        {canContribute && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <CreateBoundaryFlagForm
              orgId={scope.orgId}
              workspaceId={workspaceId}
              flagTypes={SAGE_BOUNDARY_FLAG_TYPES}
              targets={targets}
            />
          </div>
        )}
        <BoundaryFlagList
          orgId={scope.orgId}
          workspaceId={workspaceId}
          flags={flagList.flags}
          canContribute={canContribute}
          resolutions={SAGE_BOUNDARY_RESOLUTIONS}
        />
      </section>

      <section aria-labelledby="sage-notes-heading" className="space-y-4">
        <h2 id="sage-notes-heading" className="text-lg font-semibold text-gray-900">
          {t('reviewNotes')}
        </h2>
        {canContribute && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <CreateReviewNoteForm
              orgId={scope.orgId}
              workspaceId={workspaceId}
              reviewerId={scope.actorId}
              noteTypes={SAGE_REVIEW_NOTE_TYPES}
              targets={targets}
            />
          </div>
        )}
        <ReviewNoteList notes={noteList.notes} />
      </section>

      <section aria-labelledby="sage-decisions-heading" className="space-y-4">
        <h2 id="sage-decisions-heading" className="text-lg font-semibold text-gray-900">
          {t('decisionRecords')}
        </h2>
        {canContribute && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <CreateDecisionRecordForm
              orgId={scope.orgId}
              workspaceId={workspaceId}
              reviewerId={scope.actorId}
              evidenceOptions={evidenceOptions}
              boundaryFlagOptions={boundaryFlagOptions}
            />
          </div>
        )}
        <DecisionRecordList decisions={decisionList.decisions} />
      </section>
    </div>
  )
}
