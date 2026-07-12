'use client'

/**
 * Platform Admin — SAGE evidence item list (client component)
 *
 * Renders authorization-filtered evidence items with their lifecycle state,
 * confidence level, and human-review requirement — as text, never colour-only.
 * No score, rank, grade, certification, or conclusion is shown. When the actor
 * may contribute, an item that is not yet linked exposes a link action.
 */
import { useTranslations } from 'next-intl'
import type { SageEvidenceItemResponse } from '@/lib/sage/evidence-schemas'
import { LinkItemForm } from './link-item-form'

interface ItemListProps {
  orgId: string
  workspaceId: string
  items: SageEvidenceItemResponse[]
  canContribute: boolean
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function ItemList({ orgId, workspaceId, items, canContribute }: ItemListProps) {
  const t = useTranslations('sageEvidence')

  if (items.length === 0) {
    return <p className="text-sm text-gray-400">{t('noItems')}</p>
  }

  return (
    <ul className="space-y-2" aria-label={t('itemsTableCaption')}>
      {items.map((item) => (
        <li
          key={item.id}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-gray-200 bg-white p-3 text-sm"
        >
          <span
            className="rounded-full border px-2 py-0.5 text-xs text-gray-700"
            data-testid="item-lifecycle"
          >
            {t(`lifecycle.${item.lifecycleState}` as never)}
          </span>
          <span className="text-gray-500">
            {t('confidenceLevel')}:{' '}
            {item.confidenceLevel ? humanize(item.confidenceLevel) : t('notClassifiedYet')}
          </span>
          {item.humanReviewRequired && (
            <span className="text-xs text-amber-700">{t('humanReviewRequired')}</span>
          )}
          {item.excludedFromExternalReview && (
            <span className="text-xs text-gray-500">{t('excludedFromExternalReview')}</span>
          )}
          {canContribute && item.lifecycleState !== 'linked' && (
            <LinkItemForm orgId={orgId} workspaceId={workspaceId} itemId={item.id} />
          )}
        </li>
      ))}
    </ul>
  )
}
