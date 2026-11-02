import { describe, expect, it } from 'vitest'
import { CostEventSchema, OrgBudgetPolicySchema } from './index'

const orgId = '11111111-1111-4111-8111-111111111111'

describe('Zod 4 cost boundary', () => {
  it('accepts scoped events and coerces a valid timestamp', () => {
    const event = CostEventSchema.parse({ orgId, appId: 'app', category: 'ai_token', units: 3, estCostUsd: 0.25, ts: '2026-11-02T10:00:00.000Z', metadata: { model: 'test', tokens: 3 } })
    expect(event.ts).toBeInstanceOf(Date)
    expect(event.metadata).toEqual({ model: 'test', tokens: 3 })
  })
  it('rejects malformed tenant identifiers and negative costs', () => {
    const base = { orgId, appId: 'app', category: 'ai_token', units: 3, estCostUsd: 0.25, ts: new Date() }
    expect(CostEventSchema.safeParse({ ...base, orgId: 'other-tenant' }).success).toBe(false)
    expect(CostEventSchema.safeParse({ ...base, estCostUsd: -1 }).success).toBe(false)
  })
  it('retains budget enforcement defaults', () => {
    const budget = OrgBudgetPolicySchema.parse({ orgId, dailyBudgetUsd: 5, monthlyBudgetUsd: 100 })
    expect(budget.enforce).toBe(true)
    expect(budget.exemptRoutes).toBeDefined()
  })
})
