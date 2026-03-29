import type { FastifyInstance } from 'fastify'
import { nowISO } from '@nzila/platform-utils/time'

let requestCount = 0
let errorCount = 0
let totalLatencyMs = 0

export function recordRequest(latencyMs: number, isError = false) {
  requestCount++
  totalLatencyMs += latencyMs
  if (isError) errorCount++
}

export async function metricsRoutes(app: FastifyInstance) {
  app.get('/metrics', async (_req, reply) => {
    return reply.send({
      request_count: requestCount,
      error_rate: requestCount > 0 ? Math.round((errorCount / requestCount) * 10000) / 100 : 0,
      latency_ms: requestCount > 0 ? Math.round(totalLatencyMs / requestCount) : 0,
      service: 'orchestrator-api',
      timestamp: nowISO(),
    })
  })
}
