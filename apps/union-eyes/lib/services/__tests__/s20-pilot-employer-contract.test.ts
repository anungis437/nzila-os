import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createContractSchema } from '@/lib/contracts/contract-input'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

const base = {
  billingAccountId: '11111111-1111-4111-8111-111111111111',
  name: 'Platform agreement',
  effectiveDate: '2026-01-01',
  expirationDate: '2027-01-01',
}

describe('Gate 0 batch B76: pilot telemetry, employer reads, contract input', () => {
  it('runs every pilot telemetry read inside the caller organization context', () => {
    for (const name of ['champions', 'friction', 'metrics', 'readiness']) {
      const route = src(`app/api/pilot/${name}/route.ts`)
      expect(route).toContain('withRLSContext({ organizationId: orgId }')
    }
  })

  it('records only usage signals from a browser and verifies the case of a case-bound event', () => {
    const route = src('app/api/pilot/events/route.ts')
    expect(route).toContain('CLIENT_REPORTED_EVENT_TYPES')
    expect(route).toContain('CASE_BOUND_EVENT_TYPES')
    expect(route).toContain('eq(claims.organizationId, organizationId)')
    expect(route).not.toContain('VALID_EVENT_TYPES')
    expect(route).toContain('sessionId.length > 100')
  })

  it('verified: dispatch assignment refuses a closed request, a repeat offer and an overfill, and derives filled from live assignments', () => {
    const engine = src('lib/services/dispatch-engine.ts')
    expect(engine).toContain('"not_open"')
    expect(engine).toContain('"already_assigned"')
    expect(engine).toContain('"over_capacity"')
    expect(engine).toContain('live.length + members.length >= request.requestedWorkers')
  })

  describe('contract input', () => {
    it('accepts a well-formed contract', () => {
      expect(createContractSchema.safeParse({
        ...base,
        totalContractValue: '300.00',
        lineItems: [
          { lineType: 'seat_allocation', featureKey: 'seats', description: 'Seats', quantity: 2, unitPrice: '100.00', totalPrice: '200.00', effectiveDate: '2026-01-01' },
          { lineType: 'support_level', featureKey: 'support', description: 'Support', totalPrice: '100', effectiveDate: '2026-01-01' },
        ],
      }).success).toBe(true)
    })

    it.each([
      ['an expiry before the effective date', { expirationDate: '2025-12-31' }],
      ['free-text money', { totalContractValue: 'about a lot' }],
      ['a negative total', { totalContractValue: '-5' }],
      ['a total that disagrees with its priced lines', {
        totalContractValue: '999.00',
        lineItems: [{ lineType: 'custom', featureKey: 'a', description: 'A', totalPrice: '100.00', effectiveDate: '2026-01-01' }],
      }],
      ['a line total that is not unit price times quantity', {
        lineItems: [{ lineType: 'seat_allocation', featureKey: 'a', description: 'A', quantity: 3, unitPrice: '10.00', totalPrice: '31.00', effectiveDate: '2026-01-01' }],
      }],
      ['more than 100 lines', {
        lineItems: Array.from({ length: 101 }, () => ({ lineType: 'custom', featureKey: 'a', description: 'A', effectiveDate: '2026-01-01' })),
      }],
    ])('refuses %s', (_label, patch) => {
      expect(createContractSchema.safeParse({ ...base, ...patch }).success).toBe(false)
    })
  })
})
