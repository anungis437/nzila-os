import 'server-only'
import { checkDistributedRateLimit } from '@nzila/os-core'
import type { SageDeliveryRateLimiter } from '@nzila/sage-core'

const CLAIM_WINDOW_SECONDS = 24 * 60 * 60
const CLAIM_LIMIT = 10

class UpstashSageDeliveryClaims implements SageDeliveryRateLimiter {
  constructor(private readonly url: string, private readonly token: string) {}

  check(key: string): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
    return checkDistributedRateLimit({
      url: this.url,
      token: this.token,
      key: `sage:delivery:claim:${key}`,
      limit: CLAIM_LIMIT,
      windowSeconds: CLAIM_WINDOW_SECONDS,
    })
  }
}

export function getConfiguredSageDeliveryRateLimiter(): SageDeliveryRateLimiter {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    throw new Error('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required for SAGE recipient claims')
  }
  return new UpstashSageDeliveryClaims(url, token)
}