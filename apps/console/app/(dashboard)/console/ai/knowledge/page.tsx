/**
 * /console/ai/knowledge — AI Knowledge Sources Dashboard
 *
 * Lists knowledge sources, shows ingestion runs, and provides ingest button.
 */
import { platformDb } from '@nzila/db/platform'
import {
  aiKnowledgeSources,
  aiKnowledgeIngestionRuns,
  aiCapabilityProfiles,
  aiDeploymentRoutes,
} from '@nzila/db/schema'
import { eq, desc, count } from 'drizzle-orm'
import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { IngestButton } from './ingest-button'
import { resolveConsoleEntityId } from '@/lib/entity-context'

export const dynamic = 'force-dynamic'

async function getKnowledgeData(orgId: string) {
  const sources = await platformDb
    .select()
    .from(aiKnowledgeSources)
    .where(eq(aiKnowledgeSources.orgId, orgId))
    .orderBy(desc(aiKnowledgeSources.createdAt))
    .limit(50)

  const ingestionRuns = await platformDb
    .select()
    .from(aiKnowledgeIngestionRuns)
    .where(eq(aiKnowledgeIngestionRuns.orgId, orgId))
    .orderBy(desc(aiKnowledgeIngestionRuns.createdAt))
    .limit(100)

  const [profileCount] = await platformDb
    .select({ count: count() })
    .from(aiCapabilityProfiles)
    .where(eq(aiCapabilityProfiles.orgId, orgId))

  const [routeCount] = await platformDb
    .select({ count: count() })
    .from(aiDeploymentRoutes)
    .where(eq(aiDeploymentRoutes.orgId, orgId))

  return {
    sources,
    ingestionRuns,
    profileCount: profileCount?.count ?? 0,
    routeCount: routeCount?.count ?? 0,
  }
}

const INGESTION_STATUS_COLORS: Record<string, string> = {
  queued: 'bg-yellow-100 text-yellow-800',
  chunked: 'bg-blue-100 text-blue-800',
  embedded: 'bg-purple-100 text-purple-800',
  stored: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

export default async function AiKnowledgePage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')
  const orgId = await resolveConsoleEntityId(userId)
  if (!orgId) {
    return <div className="p-8 text-red-600">No active org membership or fallback entity configured</div>
  }

  const { sources, ingestionRuns, profileCount, routeCount } = await getKnowledgeData(orgId)

  const runsBySource = new Map<string, typeof ingestionRuns>()
  for (const run of ingestionRuns) {
    const existing = runsBySource.get(run.sourceId) ?? []
    existing.push(run)
    runsBySource.set(run.sourceId, existing)
  }

  const ingestionSummary = {
    totalSources: sources.length,
    activeSources: sources.filter((source) => source.status === 'active').length,
    totalRuns: ingestionRuns.length,
    successRuns: ingestionRuns.filter((run) => run.status === 'stored').length,
    failedRuns: ingestionRuns.filter((run) => run.status === 'failed').length,
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-2 pb-8 sm:px-4">
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-linear-to-br from-card via-card to-muted/40 p-6 shadow-sm">
        <div className="absolute -left-8 top-10 h-28 w-28 rounded-full bg-cyan-500/10 blur-2xl" />
        <div className="absolute -right-8 bottom-0 h-32 w-32 rounded-full bg-emerald-500/10 blur-2xl" />

        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Console / AI</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI Knowledge Sources</h1>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Manage ingestion sources, review run outcomes, and verify readiness for knowledge-grounded AI features.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/console/ai/overview" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Overview
            </Link>
            <Link href="/console/ai/models" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Models
            </Link>
            <Link href="/console/ai/actions" className="rounded-md border bg-background px-3 py-1.5 hover:bg-muted/80">
              Actions
            </Link>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Knowledge Sources" value={String(ingestionSummary.totalSources)} tone="blue" />
          <StatCard label="Ingestion Runs" value={String(ingestionSummary.totalRuns)} tone="emerald" />
          <StatCard label="Profiles Live" value={String(profileCount)} tone="amber" />
          <StatCard label="Routes Live" value={String(routeCount)} tone="violet" />
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">New Ingestion</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a low-risk action proposal to ingest text content into the knowledge index.
          </p>
          <div className="mt-4">
            <IngestButton orgId={orgId} />
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-base font-semibold">Readiness</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-3">
              <div>
                <p className="font-medium">Knowledge profile</p>
                <p className="text-muted-foreground">Requires actions_propose + ingest permission.</p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">Ready</span>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-3">
              <div>
                <p className="font-medium">Success / Failed runs</p>
                <p className="text-muted-foreground">Stored runs indicate completed ingestion pipeline.</p>
              </div>
              <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700">
                {ingestionSummary.successRuns} / {ingestionSummary.failedRuns}
              </span>
            </div>
            <div className="flex items-start justify-between gap-3 rounded-xl border bg-muted/20 px-3 py-3">
              <div>
                <p className="font-medium">Active sources</p>
                <p className="text-muted-foreground">Sources available for downstream retrieval.</p>
              </div>
              <span className="rounded-full bg-violet-100 px-2 py-1 text-xs font-medium text-violet-700">
                {ingestionSummary.activeSources}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Knowledge Sources</h2>
            <p className="text-sm text-muted-foreground">Recent sources and latest ingestion status by source.</p>
          </div>
          <div className="text-sm text-muted-foreground">{sources.length} sources</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Title</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">App</th>
                <th className="px-4 py-3 text-left font-medium">Ingestions</th>
                <th className="px-4 py-3 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => {
                const sourceRuns = runsBySource.get(source.id) ?? []
                return (
                  <tr key={source.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-medium">{source.title}</td>
                    <td className="px-4 py-3 text-xs font-mono">{source.sourceType}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${source.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {source.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">{source.appKey}</td>
                    <td className="px-4 py-3 text-xs">
                      {sourceRuns.length > 0 ? (
                        <div className="space-y-1">
                          {sourceRuns.slice(0, 2).map((run) => (
                            <div key={run.id}>
                              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${INGESTION_STATUS_COLORS[run.status] ?? 'bg-gray-100'}`}>
                                {run.status}
                              </span>
                              {(run.metricsJson != null && typeof run.metricsJson === 'object') ? (
                                <span className="ml-1 text-muted-foreground">
                                  {String((run.metricsJson as Record<string, unknown>).chunkCount ?? '?')} chunks
                                </span>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(source.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
              {sources.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No knowledge sources yet. Use the ingest panel to create your first source action.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
