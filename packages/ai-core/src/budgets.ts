/**
 * @nzila/ai-core — Budget enforcement
 *
 * Checks and updates spend against ai_usage_budgets.
 * Blocks requests when budget is exceeded.
 */
import { db } from '@nzila/db'
import { aiUsageBudgets } from '@nzila/db/schema'
import { eq, and, sql } from 'drizzle-orm'
import { AiControlPlaneError } from './types'

// ── Budget check ────────────────────────────────────────────────────────────

/**
 * Check whether the given app/profile is within budget for the current month.
 * Returns the budget row (or null if no budget configured).
 * Throws AiControlPlaneError if budget is blocked.
 */
export async function checkBudget(opts: {
  entityId: string
  appKey: string
  profileKey: string
}): Promise<{
  budgetId: string | null
  remainingUsd: number | null
}> {
  const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM

  const [budget] = await db
    .select()
    .from(aiUsageBudgets)
    .where(
      and(
        eq(aiUsageBudgets.entityId, opts.entityId),
        eq(aiUsageBudgets.appKey, opts.appKey),
        eq(aiUsageBudgets.profileKey, opts.profileKey),
        eq(aiUsageBudgets.month, currentMonth),
      ),
    )
    .limit(1)

  if (!budget) {
    // No budget configured — allow
    return { budgetId: null, remainingUsd: null }
  }

  if (budget.status === 'blocked') {
    throw new AiControlPlaneError(
      'budget_exceeded',
      `AI budget exceeded for ${opts.appKey}/${opts.profileKey} in ${currentMonth}. Spent: $${budget.spentUsd} / $${budget.budgetUsd}`,
      429,
    )
  }

  const remaining = Number(budget.budgetUsd) - Number(budget.spentUsd)
  return { budgetId: budget.id, remainingUsd: remaining }
}

// ── Record spend ────────────────────────────────────────────────────────────

/**
 * Increment spend and update budget status after a request completes.
 */
export async function recordSpend(opts: {
  entityId: string
  appKey: string
  profileKey: string
  costUsd: number
}): Promise<void> {
  if (opts.costUsd <= 0) return

  const currentMonth = new Date().toISOString().slice(0, 7)

  // Upsert: increment spent, update status
  const [existing] = await db
    .select()
    .from(aiUsageBudgets)
    .where(
      and(
        eq(aiUsageBudgets.entityId, opts.entityId),
        eq(aiUsageBudgets.appKey, opts.appKey),
        eq(aiUsageBudgets.profileKey, opts.profileKey),
        eq(aiUsageBudgets.month, currentMonth),
      ),
    )
    .limit(1)

  if (!existing) return // No budget row — nothing to track

  const newSpent = Number(existing.spentUsd) + opts.costUsd
  const budgetVal = Number(existing.budgetUsd)

  let newStatus: 'ok' | 'warning' | 'blocked' = 'ok'
  if (newSpent >= budgetVal) {
    newStatus = 'blocked'
  } else if (newSpent >= budgetVal * 0.8) {
    newStatus = 'warning'
  }

  await db
    .update(aiUsageBudgets)
    .set({
      spentUsd: String(newSpent),
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(aiUsageBudgets.id, existing.id))
}

// ── Ensure budget row exists for current month ──────────────────────────────

/**
 * Ensure a budget row exists for the current month.
 * Called from admin endpoints or on-demand.
 */
export async function ensureBudgetRow(opts: {
  entityId: string
  appKey: string
  profileKey: string
  budgetUsd: number
}): Promise<string> {
  const currentMonth = new Date().toISOString().slice(0, 7)

  const [existing] = await db
    .select({ id: aiUsageBudgets.id })
    .from(aiUsageBudgets)
    .where(
      and(
        eq(aiUsageBudgets.entityId, opts.entityId),
        eq(aiUsageBudgets.appKey, opts.appKey),
        eq(aiUsageBudgets.profileKey, opts.profileKey),
        eq(aiUsageBudgets.month, currentMonth),
      ),
    )
    .limit(1)

  if (existing) return existing.id

  const [row] = await db
    .insert(aiUsageBudgets)
    .values({
      entityId: opts.entityId,
      appKey: opts.appKey,
      profileKey: opts.profileKey,
      month: currentMonth,
      budgetUsd: String(opts.budgetUsd),
    })
    .returning({ id: aiUsageBudgets.id })

  return row.id
}
