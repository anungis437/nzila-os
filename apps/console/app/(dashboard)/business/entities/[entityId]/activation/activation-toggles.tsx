/**
 * Nzila OS — Org Activation Matrix (Client Component)
 *
 * Interactive toggles for enabling/disabling apps per org.
 */
'use client'

import { useState, useTransition } from 'react'
import { toggleAppActivation, type ManagedApp, type AppActivationState } from './actions'

const APP_LABELS: Record<ManagedApp, { name: string; description: string; color: string }> = {
  'union-eyes': {
    name: 'Union Eyes',
    description: 'Union management — pension, grievances, analytics',
    color: 'bg-amber-50 border-amber-200',
  },
  zonga: {
    name: 'Zonga',
    description: 'Creator economy — revenue, royalties, payouts',
    color: 'bg-emerald-50 border-emerald-200',
  },
  'shop-quoter': {
    name: 'Shop Quoter',
    description: 'Quote generation and pricing engine',
    color: 'bg-rose-50 border-rose-200',
  },
  cfo: {
    name: 'CFO',
    description: 'Financial operations and reporting',
    color: 'bg-blue-50 border-blue-200',
  },
  nacp: {
    name: 'NACP',
    description: 'National exam administration and proctoring',
    color: 'bg-purple-50 border-purple-200',
  },
  abr: {
    name: 'ABR',
    description: 'Anti-racism LMS, tribunal database, DEI',
    color: 'bg-indigo-50 border-indigo-200',
  },
}

export function ActivationToggles({
  entityId,
  initialState,
}: {
  entityId: string
  initialState: AppActivationState[]
}) {
  const [states, setStates] = useState<AppActivationState[]>(initialState)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<string | null>(null)

  function handleToggle(app: ManagedApp, currentEnabled: boolean) {
    const newEnabled = !currentEnabled
    setFeedback(null)

    startTransition(async () => {
      const result = await toggleAppActivation(entityId, app, newEnabled)
      if (result.success) {
        setStates((prev) =>
          prev.map((s) => (s.app === app ? { ...s, enabled: newEnabled } : s)),
        )
        setFeedback(`${APP_LABELS[app].name} ${newEnabled ? 'activated' : 'deactivated'}`)
      } else {
        setFeedback(`Error: ${result.error}`)
      }
    })
  }

  return (
    <div>
      {feedback && (
        <div className="mb-4 px-4 py-2 rounded-lg bg-blue-50 text-blue-800 text-sm">
          {feedback}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {states.map(({ app, enabled }) => {
          const meta = APP_LABELS[app]
          return (
            <div
              key={app}
              className={`border rounded-xl p-5 transition ${meta.color} ${
                enabled ? 'ring-2 ring-blue-400' : 'opacity-75'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-900">{meta.name}</h3>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleToggle(app, enabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                    enabled ? 'bg-blue-600' : 'bg-gray-300'
                  } ${isPending ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`Toggle ${meta.name}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                      enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              <p className="text-sm text-gray-600">{meta.description}</p>
              <p className="mt-2 text-xs font-medium">
                {enabled ? (
                  <span className="text-green-700">Active</span>
                ) : (
                  <span className="text-gray-400">Inactive</span>
                )}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}
