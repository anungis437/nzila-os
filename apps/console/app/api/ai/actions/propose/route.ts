// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — AI Actions: Propose
 * POST /api/ai/actions/propose
 *
 * Phase C: Validates proposal against Zod schema by actionType,
 * runs deterministic policy check, auto-approves low-risk if policy allows.
 * No LLM involved in the propose flow for typed actions.
 */
import { NextRequest, NextResponse } from 'next/server'
import { platformDb } from '@nzila/db/platform'
import { aiActions } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import {
  validateActionProposal,
  appendAiAuditEvent,
  checkActionPolicy,
} from '@nzila/ai-core'
import { requireEntityAccess } from '@/lib/api-guards'
import { asAiError } from '@/lib/catch-utils'
import { z } from 'zod'

const ProposeBodySchema = z.object({
  entityId: z.string().uuid(),
  appKey: z.string().min(1).max(60),
  profileKey: z.string().min(1).max(120),
  actionType: z.string().min(1).max(120),
  proposalJson: z.record(z.unknown()),
  relatedDomainType: z.string().max(60).optional(),
  relatedDomainId: z.string().uuid().optional(),
  evidencePackEligible: z.boolean().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = ProposeBodySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const {
      entityId,
      appKey,
      profileKey,
      actionType,
      proposalJson,
      relatedDomainType,
      relatedDomainId,
      evidencePackEligible,
    } = parsed.data

    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    // 1. Validate proposal against action type schema
    const validation = validateActionProposal(actionType, proposalJson)
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Action proposal validation failed: ${validation.error}`, code: 'schema_invalid' },
        { status: 422 },
      )
    }

    // 2. Insert ai_actions row — status: proposed
    const [action] = await platformDb
      .insert(aiActions)
      .values({
        entityId,
        appKey,
        profileKey,
        actionType,
        status: 'proposed',
        proposalJson: validation.data as Record<string, unknown>,
        requestedBy: access.context.userId,
        relatedDomainType: relatedDomainType ?? null,
        relatedDomainId: relatedDomainId ?? undefined,
        evidencePackEligible: evidencePackEligible ?? false,
      })
      .returning()

    // 3. Audit event — proposed
    await appendAiAuditEvent({
      entityId,
      actorClerkUserId: access.context.userId,
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
      entityId,
      appKey,
      profileKey,
      proposalJson: validation.data as Record<string, unknown>,
      actor: access.context.userId,
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

    return NextResponse.json({
      actionId: action.id,
      status: finalStatus,
      policyDecision,
    }, { status: 201 })
  } catch (err) {
    const aiErr = asAiError(err)
    if (aiErr) {
      return NextResponse.json(
        { error: aiErr.message, code: aiErr.code },
        { status: aiErr.statusCode },
      )
    }
    console.error('[AI Action Propose Error]', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'unknown' },
      { status: 500 },
    )
  }
}
