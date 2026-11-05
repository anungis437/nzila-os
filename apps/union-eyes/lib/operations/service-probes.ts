/**
 * Probes of the services a deployment depends on, shared by the health route (/api/health), the readiness route (/api/ready) and the public status page
 * (lib/monitoring/status-page.ts), so the three answer from one measurement and none of them reports a service it has not measured.
 *
 * A probe that cannot run because the service is not configured says so ('degraded', with the reason). It never calls the service healthy.
 */
import type { HealthCheckState } from '@nzila/os-core/health'

export interface ProbeResult {
  state: HealthCheckState
  ms?: number
  note?: string
}

const PROBE_TIMEOUT_MS = 3000

const elapsed = (start: number): number => Date.now() - start

async function within<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('the probe timed out')), ms) })])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * The shared store of the rate limiter: the one lib/rate-limiter.ts uses (Upstash over REST when both its URL and token are set, otherwise REDIS_URL).
 * Rate limiting is a security control, so a missing or unreachable store is degraded, not healthy: explicit per-route limits reject requests, and only the
 * catch-all organization limit fails open.
 */
export async function probeCache(): Promise<ProbeResult> {
  const upstashUrl = (process.env.UPSTASH_REDIS_REST_URL ?? '').replace(/\/$/, '')
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN ?? ''
  const redisUrl = process.env.REDIS_URL ?? ''
  if (!(upstashUrl && upstashToken) && !redisUrl) {
    return { state: 'degraded', note: 'Redis not configured: rate limiting is degraded (explicit per-route limits reject requests; the catch-all organization limit fails open)' }
  }

  const start = Date.now()
  try {
    if (upstashUrl && upstashToken) {
      const response = await fetch(`${upstashUrl}/ping`, {
        headers: { Authorization: ['Bearer', upstashToken].join(' ') },
        cache: 'no-store',
        signal: AbortSignal.timeout(2000),
      })
      return response.ok ? { state: 'ok', ms: elapsed(start) } : { state: 'degraded', note: `ping returned ${response.status}`, ms: elapsed(start) }
    }
    const { default: IORedis } = await import('ioredis')
    const client = new IORedis(redisUrl, { lazyConnect: true, connectTimeout: 1500, maxRetriesPerRequest: 0, retryStrategy: () => null, enableOfflineQueue: false })
    client.on('error', () => undefined)
    try {
      await client.connect()
      await client.ping()
      return { state: 'ok', ms: elapsed(start) }
    } finally {
      client.disconnect()
    }
  } catch (error) {
    return { state: 'degraded', ms: elapsed(start), note: `Redis unreachable: rate limiting is degraded (${error instanceof Error ? error.message || 'connection failed' : 'connection failed'})` }
  }
}

/**
 * Background jobs run in the Django backend (Celery), so the job queue is as ready as the backend says it is. Not configured is degraded; a backend that
 * answers with an error or does not answer is a failure.
 */
export async function probeQueue(): Promise<ProbeResult> {
  const djangoUrl = process.env.DJANGO_API_URL || process.env.NEXT_PUBLIC_DJANGO_API_URL || ''
  if (!djangoUrl) return { state: 'degraded', note: 'The background-job backend (Django) is not configured' }

  const start = Date.now()
  try {
    const response = await fetch(`${djangoUrl.replace(/\/$/, '')}/api/auth_core/ready/`, { cache: 'no-store', signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    return response.ok ? { state: 'ok', ms: elapsed(start) } : { state: 'fail', ms: elapsed(start), note: 'The background-job backend is not ready' }
  } catch {
    return { state: 'fail', ms: elapsed(start), note: 'The background-job backend is unreachable' }
  }
}

/** Document storage: the Azure Blob container member documents are written to (the same default the document services use). */
export async function probeStorage(): Promise<ProbeResult> {
  const start = Date.now()
  try {
    const { container } = await import('@nzila/blob')
    const exists = await within(container(process.env.AZURE_BLOB_CONTAINER ?? 'union-eyes').exists(), PROBE_TIMEOUT_MS)
    return exists ? { state: 'ok', ms: elapsed(start) } : { state: 'fail', ms: elapsed(start), note: 'The document container does not exist' }
  } catch {
    return { state: 'fail', ms: elapsed(start), note: 'Document storage is not reachable or not configured' }
  }
}
