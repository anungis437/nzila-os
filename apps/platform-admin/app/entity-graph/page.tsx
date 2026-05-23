/**
 * Platform Admin — Entity Graph Explorer
 *
 * Server component that loads the entire org-tenant graph
 * (`platform_entity_nodes` + `platform_entity_edges`) from Postgres and
 * hands it to a small client island for in-memory traversal via
 * `@nzila/platform-entity-graph`. Org-admin / org-secretary can add nodes
 * and edges through the dialogs surfaced from the same component.
 */
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getPageOrgContext } from '../../lib/page-org-context'
import {
  listAllEdges,
  listAllNodes,
} from '../../lib/entity-graph-store'
import {
  ActiveOrgBadge,
  ForbiddenPanel,
  OrgPickerPanel,
} from '../../lib/org-page-fallbacks'
import { canWrite } from '../../lib/org-scope-guard'
import {
  EntityGraphExplorer,
  NewEdgeDialog,
  NewEntityNodeDialog,
} from './_components/entity-graph-actions'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Entity Graph | Platform Admin',
}

export default async function EntityGraphPage({
  searchParams,
}: {
  searchParams: Promise<{ orgId?: string }>
}) {
  const sp = await searchParams
  const result = await getPageOrgContext(sp)

  if (result.status === 'unauthenticated') redirect('/sign-in')
  if (result.status === 'no-selection') {
    return (
      <OrgPickerPanel
        candidates={result.candidates}
        returnTo="/entity-graph"
      />
    )
  }
  if (result.status === 'forbidden') {
    return <ForbiddenPanel orgId={result.orgId} />
  }

  const { orgId, orgName, orgRole } = result.context
  const [nodes, edges] = await Promise.all([
    listAllNodes(orgId),
    listAllEdges(orgId),
  ])
  const writable = canWrite(orgRole)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Platform Admin
        </Link>
        <ActiveOrgBadge orgName={orgName} orgId={orgId} orgRole={orgRole} />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Entity Graph Explorer
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            BFS traversal across the canonical business ontology. {nodes.length}{' '}
            nodes, {edges.length} edges loaded for this tenant.
          </p>
        </div>
        {writable && (
          <div className="flex items-center gap-2">
            <NewEdgeDialog orgId={orgId} nodes={nodes} />
            <NewEntityNodeDialog orgId={orgId} />
          </div>
        )}
      </div>

      <EntityGraphExplorer tenantId={orgId} nodes={nodes} edges={edges} />
    </div>
  )
}
