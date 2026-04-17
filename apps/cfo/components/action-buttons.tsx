/**
 * CFO — Action Buttons (Client Components).
 *
 * Replaces broken form POSTs to /api/* routes with proper
 * server action calls.
 */
'use client'

import { useState, useTransition } from 'react'
import { RefreshCw, Loader2, Plug } from 'lucide-react'
import { runReconciliation } from '@/lib/actions/ledger-actions'
import {
  connectIntegration,
  triggerSync,
  type IntegrationProvider,
} from '@/lib/actions/integration-actions'

/* ─── Reconciliation Button ─── */

export function ReconcileButton() {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await runReconciliation()
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-2 rounded-lg bg-electric px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-electric/90 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {isPending ? 'Running…' : 'Run Reconciliation'}
    </button>
  )
}

/* ─── Sync Button ─── */

export function SyncButton({ provider }: { provider: string }) {
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      await triggerSync(provider as IntegrationProvider)
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="h-3 w-3" />
      )}
      {isPending ? 'Syncing…' : 'Sync Now'}
    </button>
  )
}

/* ─── Connect Button ─── */

export function ConnectButton({ provider }: { provider: string }) {
  const [isPending, startTransition] = useTransition()
  const [connected, setConnected] = useState(false)

  function handleClick() {
    startTransition(async () => {
      const result = await connectIntegration(provider as IntegrationProvider)
      if (result.success) {
        setConnected(true)
      }

      if (result.redirectUrl && typeof window !== 'undefined') {
        window.location.href = result.redirectUrl
      }
    })
  }

  if (connected) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-600">
        <Plug className="h-3 w-3" /> Connected
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg bg-electric px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-electric/90 disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <Plug className="h-3 w-3" />
      )}
      {isPending ? 'Connecting…' : 'Connect'}
    </button>
  )
}
