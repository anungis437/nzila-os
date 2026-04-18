import type { FastifyInstance } from 'fastify'
import { nowISO } from '@nzila/platform-utils/time'
import { getExecutionMetrics } from '../execution-engine.js'

let requestCount = 0
let errorCount = 0
let totalLatencyMs = 0

export function recordRequest(latencyMs: number, isError = false) {
  requestCount += 1
  totalLatencyMs += latencyMs
  if (isError) errorCount += 1
}

export async function metricsRoutes(app: FastifyInstance) {
  app.get('/metrics', async (_req, reply) => {
    const execution = await getExecutionMetrics()

    return reply.send({
      request_count: requestCount,
      error_rate: requestCount > 0 ? Math.round((errorCount / requestCount) * 10000) / 100 : 0,
      latency_ms: requestCount > 0 ? Math.round(totalLatencyMs / requestCount) : 0,
      queue_depth: execution.queueDepth,
      p95_latency_ms: execution.p95LatencyMs,
      failure_rate: execution.failureRate,
      retries_total: execution.totalRetries,
      stuck_count: execution.stuckCount,
      service: 'orchestrator-api',
      timestamp: nowISO(),
    })
  })
}
