'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import {
  CLAIM_TRANSITION_TARGETS,
  type ClaimTransitionTarget,
} from '@/lib/workflow/claim-transition-contract'

type State =
  | { kind: 'loading' | 'unavailable' | 'stale' }
  | { kind: 'loaded'; caseId: string; sourceStatus: string; values: ClaimTransitionTarget[] }

export function CaseStatusActions(props: {
  caseId: string
  sourceStatus: string
  canClose: boolean
  disabled: boolean
  revision?: number
  onTransition: (target: string) => void
}) {
  const t = useTranslations()
  const [state, setState] = useState<State>({ kind: 'loading' })
  useEffect(() => {
    let current = true
    setState({ kind: 'loading' })
    void (async () => {
      try {
        const response = await fetch(`/api/cases/${props.caseId}/next-actions`)
        if (!response.ok) throw new Error('Case actions unavailable')
        const body = await response.json()
        if (
          body.error ||
          body.success === false ||
          body.caseId !== props.caseId ||
          !Array.isArray(body.allowedTransitions) ||
          new Set(body.allowedTransitions).size !== body.allowedTransitions.length ||
          !body.allowedTransitions.every(
            (value: unknown) =>
              typeof value === 'string' &&
              (CLAIM_TRANSITION_TARGETS as readonly string[]).includes(value),
          )
        ) {
          throw new Error('Invalid case actions')
        }
        if (current)
          setState(
            body.currentStatus !== props.sourceStatus
              ? { kind: 'stale' }
              : {
                  kind: 'loaded',
                  caseId: props.caseId,
                  sourceStatus: props.sourceStatus,
                  values: body.allowedTransitions,
                },
          )
      } catch {
        if (current) setState({ kind: 'unavailable' })
      }
    })()
    return () => {
      current = false
    }
  }, [props.caseId, props.sourceStatus, props.revision])

  if (state.kind !== 'loaded')
    return (
      <p role="status" className="max-w-full text-sm text-gray-600">
        {t(
          state.kind === 'loading'
            ? 'workbench.statusActionsLoading'
            : state.kind === 'stale'
              ? 'workbench.statusActionsStale'
              : 'workbench.statusActionsUnavailable',
        )}
      </p>
    )
  if (state.caseId !== props.caseId || state.sourceStatus !== props.sourceStatus) {
    return (
      <p role="status" className="max-w-full text-sm text-gray-600">
        {t('workbench.statusActionsLoading')}
      </p>
    )
  }
  const values = state.values.filter(
    (value) => props.canClose || !['rejected', 'closed'].includes(value),
  )
  if (!values.length)
    return (
      <p role="status" className="max-w-full text-sm text-gray-600">
        {t('workbench.statusActionsEmpty')}
      </p>
    )
  return (
    <select
      aria-label={t('workbench.updateStatusLabel')}
      onChange={(event) => {
        if (values.includes(event.target.value as ClaimTransitionTarget))
          props.onTransition(event.target.value)
      }}
      disabled={props.disabled}
      value=""
      className="max-w-full min-h-12 rounded-lg border border-gray-200 bg-gray-100 px-4 py-3 text-gray-700 disabled:opacity-50"
    >
      <option value="">{t('workbench.updateStatusLabel')}</option>
      {values.map((value) => (
        <option key={value} value={value}>
          {t(`workbench.statusOptions.${value}`)}
        </option>
      ))}
    </select>
  )
}
