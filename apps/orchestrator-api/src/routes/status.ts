/**
 * Status routes — platform-level status endpoint.
 *
 * GET /status — Returns orchestrator operational status including
 *               uptime, registered workflows, recent run stats.
 */
import type { FastifyInstance } from 'fastify'
import { listWorkflowRuns } from '../execution-engine.js'

const START_TIME = Date.now()

export async function statusRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    const runs = await listWorkflowRuns({ limit: 1000 })
    const total = runs.length
    const succeeded = runs.filter((r) => r.status === 'succeeded').length
    const failed = runs.filter((r) => r.status === 'failed').length
    const pending = runs.filter((r) => r.status === 'pending' || r.status === 'queued').length
    const running = runs.filter((r) => r.status === 'running').length
    const deadLettered = runs.filter((r) => r.status === 'dead_lettered').length
    const cancelled = runs.filter((r) => r.status === 'cancelled').length

    return {
      status: 'operational',
      uptimeMs: Date.now() - START_TIME,
      version: process.env.npm_package_version ?? 'dev',
      runs: { total, succeeded, failed, pending, running, deadLettered, cancelled },
    }
  })
}
