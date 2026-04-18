import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/rbac'
import { platformDb } from '@nzila/db/platform'
import { automationCommands, automationEvents } from '@nzila/db/schema'
import { and, asc, eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

function isDeadLettered(args: unknown): boolean {
  if (!args || typeof args !== 'object') return false
  const result = (args as Record<string, unknown>).result
  if (!result || typeof result !== 'object') return false
  return Boolean((result as Record<string, unknown>).deadLettered)
}

function statusLabel(status: string, args: unknown): string {
  if (status === 'failed' && isDeadLettered(args)) return 'dead_lettered'
  return status
}

async function loadRun(runId: string) {
  const [run] = await platformDb
    .select()
    .from(automationCommands)
    .where(eq(automationCommands.id, runId))
    .limit(1)

  if (!run) return null

  const events = await platformDb
    .select()
    .from(automationEvents)
    .where(and(eq(automationEvents.commandId, run.id), eq(automationEvents.orgId, run.orgId)))
    .orderBy(asc(automationEvents.createdAt))

  return { run, events }
}

export default async function OrchestratorRunTimelinePage({
  params,
}: {
  params: Promise<{ runId: string }>
}) {
  await requireRole('platform_admin', 'studio_admin')
  const { runId } = await params

  const data = await loadRun(runId)
  if (!data) notFound()

  const { run, events } = data
  const deadLettered = isDeadLettered(run.args)

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Execution Timeline</h1>
          <p className="mt-1 text-sm text-gray-500">Run {run.id} · {run.playbook}</p>
        </div>
        <Link
          href="/operator/orchestrator"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Back to Operator
        </Link>
      </div>

      <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Org" value={run.orgId} mono />
        <Field label="Status" value={statusLabel(run.status, run.args)} />
        <Field label="Version" value={String(run.version)} />
        <Field label="Retries" value={String(run.attemptCount)} />
        <Field label="Idempotency Key" value={run.idempotencyKey} mono />
        <Field label="Correlation" value={run.correlationId} mono />
        <Field label="Execution Owner" value={run.executionOwner ?? '—'} mono />
        <Field label="Lease Expires" value={run.leaseExpiresAt ? run.leaseExpiresAt.toLocaleString() : '—'} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Timeline</h2>
          <p className="mt-1 text-sm text-gray-500">Append-only execution events in occurrence order.</p>
        </div>

        <ol className="divide-y divide-gray-100">
          {events.map((event) => (
            <li key={event.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[220px_220px_1fr]">
              <p className="font-mono text-xs text-gray-500">{event.createdAt.toLocaleString()}</p>
              <p className="text-sm font-semibold text-gray-800">{event.event}</p>
              <div className="space-y-1">
                <p className="text-xs text-gray-500">actor: <span className="font-mono">{event.actor}</span></p>
                <pre className="overflow-x-auto rounded-md bg-gray-50 p-3 text-xs text-gray-700">
                  {JSON.stringify(event.payload ?? {}, null, 2)}
                </pre>
              </div>
            </li>
          ))}
          {events.length === 0 ? (
            <li className="px-5 py-8 text-sm text-gray-500">No events recorded for this run.</li>
          ) : null}
        </ol>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">Controls</h2>
        <p className="mt-1 text-sm text-gray-500">Retry failed runs or cancel active runs with optimistic concurrency checks.</p>

        <div className="mt-4 flex flex-wrap gap-3">
          <form action={`/api/operator/orchestrator/runs/${run.id}/retry`} method="POST" className="flex items-center gap-2">
            <input type="hidden" name="orgId" value={run.orgId} />
            <input type="hidden" name="expectedVersion" value={String(run.version)} />
            <button
              type="submit"
              disabled={!(run.status === 'failed' || deadLettered)}
              className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Retry Run
            </button>
          </form>

          <form action={`/api/operator/orchestrator/runs/${run.id}/cancel`} method="POST" className="flex items-center gap-2">
            <input type="hidden" name="orgId" value={run.orgId} />
            <input type="hidden" name="expectedVersion" value={String(run.version)} />
            <button
              type="submit"
              disabled={!(run.status === 'running' || run.status === 'pending' || run.status === 'dispatched')}
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              Cancel Run
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1 text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  )
}
