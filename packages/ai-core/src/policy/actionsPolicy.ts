/**
 * @nzila/ai-core — Action Policy Check (deterministic, no LLM)
 *
 * Evaluates whether a proposed action is allowed given the entity's
 * capability profile, budgets, and risk tier. Returns a structured
 * policy decision and optionally auto-approves low-risk actions.
 */
import { db } from '@nzila/db'
import { aiCapabilityProfiles, aiUsageBudgets } from '@nzila/db/schema'
import { eq, and } from 'drizzle-orm'
import { appendAiAuditEvent } from '../logging'
import { ACTION_TYPES } from '../schemas'
import type { ActionType } from '../schemas'

// ── Types ───────────────────────────────────────────────────────────────────

export interface PolicyCheckInput {
  actionType: string
  entityId: string
  appKey: string
  profileKey: string
  proposalJson: Record<string, unknown>
  actor: string
}

export interface PolicyDecision {
  allowed: boolean
  reasons: string[]
  riskTier: 'low' | 'medium' | 'high'
  approvalsRequired: string[] | null
  autoApproved: boolean
}

// ── Risk tier mapping ───────────────────────────────────────────────────────

const ACTION_RISK_TIERS: Record<string, 'low' | 'medium' | 'high'> = {
  [ACTION_TYPES.FINANCE_STRIPE_MONTHLY_REPORTS]: 'low',
  [ACTION_TYPES.AI_INGEST_KNOWLEDGE_SOURCE]: 'low',
}

// ── Policy check ────────────────────────────────────────────────────────────

/**
 * Deterministic policy check for an action proposal.
 * No LLM involved — purely rule-based evaluation.
 */
export async function checkActionPolicy(
  input: PolicyCheckInput,
): Promise<PolicyDecision> {
  const reasons: string[] = []
  let allowed = true

  const environment = (process.env.NODE_ENV === 'production' ? 'prod' : 'dev') as 'dev' | 'staging' | 'prod'

  // 1. Resolve capability profile
  const [profile] = await db
    .select()
    .from(aiCapabilityProfiles)
    .where(
      and(
        eq(aiCapabilityProfiles.entityId, input.entityId),
        eq(aiCapabilityProfiles.appKey, input.appKey),
        eq(aiCapabilityProfiles.environment, environment),
        eq(aiCapabilityProfiles.profileKey, input.profileKey),
      ),
    )
    .limit(1)

  if (!profile) {
    return {
      allowed: false,
      reasons: [`Capability profile not found: ${input.appKey}/${input.profileKey}`],
      riskTier: 'high',
      approvalsRequired: null,
      autoApproved: false,
    }
  }

  if (!profile.enabled) {
    return {
      allowed: false,
      reasons: [`Capability profile is disabled: ${input.profileKey}`],
      riskTier: 'high',
      approvalsRequired: null,
      autoApproved: false,
    }
  }

  // 2. Check feature "actions_propose" is enabled
  const features = (profile.features ?? []) as string[]
  if (!features.includes('actions_propose')) {
    allowed = false
    reasons.push('Feature "actions_propose" is not enabled for this profile')
  }

  // 3. Check actionType is allowed by profile
  const toolPermissions = (profile.toolPermissions ?? []) as string[]
  // Allow action if toolPermissions is empty (permissive default) or includes the actionType
  if (toolPermissions.length > 0 && !toolPermissions.includes(input.actionType)) {
    allowed = false
    reasons.push(`Action type "${input.actionType}" is not in profile toolPermissions`)
  }

  // 4. Check data class for ingestion actions
  if (input.actionType === ACTION_TYPES.AI_INGEST_KNOWLEDGE_SOURCE) {
    const proposalRetention = (input.proposalJson as Record<string, unknown>).retention as
      | { dataClass?: string }
      | undefined
    const dataClass = proposalRetention?.dataClass
    if (dataClass) {
      const allowedClasses = (profile.dataClassesAllowed ?? []) as string[]
      if (!allowedClasses.includes(dataClass)) {
        allowed = false
        reasons.push(`Data class "${dataClass}" is not allowed for this profile`)
      }
    }
  }

  // 5. Check budget status
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [budget] = await db
    .select()
    .from(aiUsageBudgets)
    .where(
      and(
        eq(aiUsageBudgets.entityId, input.entityId),
        eq(aiUsageBudgets.appKey, input.appKey),
        eq(aiUsageBudgets.profileKey, input.profileKey),
        eq(aiUsageBudgets.month, currentMonth),
      ),
    )
    .limit(1)

  if (budget && budget.status === 'blocked') {
    allowed = false
    reasons.push(`AI budget is blocked for ${input.appKey}/${input.profileKey} in ${currentMonth}`)
  }

  // 6. Determine risk tier
  const riskTier = ACTION_RISK_TIERS[input.actionType] ?? 'medium'

  // 7. Determine approval requirements
  const profileBudgets = (profile.budgets ?? {}) as Record<string, unknown>
  const autoApproveLowRisk = (profileBudgets as Record<string, unknown>).autoApproveLowRiskActions !== false

  let approvalsRequired: string[] | null = null
  let autoApproved = false

  if (allowed) {
    if (riskTier === 'low' && autoApproveLowRisk) {
      autoApproved = true
      reasons.push('Low risk action — auto-approved by policy')
    } else if (riskTier === 'low' && !autoApproveLowRisk) {
      approvalsRequired = ['entity_admin']
      reasons.push('Low risk action — requires entity_admin approval (auto-approve disabled)')
    } else if (riskTier === 'medium') {
      approvalsRequired = ['entity_admin']
      reasons.push('Medium risk action — requires entity_admin approval')
    } else {
      approvalsRequired = ['entity_admin', 'platform_admin']
      reasons.push('High risk action — requires entity_admin + platform_admin approval')
    }
  }

  if (allowed) {
    reasons.push('All policy checks passed')
  }

  const decision: PolicyDecision = {
    allowed,
    reasons,
    riskTier,
    approvalsRequired,
    autoApproved,
  }

  // Write audit event
  await appendAiAuditEvent({
    entityId: input.entityId,
    actorClerkUserId: input.actor,
    action: 'ai.action_policy_checked',
    targetType: 'ai_action',
    afterJson: {
      actionType: input.actionType,
      allowed,
      riskTier,
      autoApproved,
      reasons,
    },
  })

  return decision
}
