/**
 * Data Freshness Panel — Client Component.
 *
 * Shows verification status of every @nzila/tax data module.
 * Surfaces stale modules that need a refresh.
 */
'use client'

import {
  DATA_VERSIONS,
  isModuleStale,
  getLatestVerificationDate,
} from '@/lib/tax'
import type { DataModuleVersion } from '@nzila/tax'

function daysSince(dateStr: string): number {
  const diff = Date.now() - new Date(dateStr).getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

function StatusBadge({ stale }: { stale: boolean }) {
  if (stale) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600">
        Stale
      </span>
    )
  }
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
      Fresh
    </span>
  )
}

export function DataFreshnessPanel() {
  const modules: DataModuleVersion[] = DATA_VERSIONS
  const latestDate = getLatestVerificationDate()
  const allFresh = modules.every((m) => !isModuleStale(m))

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Last verified: <span className="font-medium text-foreground">{latestDate}</span>
        </p>
        {allFresh ? (
          <span className="text-xs font-medium text-emerald-600">All modules current</span>
        ) : (
          <span className="text-xs font-medium text-amber-600">Some modules need review</span>
        )}
      </div>

      {/* Module Table */}
      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-secondary/50">
            <tr>
              <th className="px-3 py-2 font-medium text-muted-foreground">Module</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Tax Year</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Verified</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Age</th>
              <th className="px-3 py-2 font-medium text-muted-foreground">Source</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm">
            {modules.map((mod) => {
              const stale = isModuleStale(mod)
              const age = daysSince(mod.lastVerified)
              return (
                <tr key={mod.module} className="hover:bg-secondary/30">
                  <td className="px-3 py-2 font-mono text-foreground">{mod.module}</td>
                  <td className="px-3 py-2 text-muted-foreground">{mod.taxYear}</td>
                  <td className="px-3 py-2 text-muted-foreground">{mod.lastVerified}</td>
                  <td className="px-3 py-2 text-muted-foreground">{age}d</td>
                  <td className="px-3 py-2 text-muted-foreground" title={mod.notes ?? ''}>
                    {mod.source}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <StatusBadge stale={stale} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
