'use client'

import { useState, useTransition } from 'react'

type DecisionLevel = 'ALLOW' | 'WARN' | 'CHALLENGE' | 'BLOCK'

interface ReplayDiff {
  changed: boolean
  levelChanged: boolean
  reasonChanged: boolean
  old: { level: DecisionLevel; reason: string; policyVersion?: string }
  new: { level: DecisionLevel; reason: string; policyVersion?: string }
}

interface TraceEntry {
  policyId: string
  policyVersion: string
  level: DecisionLevel
  reason: string
  auditSeverity: string
  requiresJustification: boolean
  requiresApproval: boolean
}

interface ReplayData {
  diff: ReplayDiff
  riskFlag: 'low' | 'medium' | 'high'
  trace?: TraceEntry[]
}

interface ReplayResult {
  ok: boolean
  data?: ReplayData
  error?: string
}

const levelColour: Record<DecisionLevel, string> = {
  ALLOW: 'text-green-600 dark:text-green-400',
  WARN: 'text-yellow-600 dark:text-yellow-400',
  CHALLENGE: 'text-orange-600 dark:text-orange-400',
  BLOCK: 'text-red-600 dark:text-red-400',
}

const riskBadge: Record<string, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
}

const PLACEHOLDER = JSON.stringify(
  {
    orgId: 'org_example',
    actorId: 'user_example',
    actorRole: 'member',
    domain: 'labour',
    action: 'submit_claim',
    resource: 'claim:12345',
    environment: 'production',
    payload: { sensitiveAction: false },
    previousDecision: {
      level: 'ALLOW',
      reason: 'Standard claim submission within policy.',
      policyVersion: '1.0.0',
    },
  },
  null,
  2,
)

export function PolicyReplayPanel() {
  const [json, setJson] = useState('')
  const [targetVersion, setTargetVersion] = useState('1.0.0')
  const [result, setResult] = useState<ReplayData | null>(null)
  const [parseError, setParseError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setParseError(null)
    setResult(null)

    let historicalDecision: unknown
    try {
      historicalDecision = JSON.parse(json)
    } catch {
      setParseError('Invalid JSON — check the pasted decision object.')
      return
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/policies/replay', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ historicalDecision, newPolicyVersion: targetVersion }),
        })
        const payload: ReplayResult = await res.json()
        if (!payload.ok || !payload.data) {
          setResult({ diff: null as unknown as ReplayDiff, riskFlag: 'high' })
          setParseError(payload.error ?? 'Replay failed — check the request fields.')
        } else {
          setResult(payload.data)
        }
      } catch {
        setResult({ diff: null as unknown as ReplayDiff, riskFlag: 'high' })
        setParseError('Network error — could not reach replay endpoint.')
      }
    })
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <h2 className="text-base font-semibold text-foreground">Live policy replay</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Paste a historical decision context and choose a target policy version to see how the engine would rule today.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Historical decision context (JSON)
          </label>
          <textarea
            className="w-full rounded border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            rows={12}
            placeholder={PLACEHOLDER}
            value={json}
            onChange={(e) => setJson(e.target.value)}
            spellCheck={false}
            required
          />
          {parseError && (
            <p className="mt-1 text-xs text-red-500">{parseError}</p>
          )}
        </div>

        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-medium text-muted-foreground mb-1">
              Target policy version
            </label>
            <input
              type="text"
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              placeholder="e.g. 1.0.0"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isPending || !json.trim()}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Running replay…' : 'Run replay'}
          </button>
        </div>
      </form>

      {result?.diff && (
        <div className="mt-5 space-y-4">
          <>
            {/* Summary bar */}
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold ${riskBadge[result.riskFlag]}`}
              >
                Risk: {result.riskFlag.toUpperCase()}
              </span>
                {result.diff.changed ? (
                  <span className="text-xs font-medium text-orange-600 dark:text-orange-400">
                    Decision changed
                  </span>
              ) : (
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                  No change — policy stable
                </span>
              )}
            </div>

            {/* Side-by-side diff */}
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div className="rounded border border-border bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Historical</p>
                <p>
                  <span className="text-muted-foreground text-xs">Level: </span>
                  <span className={`font-semibold ${levelColour[result.diff.old.level]}`}>{result.diff.old.level}</span>
                  {result.diff.levelChanged && <span className="ml-1.5 text-xs text-orange-500">← changed</span>}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">{result.diff.old.reason}</p>
                {result.diff.old.policyVersion && (
                  <p className="text-xs text-muted-foreground">v{result.diff.old.policyVersion}</p>
                )}
              </div>

              <div className="rounded border border-border bg-muted/30 p-3 space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Replayed ({targetVersion})</p>
                <p>
                  <span className="text-muted-foreground text-xs">Level: </span>
                  <span className={`font-semibold ${levelColour[result.diff.new.level]}`}>{result.diff.new.level}</span>
                  {result.diff.levelChanged && <span className="ml-1.5 text-xs text-orange-500">← changed</span>}
                </p>
                <p className="text-xs text-muted-foreground leading-snug">{result.diff.new.reason}</p>
                {result.diff.new.policyVersion && (
                  <p className="text-xs text-muted-foreground">v{result.diff.new.policyVersion}</p>
                )}
              </div>
            </div>

            {/* Trace table */}
            {result.trace && result.trace.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                  Show rule trace ({result.trace.length} rules fired)
                </summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="px-2 py-1 text-left text-muted-foreground">Policy ID</th>
                        <th className="px-2 py-1 text-left text-muted-foreground">Version</th>
                        <th className="px-2 py-1 text-left text-muted-foreground">Level</th>
                        <th className="px-2 py-1 text-left text-muted-foreground">Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.trace.map((entry, i) => (
                        <tr key={`${entry.policyId}-${i}`} className="border-b border-border/50">
                          <td className="px-2 py-1 font-mono">{entry.policyId}</td>
                          <td className="px-2 py-1 font-mono text-muted-foreground">v{entry.policyVersion}</td>
                          <td className={`px-2 py-1 font-semibold ${levelColour[entry.level]}`}>{entry.level}</td>
                          <td className="px-2 py-1 text-muted-foreground">{entry.reason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            )}
          </>
        </div>
      )}
    </section>
  )
}
