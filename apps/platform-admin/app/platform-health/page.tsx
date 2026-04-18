'use client'

import { useEffect, useState } from 'react'
import {
  PLATFORM_SLOS,
  meetsSlo,
  type SloTarget,
} from '@nzila/platform-observability/reliability'

/**
 * Platform Health Dashboard
 *
 * Shows SLO definitions, error budget status, and platform health overview.
 * In production, wired to live metrics. In dev, renders baseline SLO catalog.
 */

const _STATUS_LABELS: Record<string, string> = {
  ok: '✅ Healthy',
  warning: '⚠️ Warning',
  danger: '🔴 Critical',
  exhausted: '💀 Exhausted',
}

function sloStatusColor(met: boolean): string {
  return met ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'
}

function _budgetStatusColor(remaining: number): string {
  if (remaining > 50) return 'text-green-600'
  if (remaining > 10) return 'text-yellow-600'
  return 'text-red-600'
}

type DependencyStatus = 'up' | 'degraded' | 'down'
type DependencyItem = {
  name: 'control-plane' | 'orchestrator' | 'db' | 'queues' | 'metrics'
  status: DependencyStatus
  detail: string
  latencyMs?: number
}

function dependencyBadge(status: DependencyStatus): string {
  if (status === 'up') return 'bg-green-100 text-green-700'
  if (status === 'degraded') return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

export default function PlatformHealthPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [deps, setDeps] = useState<DependencyItem[]>([])
  const [depsError, setDepsError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadDependencies() {
      try {
        const res = await fetch('/api/health/dependencies', { cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json() as { ok: boolean; data: { dependencies: DependencyItem[] } }
        if (!cancelled) {
          setDeps(json.data.dependencies)
          setDepsError(null)
        }
      } catch (error) {
        if (!cancelled) {
          setDepsError(`Dependency check unavailable: ${String(error)}`)
        }
      }
    }

    void loadDependencies()
    return () => {
      cancelled = true
    }
  }, [])

  const sloEntries = Object.entries(PLATFORM_SLOS) as Array<[string, SloTarget]>
  const categories = [...new Set(sloEntries.map(([, slo]) => slo.category ?? 'uncategorized'))]

  const filtered =
    selectedCategory === 'all'
      ? sloEntries
      : sloEntries.filter(([, slo]) => (slo.category ?? 'uncategorized') === selectedCategory)

  // In production, metric values come from a metrics API.
  // In dev, we show the SLO catalog without claiming any status.
  const metricValues: Record<string, number | undefined> = {}

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Platform Health</h1>
      <p className="mb-6 text-gray-500">
        SLO catalog, error budgets, and platform health overview.{' '}
        {sloEntries.length} SLOs defined across {categories.length} categories.
      </p>

      <div className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Dependency Status</h2>

        {depsError && (
          <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {depsError}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {(['control-plane', 'orchestrator', 'db', 'queues', 'metrics'] as const).map((name) => {
            const item = deps.find((d) => d.name === name)
            const status = item?.status ?? 'down'
            return (
              <div key={name} className="rounded border border-gray-100 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${dependencyBadge(status)}`}>
                    {status}
                  </span>
                </div>
                <div className="text-xs text-gray-600">{item?.detail ?? 'no data'}</div>
                {item?.latencyMs !== undefined && (
                  <div className="mt-1 text-[11px] text-gray-400">{item.latencyMs}ms</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Category filter */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            selectedCategory === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          All ({sloEntries.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* SLO table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50">
              <th className="px-4 py-3 font-medium text-gray-500">SLO</th>
              <th className="px-4 py-3 font-medium text-gray-500">Category</th>
              <th className="px-4 py-3 font-medium text-gray-500">Target</th>
              <th className="px-4 py-3 font-medium text-gray-500">Window</th>
              <th className="px-4 py-3 font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(([name, slo]) => {
              const value = metricValues[name]
              const hasData = value !== undefined
              const met = hasData ? meetsSlo(slo, value) : undefined
              return (
                <tr key={name} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-800">{name}</td>
                  <td className="px-4 py-2">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      {slo.category ?? 'uncategorized'}
                    </span>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">
                    {slo.target > 1 ? `${slo.target}ms` : `${(slo.target * 100).toFixed(1)}%`}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500">{Math.round(slo.windowHours / 24)}d</td>
                  <td className="px-4 py-2">
                    {hasData ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${sloStatusColor(met!)}`}
                      >
                        {met ? 'Met' : 'Breached'}
                      </span>
                    ) : (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                        No data
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="p-8 text-center text-gray-400">No SLOs in this category.</div>
        )}
      </div>
    </div>
  )
}
