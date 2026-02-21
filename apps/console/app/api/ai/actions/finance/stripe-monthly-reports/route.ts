// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Convenience: Generate Stripe Monthly Reports (AI Action)
 * POST /api/ai/actions/finance/stripe-monthly-reports
 *
 * Wraps propose + execute in one flow for auto-approved low-risk actions.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { aiActions } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import {
  ACTION_TYPES,
  FinanceStripeMonthlyReportsProposalSchema,
  validateActionProposal,
  checkActionPolicy,
  executeAction,
  appendAiAuditEvent,
} from '@nzila/ai-core'
import { requireEntityAccess } from '@/lib/api-guards'
import { asAiError } from '@/lib/catch-utils'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate proposal
    const parsed = FinanceStripeMonthlyReportsProposalSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const proposal = parsed.data
    const access = await requireEntityAccess(proposal.entityId, {
      minRole: 'entity_secretary',
    })
    if (!access.ok) return access.response

    // 1. Create action
    const [action] = await db
      .insert(aiActions)
      .values({
        entityId: proposal.entityId,
        appKey: proposal.appKey,
        profileKey: proposal.profileKey,
        actionType: ACTION_TYPES.FINANCE_STRIPE_MONTHLY_REPORTS,
        status: 'proposed',
        proposalJson: proposal as unknown as Record<string, unknown>,
        requestedBy: access.context.userId,
        evidencePackEligible: proposal.evidence.storeUnderEvidencePack,
        relatedDomainType: proposal.period.periodId ? 'close_period' : null,
        relatedDomainId: proposal.period.periodId ?? undefined,
      })
      .returning()

    await appendAiAuditEvent({
      entityId: proposal.entityId,
      actorClerkUserId: access.context.userId,
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
      entityId: proposal.entityId,
      appKey: proposal.appKey,
      profileKey: proposal.profileKey,
      proposalJson: proposal as unknown as Record<string, unknown>,
      actor: access.context.userId,
    })

    if (!policyDecision.allowed) {
      await db
        .update(aiActions)
        .set({
          status: 'rejected',
          policyDecisionJson: policyDecision,
          updatedAt: new Date(),
        })
        .where(eq(aiActions.id, action.id))

      return NextResponse.json({
        actionId: action.id,
        status: 'rejected',
        policyDecision,
      }, { status: 403 })
    }

    // 3. Auto-approve if applicable
    if (policyDecision.autoApproved) {
      await db
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
      const result = await executeAction(action.id, access.context.userId)

      return NextResponse.json({
        actionId: action.id,
        ...result,
      }, { status: result.status === 'success' ? 201 : 500 })
    }

    // Not auto-approved — return awaiting
    await db
      .update(aiActions)
      .set({
        status: 'awaiting_approval',
        riskTier: policyDecision.riskTier,
        policyDecisionJson: policyDecision,
        approvalsRequiredJson: policyDecision.approvalsRequired,
        updatedAt: new Date(),
      })
      .where(eq(aiActions.id, action.id))

    return NextResponse.json({
      actionId: action.id,
      status: 'awaiting_approval',
      policyDecision,
    }, { status: 202 })
  } catch (err) {
    const aiErr = asAiError(err)
    if (aiErr) {
      return NextResponse.json(
        { error: aiErr.message, code: aiErr.code },
        { status: aiErr.statusCode },
      )
    }
    console.error('[Stripe Monthly Reports Error]', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'unknown' },
      { status: 500 },
    )
  }
}
