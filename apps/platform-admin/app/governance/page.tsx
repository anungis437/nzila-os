'use client'

import { useState, useEffect, useCallback } from 'react'

/**
 * Cross-domain governance visibility panel for platform operators.
 *
 * Read-only view: aggregates active governed policies across all domains,
 * surfacing the latest snapshot health summary and active conflict count.
 * Platform-admin operators do NOT manage policies — they observe them.
 */

interface PolicySummary {
  id: string
  name: string
  domain: string
  semver: string
  lifecycleStatus: string
  riskClassification: string
  activatedAt?: string | null
}

interface SnapshotSummary {
  id: string
  snapshotVersion: number
  triggerType: string
  policyCount: number
  activeConflictCount: number
  takenAt: string
}

const LIFECYCLE_BADGE: Record<string, string> = {
  draft:             'bg-gray-100 text-gray-600',
  review_pending:    'bg-blue-100 text-blue-700',
  approval_required: 'bg-amber-100 text-amber-700',
  approved:          'bg-teal-100 text-teal-700',
  published:         'bg-green-100 text-green-700',
  active:            'bg-emerald-100 text-emerald-700',
  superseded:        'bg-slate-100 text-slate-600',
  deprecated:        'bg-orange-100 text-orange-700',
  revoked:           'bg-red-100 text-red-700',
  archived:          'bg-gray-50 text-gray-400',
}

const RISK_COLOR: Record<string, string> = {
  low:      'text-green-700',
  medium:   'text-amber-700',
  high:     'text-orange-700',
  critical: 'text-red-700',
}

const UNION_EYES_API = process.env.NEXT_PUBLIC_UNION_EYES_URL ?? ''

export default function CrossDomainGovernancePanel() {
  const [policies, setPolicies] = useState<PolicySummary[]>([])
  const [snapshot, setSnapshot] = useState<SnapshotSummary | null>(null)
  const [domainFilter, setDomainFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)

    const base = UNION_EYES_API

    try {
      const [policiesRes, snapshotRes] = await Promise.all([
        fetch(`${base}/api/governance/lifecycle/policies?status=${statusFilter}&limit=100${domainFilter ? `&domain=${encodeURIComponent(domainFilter)}` : ''}`),
        fetch(`${base}/api/governance/lifecycle/snapshots?limit=1`),
      ])

      if (!policiesRes.ok || !snapshotRes.ok) {
        throw new Error('Failed to fetch governance data')
      }

      const policiesData = await policiesRes.json()
      const snapshotData = await snapshotRes.json()

      setPolicies(policiesData.policies ?? [])
      setSnapshot(snapshotData.snapshots?.[0] ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, domainFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Aggregate by domain
  const byDomain = policies.reduce<Record<string, PolicySummary[]>>((acc, p) => {
    if (!acc[p.domain]) acc[p.domain] = []
    acc[p.domain].push(p)
    return acc
  }, {})

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Cross-Domain Policy Governance</h1>
      <p className="mb-6 text-gray-500">
        Read-only platform-wide view of governed policies across all domains.
        Policy management is scoped to Union Eyes governance console.
      </p>

      {/* Snapshot health bar */}
      {snapshot && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4 flex gap-6 flex-wrap">
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Snapshot</p>
            <p className="text-lg font-bold">v{snapshot.snapshotVersion}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Total Policies</p>
            <p className="text-lg font-bold">{snapshot.policyCount}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Active Conflicts</p>
            <p className={`text-lg font-bold ${snapshot.activeConflictCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {snapshot.activeConflictCount}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Trigger</p>
            <p className="text-sm font-medium">{snapshot.triggerType}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Taken</p>
            <p className="text-sm">{new Date(snapshot.takenAt).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          placeholder="Filter by domain…"
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
        />
        <select
          className="rounded border border-gray-300 px-3 py-1.5 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {['all', 'active', 'published', 'approval_required', 'draft', 'deprecated', 'revoked'].map((s) => (
            <option key={s} value={s}>{s === 'all' ? 'All statuses' : s}</option>
          ))}
        </select>
        <button
          className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
          onClick={fetchData}
          disabled={loading}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>
        <span className="self-center text-xs text-gray-400">{policies.length} policies</span>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error} — ensure NEXT_PUBLIC_UNION_EYES_URL is configured.
        </div>
      )}

      {/* Domain groups */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-lg bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : Object.keys(byDomain).length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">No policies found.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(byDomain).map(([domain, domainPolicies]) => (
            <div key={domain}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-400">
                {domain} ({domainPolicies.length})
              </h2>
              <div className="rounded-lg border border-gray-200 bg-white divide-y">
                {domainPolicies.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">v{p.semver}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${RISK_COLOR[p.riskClassification] ?? ''}`}>
                      {p.riskClassification}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${LIFECYCLE_BADGE[p.lifecycleStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                      {p.lifecycleStatus}
                    </span>
                    {p.activatedAt && (
                      <span className="text-xs text-gray-400 hidden sm:block">
                        {new Date(p.activatedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
