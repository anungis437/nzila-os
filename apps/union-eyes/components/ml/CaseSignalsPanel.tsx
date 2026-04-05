/**
 * apps/union-eyes/components/ml/CaseSignalsPanel.tsx
 *
 * "Signals" panel displayed on the UE case detail page.
 * Shows ML-predicted priority and SLA risk with model provenance.
 *
 * CONSTRAINT: No direct DB imports. All data flows through @nzila/ml-sdk hooks.
 */
'use client'

import { useAuth } from '@nzila/platform-auth/entra/client'
import { useCasePrioritySignal, useCaseSlaRiskSignal } from '@/lib/useUEMlSignals'
import { PriorityBadge } from './PriorityBadge'
import { SlaRiskBadge } from './SlaRiskBadge'

interface CaseSignalsPanelProps {
  orgId: string
  caseId: string
}

function SignalRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 shrink-0 w-36">{label}</span>
      <div className="text-sm text-gray-900 text-right">{children}</div>
    </div>
  )
}

function ModelMeta({
  modelKey,
  inferenceRunId,
  occurredAt,
}: {
  modelKey: string
  inferenceRunId: string | null
  occurredAt: string
}) {
  const ts = new Date(occurredAt)
  const formatted = ts.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
  return (
    <div className="mt-1 text-xs text-gray-400 space-y-0.5">
      <div>
        <span className="font-mono">{modelKey}</span>
      </div>
      {inferenceRunId && (
        <div>
          Run:{' '}
          <span className="font-mono text-gray-500">
            {inferenceRunId.slice(0, 8)}…
          </span>
        </div>
      )}
      <div>Last updated: {formatted}</div>
    </div>
  )
}

export function CaseSignalsPanel({ orgId, caseId }: CaseSignalsPanelProps) {
  const { getToken } = useAuth()

  const {
    score: priorityScore,
    isLoading: priorityLoading,
    error: priorityError,
  } = useCasePrioritySignal(orgId, caseId, getToken)

  const {
    score: slaScore,
    isLoading: slaLoading,
    error: slaError,
  } = useCaseSlaRiskSignal(orgId, caseId, getToken)

  const anyLoading = priorityLoading || slaLoading
  const anyError = priorityError ?? slaError

  return (
    <section
      className="rounded-lg border border-gray-200 bg-white shadow-sm"
      aria-label="ML Signals"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <svg
            className="h-4 w-4 text-indigo-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="text-sm font-semibold text-gray-900">ML Signals</h3>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-1">
        {anyError && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
            ML signals temporarily unavailable.
          </div>
        )}

        {/* Priority signal */}
        <SignalRow label="Predicted priority">
          <div className="space-y-1">
            <PriorityBadge score={priorityScore} isLoading={priorityLoading} showConfidence />
            {priorityScore && (
              <ModelMeta
                modelKey={priorityScore.modelKey}
                inferenceRunId={priorityScore.inferenceRunId}
                occurredAt={priorityScore.occurredAt}
              />
            )}
            {!priorityScore && !priorityLoading && !priorityError && (
              <p className="text-xs text-gray-400">No inference run yet.</p>
            )}
          </div>
        </SignalRow>

        {/* SLA risk signal */}
        <SignalRow label="SLA breach risk">
          <div className="space-y-1">
            <SlaRiskBadge score={slaScore} isLoading={slaLoading} showProbability />
            {slaScore && (
              <ModelMeta
                modelKey={slaScore.modelKey}
                inferenceRunId={slaScore.inferenceRunId}
                occurredAt={slaScore.occurredAt}
              />
            )}
            {!slaScore && !slaLoading && !slaError && (
              <p className="text-xs text-gray-400">No inference run yet.</p>
            )}
          </div>
        </SignalRow>
      </div>

      {/* Footer note */}
      {!anyLoading && (priorityScore ?? slaScore) && (
        <div className="px-4 py-2 border-t border-gray-100 bg-gray-50 rounded-b-lg">
          <p className="text-xs text-gray-400">
            Signals are ML predictions and do not replace staff judgment.
          </p>
        </div>
      )}
    </section>
  )
}
