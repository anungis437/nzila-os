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

// ── CO₂ estimation (NZ-RISK-027) ────────────────────────────────────────────

/**
 * Carbon intensity constants (grams CO₂ per 1 000 tokens).
 *
 * Values are conservative approximations derived from published model-card
 * estimates and third-party carbon-footprint analyses:
 *  - GPT-4o:         ~0.002 kg CO₂ / 1 000 tokens  → 2 g/1 000 tokens
 *  - GPT-3.5-turbo:  ~0.001 kg CO₂ / 1 000 tokens  → 1 g/1 000 tokens
 *  - claude-sonnet:  ~0.0015 kg CO₂ / 1 000 tokens → 1.5 g/1 000 tokens
 *  - Embeddings:     ~0.0002 kg CO₂ / 1 000 tokens → 0.2 g/1 000 tokens
 *
 * Sources: Lottick et al. (2019), Patterson et al. (2021), Anthropic model card.
 * NZ-RISK-027: co2EstimateGrams column added to ai_usage_budgets schema;
 * recordSpend() now accumulates per-request CO₂ alongside monetary spend.
 */
const CO2_GRAMS_PER_1K_TOKENS: Record<string, number> = {
  'gpt-4o':             2.0,
  'gpt-4':              3.5,
  'gpt-3.5-turbo':      1.0,
  'claude-sonnet-4-6':  1.5,
  'claude-3-5-sonnet':  1.5,
  'claude-3-opus':      3.0,
  'text-embedding-3-small': 0.2,
  'text-embedding-ada-002': 0.2,
  default:              2.0, // conservative fallback
}

/**
 * Estimate CO₂ emissions for an AI request in grams.
 *
 * @param totalTokens  Combined input + output token count.
 * @param model        Model name as returned by the provider.
 * @returns Estimated CO₂ in grams (floating-point, rounded to 4 d.p.).
 */
export function estimateCo2Grams(totalTokens: number, model: string): number {
  const normalisedModel = model.toLowerCase().split('/').pop() ?? ''
  const rate =
    CO2_GRAMS_PER_1K_TOKENS[normalisedModel] ??
    Object.entries(CO2_GRAMS_PER_1K_TOKENS).find(([k]) => normalisedModel.includes(k))?.[1] ??
    CO2_GRAMS_PER_1K_TOKENS['default']
  return Number(((totalTokens / 1000) * rate).toFixed(4))
}


// ── Budget check ────────────────────────────────────────────────────────────

/**
 * Check whether the given app/profile is within budget for the current month.
 * Returns the budget row (or null if no budget configured).
 * Throws AiControlPlaneError if budget is blocked.
 */
export async function checkBudget(opts: {
  orgId: string
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
        eq(aiUsageBudgets.orgId, opts.orgId),
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
  orgId: string
  appKey: string
  profileKey: string
  costUsd: number
  co2Grams?: number
}): Promise<void> {
  if (opts.costUsd <= 0) return

  const currentMonth = new Date().toISOString().slice(0, 7)

  // Upsert: increment spent, update status
  const [existing] = await db
    .select()
    .from(aiUsageBudgets)
    .where(
      and(
        eq(aiUsageBudgets.orgId, opts.orgId),
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
      // NZ-RISK-027: Accumulate CO₂ estimate alongside monetary spend
      co2EstimateGrams: String(
        Number(existing.co2EstimateGrams ?? '0') + (opts.co2Grams ?? 0),
      ),
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
  orgId: string
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
        eq(aiUsageBudgets.orgId, opts.orgId),
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
      orgId: opts.orgId,
      appKey: opts.appKey,
      profileKey: opts.profileKey,
      month: currentMonth,
      budgetUsd: String(opts.budgetUsd),
    })
    .returning({ id: aiUsageBudgets.id })

  return row.id
}
