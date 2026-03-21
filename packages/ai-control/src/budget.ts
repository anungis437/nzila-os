import type { BudgetConfig, BudgetStatus } from './schemas.js'

// ─── Budget Store Interface ─────────────────────────────────────────────────

export interface BudgetStore {
  getConfig(orgId: string): Promise<BudgetConfig | undefined>
  getSpend(orgId: string, period: string): Promise<number>
  recordSpend(orgId: string, period: string, amountUsd: number): Promise<void>
}

// ─── Budget Enforcement ─────────────────────────────────────────────────────

export function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function checkBudget(
  store: BudgetStore,
  orgId: string,
  role?: string,
): Promise<BudgetStatus> {
  const config = await store.getConfig(orgId)

  if (!config) {
    return {
      orgId,
      period: getCurrentPeriod(),
      spentUsd: 0,
      monthlyCapUsd: 0,
      remainingUsd: 0,
      usagePercent: 0,
      status: 'blocked',
    }
  }

  const period = getCurrentPeriod()
  const spentUsd = await store.getSpend(orgId, period)

  // Use role-specific cap if available
  let effectiveCap = config.monthlyCapUsd
  if (role && config.roles?.[role]) {
    effectiveCap = Math.min(effectiveCap, config.roles[role].monthlyCapUsd)
  }

  const remainingUsd = Math.max(0, effectiveCap - spentUsd)
  const usagePercent = effectiveCap > 0 ? (spentUsd / effectiveCap) * 100 : 100

  let status: 'ok' | 'warning' | 'blocked'
  if (spentUsd >= effectiveCap) {
    status = 'blocked'
  } else if (usagePercent >= config.warningThresholdPercent) {
    status = 'warning'
  } else {
    status = 'ok'
  }

  return {
    orgId,
    period,
    spentUsd,
    monthlyCapUsd: effectiveCap,
    remainingUsd,
    usagePercent,
    status,
  }
}

export async function recordSpend(
  store: BudgetStore,
  orgId: string,
  amountUsd: number,
): Promise<void> {
  const period = getCurrentPeriod()
  await store.recordSpend(orgId, period, amountUsd)
}

// ─── In-Memory Budget Store (testing) ───────────────────────────────────────

export class InMemoryBudgetStore implements BudgetStore {
  private readonly configs = new Map<string, BudgetConfig>()
  private readonly spending = new Map<string, number>()

  setConfig(config: BudgetConfig): void {
    this.configs.set(config.orgId, config)
  }

  async getConfig(orgId: string): Promise<BudgetConfig | undefined> {
    return this.configs.get(orgId)
  }

  async getSpend(orgId: string, period: string): Promise<number> {
    return this.spending.get(`${orgId}:${period}`) ?? 0
  }

  async recordSpend(orgId: string, period: string, amountUsd: number): Promise<void> {
    const key = `${orgId}:${period}`
    const current = this.spending.get(key) ?? 0
    this.spending.set(key, current + amountUsd)
  }
}
