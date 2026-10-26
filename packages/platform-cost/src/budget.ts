/**
 * Nzila OS — Cost Budget Enforcement
 *
 * Denial-of-wallet controls: per-org budget policies with enforcement.
 *
 * @module @nzila/platform-cost/budget
 */
import { z } from 'zod'
import { COST_CATEGORIES, type CostCategory } from './cost-events'

// ── Budget Policy Schema ────────────────────────────────────────────────────

export const CategoryCapSchema = z.object({
  category: z.enum(COST_CATEGORIES),
  dailyLimit: z.number().nonnegative().optional(),
  monthlyLimit: z.number().nonnegative().optional(),
})

export const OrgBudgetPolicySchema = z.object({
  orgId: z.guid(),
  dailyBudgetUsd: z.number().nonnegative(),
  monthlyBudgetUsd: z.number().nonnegative(),
  categoryCaps: z.array(CategoryCapSchema).optional(),
  /** Routes exempt from budget enforcement (admin, export, proof) */
  exemptRoutes: z.array(z.string()).default([
    '/api/admin/*',
    '/api/export/*',
    '/api/proof/*',
    '/api/health',
  ]),
  /** Whether enforcement is active (vs. observe-only) */
  enforce: z.boolean().default(true),
})

export type OrgBudgetPolicy = z.infer<typeof OrgBudgetPolicySchema>

// ── Budget State ────────────────────────────────────────────────────────────

export type BudgetState = 'ok' | 'warning' | 'exceeded'

export interface BudgetCheckResult {
  orgId: string
  state: BudgetState
  dailySpendUsd: number
  dailyBudgetUsd: number
  monthlySpendUsd: number
  monthlyBudgetUsd: number
  dailyUtilization: number
  monthlyUtilization: number
  categoryBreaches: { category: CostCategory; spent: number; limit: number }[]
  lastBreachAt: Date | null
  enforced: boolean
}

// ── Budget Ports ────────────────────────────────────────────────────────────

export interface BudgetPorts {
  getOrgBudgetPolicy(orgId: string): Promise<OrgBudgetPolicy | null>
  getOrgDailySpend(orgId: string, day: string): Promise<number>
  getOrgMonthlySpend(orgId: string, month: string): Promise<number>
  getOrgCategorySpend(orgId: string, day: string): Promise<{ category: CostCategory; spent: number }[]>
  recordBudgetBreach(breach: {
    orgId: string
    state: BudgetState
    dailySpendUsd: number
    monthlySpendUsd: number
    categoryBreaches: { category: CostCategory; spent: number; limit: number }[]
    timestamp: Date
  }): Promise<void>
  emitAudit(event: {
    action: string
    orgId: string
    metadata: Record<string, unknown>
    timestamp: Date
  }): Promise<void>
}

// ── Core Functions ──────────────────────────────────────────────────────────

/**
 * Check the budget state for an org.
 * Returns whether the org has exceeded its budget and which categories are breached.
 */
export async function checkOrgBudget(
  orgId: string,
  ports: BudgetPorts,
): Promise<BudgetCheckResult> {
  const policy = await ports.getOrgBudgetPolicy(orgId)
  if (!policy) {
    return {
      orgId,
      state: 'ok',
      dailySpendUsd: 0,
      dailyBudgetUsd: Infinity,
      monthlySpendUsd: 0,
      monthlyBudgetUsd: Infinity,
      dailyUtilization: 0,
      monthlyUtilization: 0,
      categoryBreaches: [],
      lastBreachAt: null,
      enforced: false,
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const month = today.slice(0, 7)

  const [dailySpend, monthlySpend, categorySpend] = await Promise.all([
    ports.getOrgDailySpend(orgId, today),
    ports.getOrgMonthlySpend(orgId, month),
    ports.getOrgCategorySpend(orgId, today),
  ])

  const dailyUtilization = policy.dailyBudgetUsd > 0 ? dailySpend / policy.dailyBudgetUsd : 0
  const monthlyUtilization = policy.monthlyBudgetUsd > 0 ? monthlySpend / policy.monthlyBudgetUsd : 0

  const categoryBreaches: { category: CostCategory; spent: number; limit: number }[] = []
  if (policy.categoryCaps) {
    for (const cap of policy.categoryCaps) {
      const spent = categorySpend.find((c) => c.category === cap.category)?.spent ?? 0
      if (cap.dailyLimit !== undefined && spent > cap.dailyLimit) {
        categoryBreaches.push({ category: cap.category, spent, limit: cap.dailyLimit })
      }
    }
  }

  let state: BudgetState = 'ok'
  if (
    dailySpend > policy.dailyBudgetUsd ||
    monthlySpend > policy.monthlyBudgetUsd ||
    categoryBreaches.length > 0
  ) {
    state = 'exceeded'
  } else if (dailyUtilization > 0.8 || monthlyUtilization > 0.8) {
    state = 'warning'
  }

  const result: BudgetCheckResult = {
    orgId,
    state,
    dailySpendUsd: dailySpend,
    dailyBudgetUsd: policy.dailyBudgetUsd,
    monthlySpendUsd: monthlySpend,
    monthlyBudgetUsd: policy.monthlyBudgetUsd,
    dailyUtilization,
    monthlyUtilization,
    categoryBreaches,
    lastBreachAt: state === 'exceeded' ? new Date() : null,
    enforced: policy.enforce,
  }

  if (state === 'exceeded') {
    await ports.recordBudgetBreach({
      orgId,
      state,
      dailySpendUsd: dailySpend,
      monthlySpendUsd: monthlySpend,
      categoryBreaches,
      timestamp: new Date(),
    })

    await ports.emitAudit({
      action: 'cost.budget.exceeded',
      orgId,
      metadata: {
        dailySpend,
        monthlySpend,
        dailyBudget: policy.dailyBudgetUsd,
        monthlyBudget: policy.monthlyBudgetUsd,
        categoryBreaches,
      },
      timestamp: new Date(),
    })
  }

  return result
}

/**
 * Determine if a request should be blocked due to budget breach.
 * Exempt routes (admin, export, proof endpoints) are never blocked.
 */
export function shouldBlockRequest(
  budget: BudgetCheckResult,
  route: string,
  exemptRoutes: string[] = ['/api/admin/*', '/api/export/*', '/api/proof/*', '/api/health'],
): { blocked: boolean; reason: string | null; statusCode: 402 | 429 | null } {
  if (!budget.enforced) {
    return { blocked: false, reason: null, statusCode: null }
  }

  if (budget.state !== 'exceeded') {
    return { blocked: false, reason: null, statusCode: null }
  }

  // Check exemptions
  for (const pattern of exemptRoutes) {
    if (matchRoute(route, pattern)) {
      return { blocked: false, reason: null, statusCode: null }
    }
  }

  return {
    blocked: true,
    reason: `Org ${budget.orgId} has exceeded its cost budget. Daily: $${budget.dailySpendUsd.toFixed(2)}/$${budget.dailyBudgetUsd.toFixed(2)}. Monthly: $${budget.monthlySpendUsd.toFixed(2)}/$${budget.monthlyBudgetUsd.toFixed(2)}.`,
    statusCode: 402,
  }
}

/** Simple glob-style route matcher (* = any segment chars) */
function matchRoute(route: string, pattern: string): boolean {
  const re = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
  return re.test(route)
}
