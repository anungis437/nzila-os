import { z } from 'zod'
import { sql } from 'drizzle-orm'

/**
 * Pension plan figures. totalAssets and fundingStatus are recorded by an administrator (nothing derives them from contributions or a
 * valuation), so they are validated as the numbers the numeric columns hold and the plan is never presented as having measured them.
 * activeMembers is not typed in: it is counted from the plan's enrolments when the plan is read.
 */
export const PLAN_TYPES = ['defined_benefit', 'defined_contribution', 'hybrid', 'target_benefit'] as const
export const PLAN_STATUSES = ['active', 'frozen', 'terminated', 'pending_approval'] as const

export const planFigureFields = {
  // numeric(15,2) and numeric(5,2): a value the column cannot hold is a 400, not a database error.
  totalAssets: z.string().regex(/^\d{1,13}(\.\d{1,2})?$/, 'totalAssets must be a non-negative amount with at most two decimals').optional(),
  fundingStatus: z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, 'fundingStatus must be a percentage with at most two decimals').optional(),
}

/** Enrolled, currently active members of a plan: the figure shown as activeMembers. */
export const activeEnrolmentCount = (planIdColumn: unknown) =>
  sql<number>`(SELECT count(*)::int FROM pension_members pm WHERE pm.plan_id = ${planIdColumn} AND pm.membership_status = 'active')`

export const memberSafePlan = <T extends { id: string; planName: string; planType: string; status: string; description: string | null }>(plan: T) => ({
  id: plan.id,
  planName: plan.planName,
  planType: plan.planType,
  status: plan.status,
  description: plan.description,
})

