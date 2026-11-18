import { platformDb } from '@nzila/db/platform'
import { aiActions } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import type { z } from 'zod'
import { recordAiReviewDecision } from '@nzila/ai-sdk'
import {
  validateActionProposal,
  appendAiAuditEvent,
  checkActionPolicy,
  executeAction,
  ACTION_TYPES,
  AiIngestKnowledgeSourceProposalSchema,
  FinanceStripeMonthlyReportsProposalSchema,
} from '@nzila/ai-core'

export interface AiActionProposalInput {
  orgId: string
  appKey: string
  profileKey: string
  actionType: string
  proposalJson: Record<string, unknown>
  relatedDomainType?: string
  relatedDomainId?: string
  evidencePackEligible?: boolean
}

export async function proposeAiAction(input: AiActionProposalInput, actorId: string) {
  const {
    orgId,
    appKey,
    profileKey,
    actionType,
    proposalJson,
    relatedDomainType,
    relatedDomainId,
    evidencePackEligible,
  } = input
  // 1. Validate proposal against action type schema
  const validation = validateActionProposal(actionType, proposalJson)
  if (!validation.valid) {
    return {
      status: 422,
      body: {
        error: `Action proposal validation failed: ${validation.error}`,
        code: 'schema_invalid',
      },
    }
  }
  // 2. Insert ai_actions row — status: proposed
  const [action] = await platformDb
    .insert(aiActions)
    .values({
      orgId,
      appKey,
      profileKey,
      actionType,
      status: 'proposed',
      proposalJson: validation.data as Record<string, unknown>,
      requestedBy: actorId,
      relatedDomainType: relatedDomainType ?? null,
      relatedDomainId: relatedDomainId ?? undefined,
      evidencePackEligible: evidencePackEligible ?? false,
    })
    .returning()
  // 3. Audit event — proposed
  await appendAiAuditEvent({
    orgId,
    actorClerkUserId: actorId,
    action: 'ai.action_proposed',
    targetType: 'ai_action',
    targetId: action.id,
    afterJson: {
      actionType,
      appKey,
      profileKey,
    },
  })
  // 4. Run deterministic policy check
  const policyDecision = await checkActionPolicy({
    actionType,
    orgId,
    appKey,
    profileKey,
    proposalJson: validation.data as Record<string, unknown>,
    actor: actorId,
  })
  // 5. Update action with policy decision
  let finalStatus: string = 'policy_checked'
  let approvedBy: string | null = null
  let approvedAt: Date | null = null
  if (!policyDecision.allowed) {
    finalStatus = 'rejected'
  } else if (policyDecision.autoApproved) {
    finalStatus = 'approved'
    approvedBy = 'system'
    approvedAt = new Date()
  } else if (policyDecision.approvalsRequired && policyDecision.approvalsRequired.length > 0) {
    finalStatus = 'awaiting_approval'
  }
  await platformDb
    .update(aiActions)
    .set({
      status: finalStatus as 'proposed',
      riskTier: policyDecision.riskTier,
      policyDecisionJson: policyDecision,
      approvalsRequiredJson: policyDecision.approvalsRequired,
      approvedBy,
      approvedAt,
      updatedAt: new Date(),
    })
    .where(eq(aiActions.id, action.id))
  if (finalStatus === 'approved') {
    recordAiReviewDecision({
      appKey,
      orgId,
      modelUsed: actionType,
      engineVersion: `policy:${profileKey}`,
      approved: true,
      overridden: false,
      requestId: action.id,
      traceId: action.id,
    })
  }
  return {
    status: 201,
    body: {
      actionId: action.id,
      status: finalStatus,
      policyDecision,
    },
  }
}

