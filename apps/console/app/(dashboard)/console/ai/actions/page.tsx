/**
 * /console/ai/actions — AI Actions Dashboard
 *
 * Lists all AI actions with filters by status, actionType, appKey.
 * Shows action details, run status, and attestation links.
 */
import { db } from '@nzila/db'
import { aiActions, aiActionRuns, documents } from '@nzila/db/schema'
import { eq, desc, and, sql } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { generateSasUrl } from '@nzila/blob'

export const dynamic = 'force-dynamic'

// TODO: get from session/auth context
const DEFAULT_ENTITY_ID = process.env.NZILA_DEFAULT_ENTITY_ID ?? ''

async function getActionsData(entityId: string) {
  const actions = await db
    .select()
    .from(aiActions)
    .where(eq(aiActions.entityId, entityId))
    .orderBy(desc(aiActions.createdAt))
    .limit(50)

  const runs = await db
    .select()
    .from(aiActionRuns)
    .where(eq(aiActionRuns.entityId, entityId))
    .orderBy(desc(aiActionRuns.startedAt))
    .limit(100)

  return { actions, runs }
}

const STATUS_COLORS: Record<string, string> = {
  proposed: 'bg-yellow-100 text-yellow-800',
  policy_checked: 'bg-blue-100 text-blue-800',
  awaiting_approval: 'bg-orange-100 text-orange-800',
  approved: 'bg-green-100 text-green-800',
  executing: 'bg-purple-100 text-purple-800',
  executed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  rejected: 'bg-gray-100 text-gray-800',
  expired: 'bg-gray-100 text-gray-500',
}

export default async function AiActionsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  if (!DEFAULT_ENTITY_ID) {
    return <div className="p-8 text-red-600">NZILA_DEFAULT_ENTITY_ID not configured</div>
  }

  const { actions, runs } = await getActionsData(DEFAULT_ENTITY_ID)

  // Group runs by actionId
  const runsByAction = new Map<string, typeof runs>()
  for (const run of runs) {
    const existing = runsByAction.get(run.actionId) ?? []
    existing.push(run)
    runsByAction.set(run.actionId, existing)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Actions</h1>
        <div className="text-sm text-muted-foreground">
          {actions.length} actions
        </div>
      </div>

      <div className="rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Action Type</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Risk</th>
              <th className="px-4 py-3 text-left font-medium">App / Profile</th>
              <th className="px-4 py-3 text-left font-medium">Requested By</th>
              <th className="px-4 py-3 text-left font-medium">Runs</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {actions.map((action) => {
              const actionRuns = runsByAction.get(action.id) ?? []
              const latestRun = actionRuns[0]
              return (
                <tr key={action.id} className="border-b hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono text-xs">
                    {action.actionType}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[action.status] ?? 'bg-gray-100'}`}>
                      {action.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {action.riskTier}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {action.appKey} / {action.profileKey}
                  </td>
                  <td className="px-4 py-3 text-xs truncate max-w-[120px]">
                    {action.requestedBy}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {actionRuns.length > 0 ? (
                      <span className={latestRun?.status === 'success' ? 'text-green-600' : latestRun?.status === 'failed' ? 'text-red-600' : 'text-blue-600'}>
                        {actionRuns.length} run{actionRuns.length !== 1 ? 's' : ''} ({latestRun?.status})
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(action.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {action.status === 'approved' && (
                        <ExecuteButton actionId={action.id} entityId={action.entityId} />
                      )}
                      {latestRun?.attestationDocumentId && (
                        <span className="text-xs text-blue-600">attestation</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {actions.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                  No AI actions yet. Use the API or convenience routes to create one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ExecuteButton({ actionId, entityId }: { actionId: string; entityId: string }) {
  return (
    <form action={`/api/ai/actions/execute`} method="POST">
      <input type="hidden" name="actionId" value={actionId} />
      <input type="hidden" name="entityId" value={entityId} />
      <button
        type="submit"
        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
      >
        Execute
      </button>
    </form>
  )
}
