'use client'

/**
 * Platform Admin — SAGE boundary flag list (client component)
 *
 * Renders boundary flags with their factual attributes and lifecycle status as
 * TEXT (never colour-only). Open flags are visually and textually distinct from
 * resolved/retained ones. When the actor may contribute, an unresolved flag
 * exposes an inline resolution form (which requires a human note).
 */
import { useTranslations } from 'next-intl'
import type { SageBoundaryFlagResponse } from '@/lib/sage/governance-schemas'
import { ResolveBoundaryFlagForm } from './resolve-boundary-flag-form'

interface BoundaryFlagListProps {
  orgId: string
  workspaceId: string
  flags: SageBoundaryFlagResponse[]
  canContribute: boolean
  resolutions: readonly string[]
}

function humanize(value: string): string {
  return value
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function BoundaryFlagList({
  orgId,
  workspaceId,
  flags,
  canContribute,
  resolutions,
}: BoundaryFlagListProps) {
  const t = useTranslations('sageGovernance')

  if (flags.length === 0) {
    return <p className="text-sm text-gray-400">{t('noFlags')}</p>
  }

  return (
    <ul className="space-y-3" aria-label={t('flagsListLabel')}>
      {flags.map((flag) => {
        const terminal = flag.status === 'resolved' || flag.status === 'retained'
        return (
          <li key={flag.id} className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span className="font-medium text-gray-900">{humanize(flag.flagType)}</span>
              <span
                data-testid="flag-status"
                className={
                  terminal
                    ? 'rounded-full border border-gray-300 px-2 py-0.5 text-xs text-gray-600'
                    : 'rounded-full border border-amber-300 px-2 py-0.5 text-xs font-medium text-amber-800'
                }
              >
                {t(`flagStatus.${flag.status}` as never)}
              </span>
              {flag.targetType && (
                <span className="text-gray-500">
                  {t('target')}: {humanize(flag.targetType)}
                </span>
              )}
            </div>
            {flag.note && <p className="mt-1 text-sm text-gray-600">{flag.note}</p>}
            {terminal && flag.resolutionNote && (
              <p className="mt-1 text-xs text-gray-500">
                {t('resolutionNote')}: {flag.resolutionNote}
                {flag.resolvedBy ? ` — ${t('resolvedBy')} ${flag.resolvedBy}` : ''}
              </p>
            )}
            {canContribute && !terminal && (
              <ResolveBoundaryFlagForm
                orgId={orgId}
                workspaceId={workspaceId}
                flagId={flag.id}
                resolutions={resolutions}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}
