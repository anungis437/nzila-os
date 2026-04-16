/**
 * Orchestrator API guard helpers.
 *
 * Centralizes API-key and idempotency enforcement for route and hook usage.
 */
import { timingSafeEqual } from 'node:crypto'
import type { FastifyReply, FastifyRequest } from 'fastify'

export function isPublicOrchestratorRoute(url: string): boolean {
  return url === '/health' || url === '/metrics'
}

function matchesApiKey(provided: string | undefined, expected: string): boolean {
  if (!provided) return false

  const providedBuf = Buffer.from(provided)
  const expectedBuf = Buffer.from(expected)
  if (providedBuf.length !== expectedBuf.length) return false

  return timingSafeEqual(providedBuf, expectedBuf)
}

export function requireApiKey(
  req: FastifyRequest,
  reply: FastifyReply,
  apiKey: string,
  nodeEnv = process.env.NODE_ENV ?? 'development',
): boolean {
  if (isPublicOrchestratorRoute(req.url)) return true

  if (!apiKey) {
    if (nodeEnv === 'production') {
      void reply.status(500).send({ error: 'Server misconfigured' })
      return false
    }
    return true
  }

  const provided =
    req.headers.authorization?.replace(/^Bearer\s+/i, '') ??
    (req.headers['x-api-key'] as string | undefined)

  if (!matchesApiKey(provided, apiKey)) {
    void reply.status(401).send({ error: 'Unauthorized — invalid or missing API key' })
    return false
  }

  return true
}

export function requireIdempotencyKey(
  req: FastifyRequest,
  reply: FastifyReply,
  nodeEnv = process.env.NODE_ENV ?? 'development',
): boolean {
  if (req.url === '/health') return true

  const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
  if (!mutationMethods.has(req.method)) return true

  const idempotencyKey = req.headers['idempotency-key'] as string | undefined
  if (idempotencyKey || nodeEnv !== 'production') return true

  void reply.status(400).send({
    error: 'Missing Idempotency-Key header',
    message: 'All mutation requests (POST, PUT, PATCH, DELETE) must include an Idempotency-Key header.',
    code: 'IDEMPOTENCY_KEY_REQUIRED',
  })
  return false
}
