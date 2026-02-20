'use client'

import { useState } from 'react'

interface RetentionRunResult {
  runId: string
  startedAt: string
  completedAt: string
  processedCount: number
  archivedCount: number
  deletedCount: number
  redactedCount: number
  skippedCount: number
  errors: Array<{ documentId: string; error: string }>
}

export default function RetentionAdminPage() {
  const [result, setResult] = useState<RetentionRunResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function runRetention() {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await fetch('/api/admin/retention/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dryRun, limit: 500 }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? `HTTP ${res.status}`)
      }

      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message ?? 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-bold">Retention Enforcement</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manually trigger the retention enforcement job. Documents past their retention period
          will be archived or deleted per policy.
        </p>
      </div>

      <div className="rounded-lg border p-4 space-y-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">
            <strong>Dry run</strong> — log actions without executing them
          </span>
        </label>

        <button
          onClick={runRetention}
          disabled={loading}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? 'Running…' : dryRun ? 'Run Dry Run' : 'Run Enforcement'}
        </button>
      </div>

      {error && (
        <div className="rounded border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-lg border p-4 space-y-3">
          <h2 className="font-semibold">Run {result.runId}</h2>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">Started</dt>
            <dd>{new Date(result.startedAt).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Completed</dt>
            <dd>{new Date(result.completedAt).toLocaleString()}</dd>
            <dt className="text-muted-foreground">Processed</dt>
            <dd>{result.processedCount}</dd>
            <dt className="text-muted-foreground">Archived</dt>
            <dd>{result.archivedCount}</dd>
            <dt className="text-muted-foreground">Deleted</dt>
            <dd>{result.deletedCount}</dd>
            <dt className="text-muted-foreground">Redacted</dt>
            <dd>{result.redactedCount}</dd>
            <dt className="text-muted-foreground">Skipped</dt>
            <dd>{result.skippedCount}</dd>
            <dt className="text-muted-foreground">Errors</dt>
            <dd>{result.errors.length}</dd>
          </dl>

          {result.errors.length > 0 && (
            <div className="text-sm text-destructive space-y-1">
              <p className="font-medium">Errors:</p>
              {result.errors.map((e) => (
                <p key={e.documentId}>
                  {e.documentId}: {e.error}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
