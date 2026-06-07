import { WorkspaceShell } from '../_components/workspace-shell'
import { LegacyBridge } from '../_components/legacy-bridge'
import { resolveSubTab } from '../_lib/nav'
import { bridgeFor } from '../_lib/legacy-map'
import { requireWorkspaceUser } from '../_lib/workspace-auth'
import { AiManagementPanel } from './_components/ai-management-panel'

export const dynamic = 'force-dynamic'

export default async function OperationsWorkspace({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  await requireWorkspaceUser()

  const { tab } = await searchParams
  const activeTab = resolveSubTab('operations', tab)

  if (activeTab === 'ai') {
    return (
      <WorkspaceShell workspace="operations" activeTab={activeTab}>
        <AiManagementPanel />
      </WorkspaceShell>
    )
  }

  const panel = bridgeFor('operations', activeTab)

  return (
    <WorkspaceShell workspace="operations" activeTab={activeTab}>
      {panel ? (
        <LegacyBridge title={panel.title} intro={panel.intro} links={panel.links} />
      ) : (
        <p className="text-sm text-gray-500">No surfaces in this section yet.</p>
      )}
    </WorkspaceShell>
  )
}
