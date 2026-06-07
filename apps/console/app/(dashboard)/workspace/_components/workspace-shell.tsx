import { CommandPageShell } from '@/components/command-page-shell'
import { PageHeader } from '@/components/ui'
import { WorkspaceTelemetry } from '@/components/workspace-telemetry'
import { WORKSPACES, type WorkspaceKey } from '../_lib/nav'
import { SubTabs } from './sub-tabs'

/**
 * Per-workspace server shell: title, sub-tabs, telemetry, content.
 *
 * Keeps every workspace page consistent without re-deriving the header or
 * re-wiring telemetry. The top workspace tab bar lives in the route-group layout.
 */
export function WorkspaceShell({
  workspace,
  activeTab,
  actions,
  children,
}: {
  workspace: WorkspaceKey
  /** Resolved active sub-tab (already defaulted). '' for tab-less workspaces. */
  activeTab?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const def = WORKSPACES.find((w) => w.key === workspace)
  if (!def) return null

  return (
    <CommandPageShell as="div" className="space-y-12">
      <WorkspaceTelemetry workspace={workspace} tab={activeTab || null} />
      <PageHeader
        eyebrow="Nzila Console"
        title={def.label}
        description={def.question}
        actions={actions}
      />
      {def.subTabs.length > 0 && <SubTabs tabs={def.subTabs} activeTab={activeTab ?? def.subTabs[0].key} />}
      <div className="space-y-10">{children}</div>
    </CommandPageShell>
  )
}
