/**
 * API — AI Actions: Propose
 * POST /api/ai/actions/propose
 *
 * Uses LLM to generate a structured action proposal,
 * validates it, and stores as a proposed action.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@nzila/db'
import { aiActions } from '@nzila/db/schema'
import {
  generate,
  AiActionProposeRequestSchema,
  AiControlPlaneError,
  validateActionProposal,
  appendAiAuditEvent,
} from '@nzila/ai-core'
import { requireEntityAccess } from '@/lib/api-guards'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = AiActionProposeRequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { entityId, appKey, profileKey, actionType, input, trace } = parsed.data

    const access = await requireEntityAccess(entityId)
    if (!access.ok) return access.response

    // 1. Generate proposal via LLM
    const systemPrompt = `You are an AI assistant that generates structured action proposals. Generate a JSON object for action type "${actionType}". Return ONLY valid JSON.`

    const result = await generate({
      entityId,
      appKey,
      profileKey,
      input: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input },
      ],
      dataClass: 'internal',
      trace,
    })

    // 2. Parse JSON
    let proposalJson: Record<string, unknown>
    try {
      proposalJson = JSON.parse(result.content)
    } catch {
      return NextResponse.json(
        { error: 'LLM did not return valid JSON for action proposal', code: 'schema_invalid' },
        { status: 422 },
      )
    }

    // 3. Validate against action type schema
    const validation = validateActionProposal(actionType, proposalJson)
    if (!validation.valid) {
      return NextResponse.json(
        { error: `Action proposal validation failed: ${validation.error}`, code: 'schema_invalid' },
        { status: 422 },
      )
    }

    // 4. Insert ai_actions row
    const [action] = await db
      .insert(aiActions)
      .values({
        entityId,
        appKey,
        profileKey,
        actionType,
        status: 'proposed',
        proposalJson: validation.data as Record<string, unknown>,
        requestedBy: access.context.userId,
        relatedDomainType: trace?.domainType ?? null,
        relatedDomainId: trace?.domainId ?? undefined,
        aiRequestId: result.requestId,
      })
      .returning()

    // 5. Audit event
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
        aiRequestId: result.requestId,
      },
    })

    return NextResponse.json({
      requestId: result.requestId,
      actionId: action.id,
      proposalJson: validation.data,
    }, { status: 201 })
  } catch (err) {
    if (err instanceof AiControlPlaneError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.statusCode },
      )
    }
    console.error('[AI Action Propose Error]', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'unknown' },
      { status: 500 },
    )
  }
}
