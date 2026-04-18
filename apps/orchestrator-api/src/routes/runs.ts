/**
 * Run routes — execution tracking for workflow runs.
 *
 * A "run" is a concrete execution of a workflow (command).
 * This provides the /runs view that maps commands → execution metadata.
 *
 * GET /runs          — List recent runs with execution metadata
 * GET /runs/:id      — Get a specific run by run ID
 * GET /runs/:id/log  — Get execution log for a run
 */
import type { FastifyInstance } from 'fastify'
import { listWorkflowRuns, getWorkflowRun } from '../execution-engine.js'
import { getAuditEvents } from '../audit-store.js'

export interface RunSummary {
  runId: string | null
  correlationId: string
  playbook: string
  status: string
  dryRun: boolean
  requestedBy: string
  startedAt: string
  updatedAt: string
  runUrl: string | null
  durationEstimate: string | null
}

export async function runRoutes(app: FastifyInstance) {
  /**
   * GET /runs — List recent runs with execution metadata.
   */
  app.get('/', async () => {
    const workflowRuns = await listWorkflowRuns({ limit: 100 })
    const runs: RunSummary[] = workflowRuns.map((run) => ({
      runId: run.runId,
      correlationId: run.correlationId,
      playbook: run.workflowId,
      status: run.status,
      dryRun: run.dryRun,
      requestedBy: run.initiatedBy.actorId,
      startedAt: run.startedAt,
      updatedAt: run.updatedAt,
      runUrl: null,
      durationEstimate: estimateDuration(run.startedAt, run.updatedAt, run.status),
    }))
    return { runs, count: runs.length }
  })

  /**
   * GET /runs/:id — Get run details by run ID.
   */
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const run = await getWorkflowRun(req.params.id)
    if (!run) {
      return reply.status(404).send({ error: 'Run not found' })
    }
    const events = await getAuditEvents(run.correlationId)
    return {
      runId: run.runId,
      correlationId: run.correlationId,
      playbook: run.workflowId,
      status: run.status,
      dryRun: run.dryRun,
      requestedBy: run.initiatedBy.actorId,
      startedAt: run.startedAt,
      updatedAt: run.updatedAt,
      runUrl: null,
      eventCount: events.length,
      lastEvent: events.length > 0 ? events[events.length - 1] : null,
    }
  })

  /**
   * GET /runs/:id/log — Get execution log entries for a run.
   */
  app.get<{ Params: { id: string } }>('/:id/log', async (req, reply) => {
    const run = await getWorkflowRun(req.params.id)
    if (!run) {
      return reply.status(404).send({ error: 'Run not found' })
    }
    const events = await getAuditEvents(run.correlationId)
    const log = events.map((e) => ({
      timestamp: e.createdAt,
      event: e.event,
      actor: e.actor,
      payload: e.payload,
    }))
    return { correlationId: run.correlationId, log, count: log.length }
  })
}

function estimateDuration(startedAt: string, updatedAt: string, status: string): string | null {
  if (status === 'pending' || status === 'queued') return null
  const start = new Date(startedAt).getTime()
  const end = new Date(updatedAt).getTime()
  const diffMs = end - start
  if (diffMs < 1000) return '<1s'
  if (diffMs < 60_000) return `${Math.round(diffMs / 1000)}s`
  return `${Math.round(diffMs / 60_000)}m`
}
