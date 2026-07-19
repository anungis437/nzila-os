'use client'

/**
 * Platform Admin — SAGE Phase 8B records lifecycle panel (client component)
 *
 * Surfaces retention, legal holds, destruction eligibility, destruction requests,
 * and destruction evidence for immutable export packages. Enforces UX safety:
 *   - retain-until, policy code/version, and active holds are shown explicitly;
 *   - blocked destruction states are stated in text (never colour alone);
 *   - the requester never sees approval controls for their OWN request;
 *   - a destroyed package shows a permanent tombstone with no download/deliver;
 *   - the destructive request action requires an explicit confirmation step.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface PackageRow {
  id: string
  availabilityStatus?: string
}

interface DestructionRequestRow {
  id: string
  exportPackageId: string
  status: string
  reason: string
  retentionPolicyCode: string
  retentionPolicyVersion: number
  retainUntil: string
  activeHoldCount: number
  isOwnRequest: boolean
}

interface EligibilityResponse {
  eligible: boolean
  reasonCodes: string[]
  retainUntil: string | null
  activeHoldCount: number
}

interface RecordsLifecyclePanelProps {
  workspaceId: string
  currentActorId: string
  packages: PackageRow[]
  destructionRequests: DestructionRequestRow[]
}

function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`
}

const REASON_MESSAGE: Record<string, string> = {
  RETENTION_NOT_ASSIGNED: 'retentionNotAssigned',
  RETENTION_NOT_ELAPSED: 'retentionPeriodNotElapsed',
  ACTIVE_LEGAL_HOLD: 'activeLegalHoldPreventsDestruction',
  PACKAGE_ALREADY_DESTROYED: 'packageAlreadyDestroyed',
}

export function RecordsLifecyclePanel({
  workspaceId,
  currentActorId,
  packages,
  destructionRequests,
}: RecordsLifecyclePanelProps) {
  const t = useTranslations('sageRecords')
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [eligibility, setEligibility] = useState<Record<string, EligibilityResponse>>({})
  const [confirming, setConfirming] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  const showError = useCallback((message: string) => {
    setError(message)
    requestAnimationFrame(() => errorRef.current?.focus())
  }, [])

  const loadEligibility = useCallback(
    async (packageId: string) => {
      const res = await fetch(
        `/api/sage/workspaces/${workspaceId}/exports/${packageId}/destruction-requests`,
        { headers: { accept: 'application/json' } },
      )
      if (!res.ok) return
      const body = (await res.json()) as { ok: boolean; data: EligibilityResponse | null }
      if (body.ok && body.data) setEligibility((prev) => ({ ...prev, [packageId]: body.data as EligibilityResponse }))
    },
    [workspaceId],
  )

  useEffect(() => {
    for (const pkg of packages) {
      if ((pkg.availabilityStatus ?? 'available') !== 'destroyed') void loadEligibility(pkg.id)
    }
  }, [packages, loadEligibility])

  async function mutate(url: string, body: Record<string, unknown>, busyKey: string) {
    setError(null)
    setBusy(busyKey)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'Idempotency-Key': newKey() },
        body: JSON.stringify(body),
      })
      const payload = (await res.json()) as { ok: boolean; error?: { message?: string } }
      if (!res.ok || !payload.ok) {
        showError(payload.error?.message ?? 'Request failed')
        return
      }
      router.refresh()
    } catch {
      showError('Request failed')
    } finally {
      setBusy(null)
      setConfirming(null)
    }
  }

  return (
    <div className="space-y-4">
      {error && (
        <div ref={errorRef} tabIndex={-1} role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <ul className="space-y-3">
        {packages.map((pkg) => {
          const destroyed = (pkg.availabilityStatus ?? 'available') === 'destroyed'
          const elig = eligibility[pkg.id]
          return (
            <li key={pkg.id} className="rounded-md border border-gray-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-gray-600">{pkg.id.slice(0, 12)}</span>
                {destroyed ? (
                  <span className="rounded bg-gray-800 px-2 py-0.5 text-xs font-semibold text-white">
                    ✖ {t('verifiedDestroyed')}
                  </span>
                ) : (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                    {t('destructionEligibility')}
                  </span>
                )}
              </div>

              {destroyed ? (
                <p className="mt-2 text-sm text-gray-700">{t('tombstone')}</p>
              ) : elig ? (
                <div className="mt-2 space-y-1 text-sm text-gray-700">
                  <p>
                    {t('retainUntil')}: <span className="font-mono">{elig.retainUntil ?? t('retentionNotAssigned')}</span>
                  </p>
                  <p>
                    {t('legalHold')}: {elig.activeHoldCount}
                  </p>
                  {!elig.eligible && (
                    <p className="font-semibold text-amber-800">
                      ⚠ {t('destructionBlocked')}:{' '}
                      {elig.reasonCodes
                        .filter((c) => c !== 'ELIGIBLE')
                        .map((c) => (REASON_MESSAGE[c] ? t(REASON_MESSAGE[c]) : c))
                        .join('; ')}
                    </p>
                  )}
                  {elig.eligible && confirming !== pkg.id && (
                    <button
                      type="button"
                      onClick={() => setConfirming(pkg.id)}
                      disabled={busy !== null}
                      className="mt-1 rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {t('requestDestruction')}
                    </button>
                  )}
                  {elig.eligible && confirming === pkg.id && (
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-red-800">{t('confirmDestruction')}</span>
                      <button
                        type="button"
                        onClick={() =>
                          mutate(
                            `/api/sage/workspaces/${workspaceId}/exports/${pkg.id}/destruction-requests`,
                            { reason: 'records disposition' },
                            `req-${pkg.id}`,
                          )
                        }
                        disabled={busy !== null}
                        className="rounded bg-red-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {t('confirmDestruction')}
                      </button>
                      <button type="button" onClick={() => setConfirming(null)} className="text-xs text-gray-600 underline">
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-gray-400">…</p>
              )}
            </li>
          )
        })}
      </ul>

      {destructionRequests.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-800">{t('requestDestruction')}</h3>
          <ul className="space-y-2">
            {destructionRequests.map((r) => (
              <li key={r.id} className="rounded-md border border-gray-200 p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-gray-600">{r.id.slice(0, 12)}</span>
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{r.status}</span>
                </div>
                <p className="mt-1 text-gray-700">
                  {t('retentionPolicy')}: {r.retentionPolicyCode} v{r.retentionPolicyVersion} · {t('retainUntil')}:{' '}
                  <span className="font-mono">{r.retainUntil}</span> · {t('legalHold')}: {r.activeHoldCount}
                </p>
                {r.status === 'requested' && r.isOwnRequest && (
                  <p className="mt-1 text-xs text-gray-500">{t('differentApproverRequired')}</p>
                )}
                {r.status === 'requested' && !r.isOwnRequest && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        mutate(`/api/sage/workspaces/${workspaceId}/destruction-requests/${r.id}/approve`, {}, `appr-${r.id}`)
                      }
                      disabled={busy !== null}
                      className="rounded bg-red-700 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {t('approveDestruction')}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        mutate(`/api/sage/workspaces/${workspaceId}/destruction-requests/${r.id}/deny`, {}, `deny-${r.id}`)
                      }
                      disabled={busy !== null}
                      className="rounded border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 disabled:opacity-50"
                    >
                      {t('denyDestruction')}
                    </button>
                  </div>
                )}
                {r.status === 'failed' && <p className="mt-1 font-semibold text-amber-800">⚠ {t('destructionFailed')}</p>}
                {r.status === 'destroyed' && <p className="mt-1 font-semibold text-gray-800">✖ {t('verifiedDestroyed')}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <span className="sr-only">{currentActorId}</span>
    </div>
  )
}
