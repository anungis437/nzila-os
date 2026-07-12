'use client'

/**
 * Platform Admin — SAGE decision record detail (client component)
 *
 * Presents one named-human decision record: statement, rationale, uncertainty,
 * reviewer attribution, and references to reviewed evidence + related boundary
 * flags. Explicitly labelled as a human decision — never an automated
 * conclusion. Inaccessible evidence references have already been redacted by the
 * server.
 */
import { useTranslations } from 'next-intl'
import type { SageDecisionRecordResponse } from '@/lib/sage/governance-schemas'

interface DecisionRecordDetailProps {
  decision: SageDecisionRecordResponse
}

export function DecisionRecordDetail({ decision }: DecisionRecordDetailProps) {
  const t = useTranslations('sageGovernance')

  return (
    <article className="rounded-lg border border-gray-200 bg-white p-4" aria-label={t('decisionRecord')}>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="rounded-full border border-gray-300 px-2 py-0.5 font-medium text-gray-700">
          {t('humanDecisionRecord')}
        </span>
        <span>
          {t('recordedBy')} {decision.humanReviewerId}
        </span>
        <span>· {decision.createdAt}</span>
      </div>

      <h4 className="mt-2 text-sm font-semibold text-gray-900">{t('decisionStatement')}</h4>
      <p className="text-sm text-gray-800">{decision.decision}</p>

      {decision.rationale && (
        <>
          <h4 className="mt-2 text-sm font-semibold text-gray-900">{t('rationale')}</h4>
          <p className="text-sm text-gray-700">{decision.rationale}</p>
        </>
      )}

      <h4 className="mt-2 text-sm font-semibold text-gray-900">{t('uncertainty')}</h4>
      <p className="text-sm text-gray-700">{decision.uncertainty ?? '—'}</p>

      <dl className="mt-2 grid grid-cols-1 gap-2 text-xs text-gray-600 sm:grid-cols-2">
        <div>
          <dt className="font-medium text-gray-700">{t('reviewedEvidence')}</dt>
          <dd>
            {decision.referencedEvidenceItemIds.length === 0
              ? '—'
              : decision.referencedEvidenceItemIds.join(', ')}
          </dd>
        </div>
        <div>
          <dt className="font-medium text-gray-700">{t('relatedFlags')}</dt>
          <dd>
            {decision.referencedBoundaryFlagIds.length === 0
              ? '—'
              : decision.referencedBoundaryFlagIds.join(', ')}
          </dd>
        </div>
      </dl>

      <p className="mt-2 text-xs italic text-gray-400">{t('evidenceNotAutomated')}</p>
    </article>
  )
}
