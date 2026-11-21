import { quoteRepo, type CreateQuoteInput } from '@/lib/db'
import type { OrgContext } from '@nzila/commerce-core/types'
import { enforceDecision } from '@nzila/decision-core'
import { createPlatformNarProofAdapter } from '@/lib/audit/platform-nar-proof'

const narProofAdapter = createPlatformNarProofAdapter()

export async function listQuotes(ctx: OrgContext) {
  return quoteRepo.findAll(ctx.orgId)
}

type QuoteCreationInput = Partial<Omit<CreateQuoteInput, 'orgId'>> & { title: string }

export async function createQuote(ctx: OrgContext, body: QuoteCreationInput) {
  const decisionInput = {
    title: body.title,
    customerId: body.customerId ?? 'unknown',
    tier: body.tier ?? 'STANDARD',
    boxCount: body.boxCount ?? 1,
    theme: body.theme,
    notes: body.notes,
    lineCount: Array.isArray(body.lines) ? body.lines.length : 0,
  }

  const preflightDecision = await enforceDecision({
    decisionType: 'flow.quote.created',
    organizationId: ctx.orgId,
    resourceId: 'pending',
    actor: {
      id: ctx.actorId,
      type: 'user',
      role: ctx.role,
      authorityScope: ctx.permissions,
    },
    authorityScope: ctx.permissions,
    input: decisionInput,
    policy: {
      id: 'commerce.quote.approval',
      version: '1.0.0',
      domain: 'commerce',
    },
    actionType: 'quote:create',
    proofAdapter: narProofAdapter,
    emitAuditPayload: true,
  })

  if (!preflightDecision.allowed) {
    return {
      ok: false as const,
      error: 'Quote decision validation failed',
      decision: preflightDecision.decision,
    }
  }

  const quote = await quoteRepo.create({
    orgId: ctx.orgId,
    title: body.title,
    tier: body.tier ?? 'STANDARD',
    customerId: body.customerId ?? 'unknown',
    boxCount: body.boxCount ?? 1,
    theme: body.theme,
    notes: body.notes,
    lines: body.lines ?? [],
  })

  const recordedDecision = await enforceDecision({
    decisionType: 'flow.quote.created',
    organizationId: ctx.orgId,
    resourceId: quote.id,
    actor: {
      id: ctx.actorId,
      type: 'user',
      role: ctx.role,
      authorityScope: ctx.permissions,
    },
    authorityScope: ctx.permissions,
    input: decisionInput,
    policy: {
      id: 'commerce.quote.approval',
      version: '1.0.0',
      domain: 'commerce',
    },
    actionType: 'quote:create',
    proofAdapter: narProofAdapter,
    emitAuditPayload: true,
  })

  return { ok: true as const, data: quote, decision: recordedDecision.decision }
}
