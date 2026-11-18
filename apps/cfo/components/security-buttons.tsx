/**
 * CFO — Security Buttons (Client Components).
 */
'use client'

import { useTransition } from 'react'
import { Loader2, ScanLine, CheckCircle2, ArrowRight } from 'lucide-react'
import { resolveSecurityEvent, updateIncidentStatus } from '@/lib/actions/security-actions'

export function SecurityScanButton() {
  return (
    <button
      type="button"
      disabled
      title="A configured security scanner is required"
      className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground opacity-60"
    >
      <ScanLine className="h-4 w-4" />
      Scanner unavailable
    </button>
  )
}

export function ResolveEventButton({ eventId }: { eventId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          await resolveSecurityEvent(eventId)
        })
      }
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <CheckCircle2 className="h-3 w-3" />
      )}
      Resolve
    </button>
  )
}

export function UpdateIncidentButton({
  incidentId,
  currentStatus,
}: {
  incidentId: string
  currentStatus: string
}) {
  const [isPending, startTransition] = useTransition()
  const nextStatus =
    currentStatus === 'open'
      ? 'investigating'
      : currentStatus === 'investigating'
        ? 'contained'
        : 'resolved'

  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          await updateIncidentStatus(
            incidentId,
            nextStatus as 'investigating' | 'contained' | 'resolved',
          )
        })
      }
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <ArrowRight className="h-3 w-3" />
      )}
      {nextStatus}
    </button>
  )
}
