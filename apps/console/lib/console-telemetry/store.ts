/**
 * Console workspace telemetry — bounded, dependency-free ring buffer.
 *
 * Records navigation events (workspace.view / tab.view) for the six-workspace
 * surface so we can learn which workspaces and sub-tabs earn their place.
 *
 * Mirrors lib/perf/store.ts: in-process only, O(1) push, no DB, no PII.
 * See docs/doctrine/NZILA_CONSOLE_TELEMETRY_SCHEMA.md for the contract.
 */
const MAX_EVENTS = 5000

export const CONSOLE_EVENT_TYPES = ['workspace.view', 'tab.view'] as const
export type ConsoleEventType = (typeof CONSOLE_EVENT_TYPES)[number]

export const CONSOLE_WORKSPACES = [
  'overview',
  'portfolio',
  'observatory',
  'sales',
  'ventures',
  'operations',
  'settings',
] as const
export type ConsoleWorkspace = (typeof CONSOLE_WORKSPACES)[number]

export interface ConsoleEvent {
  type: ConsoleEventType
  workspace: ConsoleWorkspace
  tab: string | null
  ts: number
}

const events: ConsoleEvent[] = []

export function recordConsoleEvent(event: ConsoleEvent): void {
  events.push(event)
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS)
}

export interface WorkspaceViewSummary {
  workspace: ConsoleWorkspace
  views: number
  tabs: { tab: string; views: number }[]
}

export function summarizeWorkspaceViews(windowMs = 24 * 60 * 60 * 1000): WorkspaceViewSummary[] {
  const cutoff = Date.now() - windowMs
  const recent = events.filter((e) => e.ts >= cutoff)
  return CONSOLE_WORKSPACES.map((workspace) => {
    const own = recent.filter((e) => e.workspace === workspace)
    const tabCounts = new Map<string, number>()
    for (const e of own) {
      if (e.type === 'tab.view' && e.tab) {
        tabCounts.set(e.tab, (tabCounts.get(e.tab) ?? 0) + 1)
      }
    }
    return {
      workspace,
      views: own.filter((e) => e.type === 'workspace.view').length,
      tabs: [...tabCounts.entries()]
        .map(([tab, views]) => ({ tab, views }))
        .sort((a, b) => b.views - a.views),
    }
  })
}
