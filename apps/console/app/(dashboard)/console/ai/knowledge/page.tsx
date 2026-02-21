/**
 * /console/ai/knowledge — AI Knowledge Sources Dashboard
 *
 * Lists knowledge sources, shows ingestion runs, and provides ingest button.
 */
import { platformDb } from '@nzila/db/platform'
import {
  aiKnowledgeSources,
  aiKnowledgeIngestionRuns,
} from '@nzila/db/schema'
import { eq, desc } from 'drizzle-orm'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { IngestButton } from './ingest-button'

export const dynamic = 'force-dynamic'

const DEFAULT_ENTITY_ID = process.env.NZILA_DEFAULT_ENTITY_ID ?? ''

async function getKnowledgeData(entityId: string) {
  const sources = await platformDb
    .select()
    .from(aiKnowledgeSources)
    .where(eq(aiKnowledgeSources.entityId, entityId))
    .orderBy(desc(aiKnowledgeSources.createdAt))
    .limit(50)

  const ingestionRuns = await platformDb
    .select()
    .from(aiKnowledgeIngestionRuns)
    .where(eq(aiKnowledgeIngestionRuns.entityId, entityId))
    .orderBy(desc(aiKnowledgeIngestionRuns.createdAt))
    .limit(100)

  return { sources, ingestionRuns }
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
  if (!DEFAULT_ENTITY_ID) {
    return <div className="p-8 text-red-600">NZILA_DEFAULT_ENTITY_ID not configured</div>
  }

  const { sources, ingestionRuns } = await getKnowledgeData(DEFAULT_ENTITY_ID)

  const runsBySource = new Map<string, typeof ingestionRuns>()
  for (const run of ingestionRuns) {
    const existing = runsBySource.get(run.sourceId) ?? []
    existing.push(run)
    runsBySource.set(run.sourceId, existing)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">AI Knowledge Sources</h1>
        <IngestButton entityId={DEFAULT_ENTITY_ID} />
      </div>

      <div className="rounded-lg border">
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
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No knowledge sources yet. Click &ldquo;Ingest Source&rdquo; to add one.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
