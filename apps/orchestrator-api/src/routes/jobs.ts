/**
 * Job routes — track execution runs spawned from commands.
 *
 * GET /jobs            — List recent jobs
 * GET /jobs/:id        — Get a specific job by run ID
 * GET /jobs/:id/events — Get audit events for a job
 */
import type { FastifyInstance } from 'fastify'
import { listWorkflowRuns, getWorkflowRun } from '../execution-engine.js'
import { getAuditEvents } from '../audit-store.js'

export async function jobRoutes(app: FastifyInstance) {
  /**
   * GET /jobs — List recent jobs (alias for commands with run metadata).
   */
  app.get('/', async (req, reply) => {
    const runs = await listWorkflowRuns({ limit: 100 })
    const jobs = runs.map((run) => ({
      jobId: run.runId,
      correlationId: run.correlationId,
      playbook: run.workflowId,
      status: run.status,
      dryRun: run.dryRun,
      requestedBy: run.initiatedBy.actorId,
      runId: run.runId,
      runUrl: null,
      createdAt: run.startedAt,
      updatedAt: run.updatedAt,
    }))
    return { jobs, count: jobs.length }
  })

  /**
   * GET /jobs/:id — Get job details by run ID.
   */
  app.get<{ Params: { id: string } }>('/:id', async (req, reply) => {
    const run = await getWorkflowRun(req.params.id)
    if (!run) {
      return reply.status(404).send({ error: 'Job not found' })
    }
    return {
      jobId: run.runId,
      correlationId: run.correlationId,
      playbook: run.workflowId,
      status: run.status,
      dryRun: run.dryRun,
      requestedBy: run.initiatedBy.actorId,
      runId: run.runId,
      runUrl: null,
      createdAt: run.startedAt,
      updatedAt: run.updatedAt,
    }
  })

  /**
   * GET /jobs/:id/events — Get audit trail for a specific job.
   */
  app.get<{ Params: { id: string } }>('/:id/events', async (req, reply) => {
    const run = await getWorkflowRun(req.params.id)
    if (!run) {
      return reply.status(404).send({ error: 'Job not found' })
    }
    const events = await getAuditEvents(run.correlationId)
    return { correlationId: run.correlationId, events, count: events.length }
  })
}
