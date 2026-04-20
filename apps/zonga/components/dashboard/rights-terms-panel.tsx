'use client'

import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'

interface TermsLogRow {
  actorId: string
  acceptedAt: string
  metadata: { agreementVersion?: string } | null
}

export function RightsTermsPanel() {
  const [rows, setRows] = useState<TermsLogRow[]>([])
  const [isPending, startTransition] = useTransition()
  const agreementVersion = 'zonga-ms-celebrations-v1'

  useEffect(() => {
    fetch('/api/rights/terms')
      .then((res) => res.json())
      .then((payload) => setRows(Array.isArray(payload?.data) ? payload.data : []))
      .catch(() => setRows([]))
  }, [])

  function acceptTerms() {
    startTransition(async () => {
      const res = await fetch('/api/rights/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agreementVersion }),
      })

      if (res.ok) {
        const refreshed = await fetch('/api/rights/terms').then((r) => r.json())
        setRows(Array.isArray(refreshed?.data) ? refreshed.data : [])
      }
    })
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">Rights and Revenue Trust Layer</h2>
      <p className="mt-2 text-xs text-muted-foreground">
        Ownership remains with label/artist unless explicitly negotiated. Terms acceptance is auditable.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">Default exclusivity: none</div>
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">Payout timing: monthly (net 30)</div>
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">Reporting cadence: weekly snapshot + monthly close</div>
        <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs">Takedown SLA: 48 hours for valid claims</div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={acceptTerms}
          disabled={isPending}
          className="rounded-lg bg-electric px-3 py-1.5 text-xs font-medium text-white hover:bg-electric/90 disabled:opacity-50"
        >
          {isPending ? 'Recording acceptance…' : 'Accept Terms'}
        </button>
        <Link
          href="/api/rights/terms/agreement"
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50"
        >
          Download Agreement Copy
        </Link>
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold text-foreground mb-2">Accepted Terms Log</h3>
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No acceptance events recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {rows.map((row) => (
              <div key={`${row.actorId}-${row.acceptedAt}`} className="rounded-lg bg-muted/50 px-3 py-2 text-xs">
                <span className="font-medium text-foreground">{row.actorId.slice(0, 8)}…</span>{' '}
                accepted {row.metadata?.agreementVersion ?? 'agreement'} on{' '}
                {new Date(row.acceptedAt).toLocaleString()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
