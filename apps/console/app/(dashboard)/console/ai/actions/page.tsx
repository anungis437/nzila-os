/**
 * /console/ai/actions — AI Actions Dashboard
 *
 * Lists all AI actions with filters by status, actionType, appKey.
 * Shows action details, run status, and attestation links.
 */
import { platformDb } from '@nzila/db/platform'
import { aiActions, aiActionRuns, aiCapabilityProfiles, aiDeploymentRoutes } from '@nzila/db/schema'
import { eq, desc, count } from 'drizzle-orm'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { resolveConsoleEntityId } from '@/lib/entity-context'

export const dynamic = 'force-dynamic'

async function getActionsData(orgId: string) {
  const actions = await platformDb
    .select()
    .from(aiActions)
    .where(eq(aiActions.orgId, orgId))
    .orderBy(desc(aiActions.createdAt))
    .limit(50)

  const runs = await platformDb
    .select()
    .from(aiActionRuns)
    .where(eq(aiActionRuns.orgId, orgId))
    .orderBy(desc(aiActionRuns.startedAt))
    .limit(100)

  const [profileCount] = await platformDb
    .select({ count: count() })
    .from(aiCapabilityProfiles)
    .where(eq(aiCapabilityProfiles.orgId, orgId))

  const [routeCount] = await platformDb
    .select({ count: count() })
    .from(aiDeploymentRoutes)
    .where(eq(aiDeploymentRoutes.orgId, orgId))

  const actionSummary = {
    total: actions.length,
    approved: actions.filter((action) => action.status === 'approved').length,
    pending: actions.filter((action) => ['proposed', 'policy_checked', 'awaiting_approval', 'executing'].includes(action.status)).length,
    failed: actions.filter((action) => action.status === 'failed').length,
  }

  return {
    actions,
    runs,
    actionSummary,
    profileCount: profileCount?.count ?? 0,
    routeCount: routeCount?.count ?? 0,
  }
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
  const orgId = await resolveConsoleEntityId(userId)
  if (!orgId) {
    return <div className="p-8 text-red-600">No active org membership or fallback entity configured</div>
  }

  const { actions, runs, actionSummary, profileCount, routeCount } = await getActionsData(orgId)

  const runsByAction = new Map<string, typeof runs>()
  for (const run of runs) {
    const existing = runsByAction.get(run.actionId) ?? []
    existing.push(run)
    runsByAction.set(run.actionId, existing)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-2 pb-8 sm:px-4">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-linear-to-br from-card via-card to-muted/40 p-6 shadow-sm">
        <div className="absolute -left-8 top-10 h-28 w-28 rounded-full bg-amber-500/10 blur-2xl" />
        <div className="absolute -right-8 bottom-0 h-32 w-32 rounded-full bg-cyan-500/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Console / AI</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI Actions</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Review deterministic action proposals, approval state, execution attempts, and attestation readiness for local console workflows.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/console/ai/overview" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Overview
            </Link>
            <Link href="/console/ai/models" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Models
            </Link>
            <Link href="/console/ai/knowledge" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Knowledge
            </Link>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total Actions" value={String(actionSummary.total)} tone="amber" />
          <StatCard label="Pending or Running" value={String(actionSummary.pending)} tone="blue" />
          <StatCard label="Profiles Live" value={String(profileCount)} tone="emerald" />
          <StatCard label="Routes Live" value={String(routeCount)} tone="violet" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">Recent Actions</h2>
              <p className="text-sm text-muted-foreground">Latest proposals and execution history for the configured local entity.</p>
            </div>
            <div className="text-sm text-muted-foreground">{actions.length} actions</div>
          </div>

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
                  <td className="px-4 py-3 text-xs truncate max-w-30">
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
                        <ExecuteButton actionId={action.id} orgId={action.orgId} />
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
                  No AI actions yet for this local entity.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold">Action Readiness</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-3">
                <div>
                  <p className="font-medium">Knowledge profile</p>
                  <p className="text-muted-foreground">Supports `actions_propose` for knowledge ingestion.</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Ready</span>
              </div>
              <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-3">
                <div>
                  <p className="font-medium">Finance profile</p>
                  <p className="text-muted-foreground">Supports Stripe monthly report generation proposals.</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Ready</span>
              </div>
              <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-3">
                <div>
                  <p className="font-medium">Execution state</p>
                  <p className="text-muted-foreground">Approved actions can be executed directly from this table.</p>
                </div>
                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">Enabled</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-base font-semibold">Next Actions</h2>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>Use the knowledge page to create your first ingestion proposal, or finance Stripe to create a report-generation proposal.</p>
              <div className="flex flex-wrap gap-2">
                <Link href="/console/ai/knowledge" className="rounded-md border px-3 py-1.5 text-foreground hover:bg-muted/70">
                  Open Knowledge
                </Link>
                <Link href="/console/finance/stripe" className="rounded-md border px-3 py-1.5 text-foreground hover:bg-muted/70">
                  Open Finance Stripe
                </Link>
              </div>
            </div>
          </div>

          {actions.length === 0 && (
            <div className="rounded-2xl border border-dashed bg-muted/20 p-5 text-sm text-muted-foreground shadow-sm">
              The local AI bootstrap is present, but there are no proposed actions yet. This page will populate after the first knowledge ingest or finance action proposal is created.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'amber' | 'blue' | 'emerald' | 'violet'
}) {
  const tones: Record<typeof tone, string> = {
    amber: 'border-amber-500/20 bg-amber-500/5 text-amber-700 dark:text-amber-300',
    blue: 'border-blue-500/20 bg-blue-500/5 text-blue-700 dark:text-blue-300',
    emerald: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300',
    violet: 'border-violet-500/20 bg-violet-500/5 text-violet-700 dark:text-violet-300',
  }

  return (
    <div className={`rounded-xl border px-4 py-4 ${tones[tone]}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  )
}

function ExecuteButton({ actionId, orgId }: { actionId: string; orgId: string }) {
  return (
    <form action={`/api/ai/actions/execute`} method="POST">
      <input type="hidden" name="actionId" value={actionId} />
      <input type="hidden" name="orgId" value={orgId} />
      <button
        type="submit"
        className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
      >
        Execute
      </button>
    </form>
  )
}
