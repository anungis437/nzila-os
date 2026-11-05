import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B84: small validation and verification items', () => {
  it('refuses a location consent context that is not strike or event', () => {
    const route = src('app/api/location/consent/route.ts')
    expect(route).toContain('rawContext !== "strike" && rawContext !== "event"')
    expect(route).not.toContain('searchParams.get("context") as "strike" | "event" | undefined')
  })

  it('requires a stated reason to resolve or write off a reconciliation exception', () => {
    const route = src('app/api/reconciliation/resolve/route.ts')
    expect(route).toContain('.trim().min(10')
  })

  it('verified: dues payment history lists payments only and a separate bounded attempt history', () => {
    const route = src('app/api/portal/dues/pay/route.ts')
    expect(route).toContain("eq(memberDuesLedger.transactionType, 'payment')")
    expect(route).toContain('FROM dues_transactions')
    expect(route).toContain('payments, attempts')
  })

  it('verified: workspace telemetry has its own rate limit, a streamed body bound and an allow-listed payload', () => {
    const route = src('app/api/workspace/telemetry/route.ts')
    expect(route).toContain('const TELEMETRY_RATE_LIMIT')
    expect(route).toContain('MAX_BODY_BYTES')
    expect(route).toContain('ALLOWED_PAYLOAD_KEYS')
  })
})
