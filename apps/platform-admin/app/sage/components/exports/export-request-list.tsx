'use client'

/**
 * Platform Admin — SAGE export request list + approval queue (client component)
 *
 * Lists export requests with an explicit status. For a PENDING request authored
 * by ANOTHER user, an authorized approver sees independent approve/deny controls
 * (each requires a rationale). A requester never sees decision controls for
 * their OWN request, and an already-decided request has none. Server enforcement
 * is authoritative; UI hiding is defense-in-depth only.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export interface ExportRequestRow {
  id: string
  requestedBy: string
  purpose: string | null
  packageType: string
  status: string
  requestedScopeHash: string | null
  itemCount: number
  createdAt: string
}

interface ExportRequestListProps {
  orgId: string
  workspaceId: string
  currentActorId: string
  canApprove: boolean
  requests: ExportRequestRow[]
}

export function ExportRequestList({
  orgId,
  workspaceId,
  currentActorId,
  canApprove,
  requests,
}: ExportRequestListProps) {
  const t = useTranslations('sageExports')
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rationales, setRationales] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  function showError(message: string) {
    setError(message)
    requestAnimationFrame(() => errorRef.current?.focus())
  }

  async function decide(requestId: string, action: 'approve' | 'deny') {
    setError(null)
    const rationale = (rationales[requestId] ?? '').trim()
    if (!rationale) {
      showError(action === 'approve' ? t('validation.approvalRationaleRequired') : t('validation.denialRationaleRequired'))
      return
    }
    setBusyId(requestId)
    try {
      const res = await fetch(`/api/sage/workspaces/${workspaceId}/export-requests/${requestId}/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({ rationale }),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } }
      if (!res.ok || !json.ok) {
        showError(json.error?.message ?? t('error.decisionFailed'))
        return
      }
      router.refresh()
    } catch {
      showError(t('error.decisionFailed'))
    } finally {
      setBusyId(null)
    }
  }

  if (requests.length === 0) {
    return <p className="text-sm text-gray-500">{t('empty.requests')}</p>
  }

  return (
    <div className="space-y-3">
      {error && (
        <div ref={errorRef} tabIndex={-1} role="alert" aria-live="assertive" className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}
      <ul className="space-y-3">
        {requests.map((req) => {
          const isOwn = req.requestedBy === currentActorId
          const isPending = req.status === 'requested'
          const showDecision = canApprove && isPending && !isOwn
          return (
            <li key={req.id} className="rounded border border-gray-200 p-3" data-testid="export-request-row">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{req.purpose ?? t('noPurpose')}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700" data-testid="export-request-status">
                  {t(`statusLabel.${req.status}`)}
                </span>
              </div>
              <dl className="mt-1 grid grid-cols-2 gap-x-4 text-xs text-gray-500">
                <div><dt className="inline">{t('requestedBy')}: </dt><dd className="inline">{req.requestedBy}</dd></div>
                <div><dt className="inline">{t('itemCount')}: </dt><dd className="inline">{req.itemCount}</dd></div>
              </dl>
              {isOwn && isPending && (
                <p className="mt-2 text-xs text-amber-700">{t('cannotDecideOwn')}</p>
              )}
              {showDecision && (
                <div className="mt-2 space-y-2">
                  <label htmlFor={`rationale-${req.id}`} className="text-xs font-medium text-gray-600">
                    {t('decisionRationale')}
                  </label>
                  <textarea
                    id={`rationale-${req.id}`}
                    value={rationales[req.id] ?? ''}
                    onChange={(e) => setRationales((r) => ({ ...r, [req.id]: e.target.value }))}
                    rows={2}
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => decide(req.id, 'approve')}
                      className="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {t('approveRequest')}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === req.id}
                      onClick={() => decide(req.id, 'deny')}
                      className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {t('denyRequest')}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
