'use client'

/**
 * Console workspace telemetry emitter.
 *
 * Fires a `workspace.view` (and, when present, `tab.view`) beacon whenever the
 * active workspace or sub-tab changes. Best-effort: telemetry must never break
 * the page. See docs/doctrine/NZILA_CONSOLE_TELEMETRY_SCHEMA.md.
 */
import { useEffect } from 'react'

interface ConsoleBeacon {
  type: 'workspace.view' | 'tab.view'
  workspace: string
  tab: string | null
}

function emit(events: ConsoleBeacon[]): void {
  if (events.length === 0) return
  const payload = JSON.stringify(events)
  try {
    if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon('/api/_telemetry/console', blob)
    } else {
      void fetch('/api/_telemetry/console', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        keepalive: true,
      })
    }
  } catch {
    /* best-effort telemetry; never break the page */
  }
}

export function WorkspaceTelemetry({
  workspace,
  tab = null,
}: {
  workspace: string
  tab?: string | null
}) {
  useEffect(() => {
    const events: ConsoleBeacon[] = [{ type: 'workspace.view', workspace, tab }]
    if (tab) events.push({ type: 'tab.view', workspace, tab })
    emit(events)
  }, [workspace, tab])

  return null
}
