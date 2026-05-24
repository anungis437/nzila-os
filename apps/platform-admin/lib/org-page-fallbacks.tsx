/**
 * Client-rendered fallbacks for pages that need an org selection.
 *
 * Used by every server page that calls `getPageOrgContext()`. Keeps the
 * unhappy paths (no selection / forbidden) consistent and provides the
 * interactive org-picker that sets the `nzila_active_org` cookie via
 * `/api/admin/set-active-org`.
 */
'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { OrgCandidate } from './page-org-context'

export function OrgPickerPanel({
  candidates,
  returnTo,
}: {
  candidates: OrgCandidate[]
  returnTo: string
}) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function selectOrg(orgId: string) {
    setError(null)
    setPending(orgId)
    try {
      const res = await fetch('/api/admin/set-active-org', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId }),
      })
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as {
          error?: { message?: string }
        }
        setError(json.error?.message ?? `Failed to select org (${res.status})`)
        setPending(null)
        return
      }
      router.replace(returnTo)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to select org')
      setPending(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-xl font-semibold text-gray-900">Select an organisation</h1>
      <p className="text-sm text-gray-500">
        Platform Admin is strictly org-scoped. Pick which organisation&apos;s
        configuration you want to view or edit.
      </p>
      {candidates.length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          You are not an active member of any organisation. Ask an existing
          org admin to add you, or set <code>PLATFORM_ADMIN_USER_IDS</code>{' '}
          for emergency access.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
          {candidates.map((c) => (
            <li key={c.orgId} className="flex items-center justify-between p-4">
              <div>
                <p className="font-medium text-gray-900">{c.orgName}</p>
                <p className="text-xs text-gray-500">
                  Role: <code>{c.role}</code> · <code>{c.orgId}</code>
                </p>
              </div>
              <button
                type="button"
                onClick={() => selectOrg(c.orgId)}
                disabled={pending !== null}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending === c.orgId ? 'Opening…' : 'Open'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}

export function ForbiddenPanel({ orgId }: { orgId: string }) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p className="font-semibold">Access denied</p>
        <p className="mt-1">
          You are not an active member of org <code>{orgId}</code>. Contact an
          org admin if you believe this is in error.
        </p>
      </div>
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Back to dashboard
      </Link>
    </div>
  )
}

export function ActiveOrgBadge({
  orgName,
  orgId,
  orgRole,
}: {
  orgName: string
  orgId: string
  orgRole: string
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600">
      <span className="rounded-full bg-emerald-500 h-1.5 w-1.5" aria-hidden />
      <span className="font-medium text-gray-900">{orgName}</span>
      <span className="text-gray-400">·</span>
      <code className="text-gray-500">{orgRole}</code>
      <span className="text-gray-300">·</span>
      <code className="text-[10px] text-gray-400">{orgId.slice(0, 8)}…</code>
    </div>
  )
}
