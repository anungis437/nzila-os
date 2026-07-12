'use client'

/**
 * Platform Admin — SAGE decision record list (client component)
 *
 * Renders each named-human decision record via the detail component. No score,
 * rank, grade, certification, or automated conclusion is shown.
 */
import { useTranslations } from 'next-intl'
import type { SageDecisionRecordResponse } from '@/lib/sage/governance-schemas'
import { DecisionRecordDetail } from './decision-record-detail'

interface DecisionRecordListProps {
  decisions: SageDecisionRecordResponse[]
}

export function DecisionRecordList({ decisions }: DecisionRecordListProps) {
  const t = useTranslations('sageGovernance')

  if (decisions.length === 0) {
    return <p className="text-sm text-gray-400">{t('noDecisions')}</p>
  }

  return (
    <ul className="space-y-3" aria-label={t('decisionsListLabel')}>
      {decisions.map((decision) => (
        <li key={decision.id}>
          <DecisionRecordDetail decision={decision} />
        </li>
      ))}
    </ul>
  )
}
