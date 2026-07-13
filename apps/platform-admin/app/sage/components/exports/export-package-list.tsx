'use client'

/**
 * Platform Admin — SAGE export package list + generation (client component)
 *
 * Shows generated packages (type, hashes, counts, size, policy version) with an
 * authenticated INTERNAL download action. Approved requests without a package
 * expose a Generate control. There is NO "Send", "Share", "Publish", recipient,
 * or external-delivery control anywhere — generation is internal only.
 */
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

export interface ExportPackageRow {
  id: string
  exportRequestId: string
  status: string
  packageType: string
  manifestHash: string
  contentHash: string
  sizeBytes: number
  policyVersion: string
  itemCount: number
  excludedCount: number
  generatedBy: string
  generatedAt: string
}

interface ExportPackageListProps {
  orgId: string
  workspaceId: string
  generatableRequestIds: string[]
  packages: ExportPackageRow[]
}

export function ExportPackageList({
  orgId,
  workspaceId,
  generatableRequestIds,
  packages,
}: ExportPackageListProps) {
  const t = useTranslations('sageExports')
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<HTMLDivElement>(null)

  function showError(message: string) {
    setError(message)
    requestAnimationFrame(() => errorRef.current?.focus())
  }

  async function generate(requestId: string) {
    setError(null)
    setBusyId(requestId)
    try {
      const res = await fetch(`/api/sage/workspaces/${workspaceId}/export-requests/${requestId}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
          'x-org-id': orgId,
        },
        body: JSON.stringify({}),
      })
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: { message?: string } }
      if (!res.ok || !json.ok) {
        showError(json.error?.message ?? t('error.generateFailed'))
        return
      }
      router.refresh()
    } catch {
      showError(t('error.generateFailed'))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div ref={errorRef} tabIndex={-1} role="alert" aria-live="assertive" className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {generatableRequestIds.length > 0 && (
        <div className="rounded border border-blue-200 bg-blue-50 p-2">
          <p className="text-xs font-medium text-blue-800">{t('generatable')}</p>
          <ul className="mt-1 space-y-1">
            {generatableRequestIds.map((id) => (
              <li key={id} className="flex items-center justify-between text-xs text-gray-700">
                <span>{id}</span>
                <button
                  type="button"
                  disabled={busyId === id}
                  onClick={() => generate(id)}
                  className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {t('generatePackage')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {packages.length === 0 ? (
        <p className="text-sm text-gray-500">{t('empty.packages')}</p>
      ) : (
        <ul className="space-y-3">
          {packages.map((pkg) => (
            <li key={pkg.id} className="rounded border border-gray-200 p-3" data-testid="export-package-row">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{pkg.packageType}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {t(`statusLabel.${pkg.status}`)}
                </span>
              </div>
              <dl className="mt-1 grid grid-cols-1 gap-x-4 text-xs text-gray-500 sm:grid-cols-2">
                <div><dt className="inline">{t('manifestHash')}: </dt><dd className="inline break-all font-mono">{pkg.manifestHash.slice(0, 16)}…</dd></div>
                <div><dt className="inline">{t('contentHash')}: </dt><dd className="inline break-all font-mono">{pkg.contentHash.slice(0, 16)}…</dd></div>
                <div><dt className="inline">{t('itemCount')}: </dt><dd className="inline">{pkg.itemCount}</dd></div>
                <div><dt className="inline">{t('excludedCount')}: </dt><dd className="inline">{pkg.excludedCount}</dd></div>
                <div><dt className="inline">{t('generatedBy')}: </dt><dd className="inline">{pkg.generatedBy}</dd></div>
                <div><dt className="inline">{t('policyVersion')}: </dt><dd className="inline">{pkg.policyVersion}</dd></div>
              </dl>
              <a
                href={`/api/sage/workspaces/${workspaceId}/export-packages/${pkg.id}/download?orgId=${orgId}`}
                className="mt-2 inline-block rounded bg-gray-800 px-3 py-1 text-xs font-medium text-white hover:bg-gray-900"
              >
                {t('downloadInternal')}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