export async function ingestKnowledgeAction(
  proposal: z.infer<typeof AiIngestKnowledgeSourceProposalSchema>,
  actorId: string,
) {
  // 1. Create action
  const [action] = await platformDb
    .insert(aiActions)
    .values({
      orgId: proposal.orgId,
      appKey: proposal.appKey,
      profileKey: proposal.profileKey,
      actionType: ACTION_TYPES.AI_INGEST_KNOWLEDGE_SOURCE,
      status: 'proposed',
      proposalJson: proposal as unknown as Record<string, unknown>,
      requestedBy: actorId,
      relatedDomainType: 'knowledge_source',
    })
    .returning()
  await appendAiAuditEvent({
    orgId: proposal.orgId,
    actorClerkUserId: actorId,
    action: 'ai.action_proposed',
    targetType: 'ai_action',
    targetId: action.id,
    afterJson: {
      actionType: ACTION_TYPES.AI_INGEST_KNOWLEDGE_SOURCE,
      sourceTitle: proposal.source.title,
    },
  })
  // 2. Policy check
  const policyDecision = await checkActionPolicy({
    actionType: ACTION_TYPES.AI_INGEST_KNOWLEDGE_SOURCE,
    orgId: proposal.orgId,
    appKey: proposal.appKey,
    profileKey: proposal.profileKey,
    proposalJson: proposal as unknown as Record<string, unknown>,
    actor: actorId,
  })
  if (!policyDecision.allowed) {
    await platformDb
      .update(aiActions)
      .set({
        status: 'rejected',
        policyDecisionJson: policyDecision,
        updatedAt: new Date(),
      })
      .where(eq(aiActions.id, action.id))
    return {
      status: 403,
      body: {
        actionId: action.id,
        status: 'rejected',
        policyDecision,
      },
    }
  }
  // 3. Auto-approve if applicable
  if (policyDecision.autoApproved) {
    await platformDb
      .update(aiActions)
      .set({
        status: 'approved',
        riskTier: policyDecision.riskTier,
        policyDecisionJson: policyDecision,
        approvedBy: 'system',
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiActions.id, action.id))
    // 4. Execute immediately
    const result = await executeAction(action.id, actorId)
    return {
      status: result.status === 'success' ? 201 : 500,
      body: {
        actionId: action.id,
        ...result,
      },
    }
  }
  // Not auto-approved — return awaiting
  await platformDb
    .update(aiActions)
    .set({
      status: 'awaiting_approval',
      riskTier: policyDecision.riskTier,
      policyDecisionJson: policyDecision,
      approvalsRequiredJson: policyDecision.approvalsRequired,
      updatedAt: new Date(),
    })
    .where(eq(aiActions.id, action.id))
  return {
    status: 202,
    body: {
      actionId: action.id,
      status: 'awaiting_approval',
      policyDecision,
    },
  }
}

export async function generateStripeMonthlyReportsAction(
  proposal: z.infer<typeof FinanceStripeMonthlyReportsProposalSchema>,
  actorId: string,
) {
  // 1. Create action
  const [action] = await platformDb
    .insert(aiActions)
    .values({
      orgId: proposal.orgId,
      appKey: proposal.appKey,
      profileKey: proposal.profileKey,
      actionType: ACTION_TYPES.FINANCE_STRIPE_MONTHLY_REPORTS,
      status: 'proposed',
      proposalJson: proposal as unknown as Record<string, unknown>,
      requestedBy: actorId,
      evidencePackEligible: proposal.evidence.storeUnderEvidencePack,
      relatedDomainType: proposal.period.periodId ? 'close_period' : null,
      relatedDomainId: proposal.period.periodId ?? undefined,
    })
    .returning()
  await appendAiAuditEvent({
    orgId: proposal.orgId,
    actorClerkUserId: actorId,
    action: 'ai.action_proposed',
    targetType: 'ai_action',
    targetId: action.id,
    afterJson: {
      actionType: ACTION_TYPES.FINANCE_STRIPE_MONTHLY_REPORTS,
      periodLabel: proposal.period.periodLabel,
    },
  })
  // 2. Policy check
  const policyDecision = await checkActionPolicy({
    actionType: ACTION_TYPES.FINANCE_STRIPE_MONTHLY_REPORTS,
    orgId: proposal.orgId,
    appKey: proposal.appKey,
    profileKey: proposal.profileKey,
    proposalJson: proposal as unknown as Record<string, unknown>,
    actor: actorId,
  })
  if (!policyDecision.allowed) {
    await platformDb
      .update(aiActions)
      .set({
        status: 'rejected',
        policyDecisionJson: policyDecision,
        updatedAt: new Date(),
      })
      .where(eq(aiActions.id, action.id))
    return {
      status: 403,
      body: {
        actionId: action.id,
        status: 'rejected',
        policyDecision,
      },
    }
  }
  // 3. Auto-approve if applicable
  if (policyDecision.autoApproved) {
    await platformDb
      .update(aiActions)
      .set({
        status: 'approved',
        riskTier: policyDecision.riskTier,
        policyDecisionJson: policyDecision,
        approvedBy: 'system',
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiActions.id, action.id))
    // 4. Execute immediately
    const result = await executeAction(action.id, actorId)
    return {
      status: result.status === 'success' ? 201 : 500,
      body: {
        actionId: action.id,
        ...result,
      },
    }
  }
  // Not auto-approved — return awaiting
  await platformDb
    .update(aiActions)
    .set({
      status: 'awaiting_approval',
      riskTier: policyDecision.riskTier,
      policyDecisionJson: policyDecision,
      approvalsRequiredJson: policyDecision.approvalsRequired,
      updatedAt: new Date(),
    })
    .where(eq(aiActions.id, action.id))
  return {
    status: 202,
    body: {
      actionId: action.id,
      status: 'awaiting_approval',
      policyDecision,
    },
  }
}
