'use client'

/**
 * Platform Admin — SAGE evidence source list (client component)
 *
 * Renders the authorization-filtered evidence sources with their factual
 * attributes and lifecycle-relevant flags (classified / unclassified). No
 * score, rank, grade, certification, or conclusion is shown. When the actor may
 * contribute, an unclassified source exposes an inline classification form.
 */
import { useTranslations } from 'next-intl'
import type { SageEvidenceSourceResponse } from '@/lib/sage/evidence-schemas'
import { ClassifySourceForm } from './classify-source-form'

interface SourceListProps {
  orgId: string
  workspaceId: string
  sources: SageEvidenceSourceResponse[]
  canContribute: boolean
  sourceQualities: readonly string[]
  authorizationLevels: readonly string[]
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function SourceList({
  orgId,
  workspaceId,
  sources,
  canContribute,
  sourceQualities,
  authorizationLevels,
}: SourceListProps) {
  const t = useTranslations('sageEvidence')

  if (sources.length === 0) {
    return <p className="text-sm text-gray-400">{t('noSources')}</p>
  }

  return (
    <ul className="space-y-3" aria-label={t('sourcesTableCaption')}>
      {sources.map((source) => (
        <li key={source.id} className="rounded-lg border border-gray-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="font-medium text-gray-900">{humanize(source.sourceType)}</span>
            <span className="text-gray-500">
              {t('authorizationLevel')}: {humanize(source.authorizationLevel)}
            </span>
            <span className="text-gray-500">
              {t('sourceQuality')}:{' '}
              {source.sourceQuality ? humanize(source.sourceQuality) : t('notClassifiedYet')}
            </span>
            <span
              className="rounded-full border px-2 py-0.5 text-xs text-gray-700"
              data-testid="source-lifecycle"
            >
              {source.classified ? t('lifecycle.classified') : t('lifecycle.registered')}
            </span>
          </div>
          {(source.containsPersonalInformation || source.containsSensitiveInformation) && (
            <p className="mt-1 text-xs text-amber-700">
              {source.containsPersonalInformation ? t('containsPersonalInformation') : ''}
              {source.containsPersonalInformation && source.containsSensitiveInformation ? ' · ' : ''}
              {source.containsSensitiveInformation ? t('containsSensitiveInformation') : ''}
            </p>
          )}
          {canContribute && !source.classified && (
            <ClassifySourceForm
              orgId={orgId}
              workspaceId={workspaceId}
              sourceId={source.id}
              sourceQualities={sourceQualities}
              authorizationLevels={authorizationLevels}
            />
          )}
        </li>
      ))}
    </ul>
  )
}
