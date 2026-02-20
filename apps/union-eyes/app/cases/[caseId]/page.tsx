/**
 * apps/union-eyes/app/cases/[caseId]/page.tsx
 *
 * Case detail page — displays full case metadata alongside the CaseSignalsPanel.
 *
 * CONSTRAINT: ML data is consumed exclusively via CaseSignalsPanel (→ @nzila/ml-sdk hooks).
 * No direct DB or ml* schema imports.
 *
 * Layout assumption:
 *   - A parent layout or server component provides the `entityId` (e.g. from session / URL)
 *   - The page receives caseId from Next.js dynamic route params
 *   - Core case data (non-ML) is fetched from a UE-internal API
 */
'use client'

import { use, useEffect, useState } from 'react'
import { useAuth } from '@clerk/nextjs'
import { CaseSignalsPanel } from '@/components/ml/CaseSignalsPanel'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UECaseDetail {
  id: string
  entityId: string
  category: string
  channel: string
  status: string
  assignedQueue: string | null
  priority: string
  slaBreached: boolean
  reopenCount: number
  messageCount: number
  attachmentCount: number
  createdAt: string
  updatedAt: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 w-36 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right">{children}</span>
    </div>
  )
}

function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`block rounded bg-gray-100 animate-pulse ${className}`} />
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

/**
 * Fetches UE case details from the UE internal API.
 * Replace with the real endpoint as the UE data layer stabilises.
 */
async function fetchCaseDetail(
  entityId: string,
  caseId: string,
  token: string,
): Promise<UECaseDetail | null> {
  const ueApiBase = process.env.NEXT_PUBLIC_UE_API_URL ?? 'http://localhost:3003'
  const res = await fetch(`${ueApiBase}/api/cases/${caseId}?entityId=${entityId}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Failed to load case: ${res.status}`)
  return res.json() as Promise<UECaseDetail>
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ caseId: string }>
  searchParams?: Promise<{ entityId?: string }>
}

export default function CaseDetailPage({ params, searchParams }: PageProps) {
  const { caseId } = use(params)
  const sp = use(searchParams ?? Promise.resolve({} as { entityId?: string }))
  // entityId comes from the URL search param; in production, derive from session instead.
  const entityId = sp.entityId ?? ''

  const { getToken } = useAuth()
  const [detail, setDetail] = useState<UECaseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!entityId || !caseId) return
    let cancelled = false

    ;(async () => {
      try {
        const token = (await getToken()) ?? ''
        const data = await fetchCaseDetail(entityId, caseId, token)
        if (!cancelled) setDetail(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load case')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [entityId, caseId, getToken])

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center space-x-1 text-sm text-gray-500">
        <Link href="/cases" className="hover:text-indigo-600 transition-colors">
          Cases
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-mono">{caseId.slice(0, 8)}…</span>
      </nav>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Case details card */}
        <div className="lg:col-span-2 space-y-4">
          <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900">Case details</h2>
            </div>
            <div className="px-4 py-3">
              {error && (
                <p className="text-sm text-red-600 mb-4">{error}</p>
              )}

              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-5 w-full" />
                  ))}
                </div>
              ) : !detail ? (
                <p className="text-sm text-gray-400">Case not found.</p>
              ) : (
                <>
                  <DetailRow label="Case ID">
                    <span className="font-mono text-xs">{detail.id}</span>
                  </DetailRow>
                  <DetailRow label="Category">{detail.category}</DetailRow>
                  <DetailRow label="Channel">{detail.channel}</DetailRow>
                  <DetailRow label="Status">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700">
                      {detail.status}
                    </span>
                  </DetailRow>
                  <DetailRow label="Priority (source)">{detail.priority}</DetailRow>
                  <DetailRow label="Assigned queue">
                    {detail.assignedQueue ?? <span className="text-gray-400">—</span>}
                  </DetailRow>
                  <DetailRow label="SLA breached">
                    {detail.slaBreached ? (
                      <span className="text-red-600 font-medium">Yes</span>
                    ) : (
                      <span className="text-emerald-600">No</span>
                    )}
                  </DetailRow>
                  <DetailRow label="Messages">{detail.messageCount}</DetailRow>
                  <DetailRow label="Attachments">{detail.attachmentCount}</DetailRow>
                  <DetailRow label="Reopens">{detail.reopenCount}</DetailRow>
                  <DetailRow label="Created">
                    {new Date(detail.createdAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </DetailRow>
                  <DetailRow label="Last updated">
                    {new Date(detail.updatedAt).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </DetailRow>
                </>
              )}
            </div>
          </section>
        </div>

        {/* Signals sidebar */}
        <div className="space-y-4">
          {entityId && caseId ? (
            <CaseSignalsPanel entityId={entityId} caseId={caseId} />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white shadow-sm px-4 py-8 text-center text-sm text-gray-400">
              Entity context required to load ML signals.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
