'use client'

import { useState, useTransition } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui'
import { syncDealsFromHubspot } from '../../_lib/sales-actions'

interface SyncState {
  imported: number
  updated: number
  scanned: number
  error: string | null
}

/**
 * Manual "Sync HubSpot" trigger for the Sales pipeline. Renders a disabled,
 * explanatory control when HubSpot is not configured; otherwise pulls deals from
 * HubSpot and reports the result inline.
 */
export function HubspotSyncButton({ configured }: { configured: boolean }) {
  const [pending, startTransition] = useTransition()
  const [result, setResult] = useState<SyncState | null>(null)

  if (!configured) {
    return (
      <span
        className="text-xs text-gray-400"
        title="Connect HubSpot in Integrations to enable two-way CRM sync"
      >
        HubSpot not connected
      </span>
    )
  }

  function onSync() {
    startTransition(async () => {
      const summary = await syncDealsFromHubspot()
      setResult({
        imported: summary.imported,
        updated: summary.updated,
        scanned: summary.scanned,
        error: summary.error,
      })
    })
  }

  return (
    <div className="flex items-center gap-2">
      {result &&
        (result.error ? (
          <span className="text-xs text-red-600">Sync failed: {result.error}</span>
        ) : (
          <span className="text-xs text-gray-500">
            {result.imported} imported · {result.updated} updated
          </span>
        ))}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={onSync}
        disabled={pending}
        aria-label="Sync deals from HubSpot"
      >
        <ArrowPathIcon className={`h-4 w-4${pending ? ' animate-spin' : ''}`} />
        {pending ? 'Syncing…' : 'Sync HubSpot'}
      </Button>
    </div>
  )
}
