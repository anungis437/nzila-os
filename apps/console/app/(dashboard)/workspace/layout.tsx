import { WorkspaceTabs } from './_components/workspace-tabs'

/**
 * Nzila Console — the six-workspace operating surface.
 *
 * This route group sits inside the existing (dashboard) layout (which provides
 * auth, sidebar, and command palette) and overlays the Club360-style workspace
 * tab bar across the top. See docs/doctrine/NZILA_CONSOLE_WORKSPACE_DOCTRINE.md.
 */
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-col">
      <WorkspaceTabs />
      <div className="flex-1">{children}</div>
    </div>
  )
}
