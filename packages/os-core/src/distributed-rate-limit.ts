export type DistributedRateLimitResult = { allowed: boolean; retryAfterSeconds?: number }

/**
 * Shared, fail-closed Upstash Redis fixed-window limiter. The script executes
 * increment + first-write expiry atomically, so independent application
 * instances share exactly the same quota state.
 */
export async function checkDistributedRateLimit(input: {
  url: string
  token: string
  key: string
  limit: number
  windowSeconds: number
}): Promise<DistributedRateLimitResult> {
  try {
    const script = "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; local ttl=redis.call('TTL',KEYS[1]); return {n,ttl}"
    const response = await fetch(input.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${input.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['EVAL', script, 1, input.key, String(input.windowSeconds)]),
      cache: 'no-store',
    })
    if (!response.ok) return { allowed: false }
    const payload = await response.json() as { result?: [number, number] }
    const result = payload.result
    if (!result || !Number.isInteger(result[0]) || !Number.isInteger(result[1])) return { allowed: false }
    return result[0] <= input.limit
      ? { allowed: true }
      : { allowed: false, retryAfterSeconds: Math.max(1, result[1]) }
  } catch {
    return { allowed: false }
  }
}
