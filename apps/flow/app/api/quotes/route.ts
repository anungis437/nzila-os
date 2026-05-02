import { NextResponse } from 'next/server'
import { authenticateUser, withRequestContext } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { quoteRepo } from '@/lib/db'
import { resolveOrgContext } from '@/lib/resolve-org'
import { enforceDecision } from '@nzila/decision-core'
import { createNarProofAdapter, getNarSigningSecret } from '@nzila/nar'
import { platformDb } from '@nzila/db/platform'
import { auditRecords } from '@nzila/db/schema'
import { desc, eq } from 'drizzle-orm'

/**
 * GET /api/quotes — list all quotes for the current org.
 * POST /api/quotes — create a new quote.
 */

export async function GET(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.quotes.list', { 'http.method': 'GET' }, async () => {
    const authResult = await authenticateUser()
    if (!authResult.ok) return authResult.response
    try {
      const ctx = await resolveOrgContext()
      const quotes = await quoteRepo.findAll(ctx.orgId)
      return NextResponse.json({ ok: true, data: quotes })
    } catch (_err) {
      return NextResponse.json(
        { ok: false, error: 'Internal server error' },
        { status: 500 },
      )
    }
    }),
  )
}

const narProofAdapter = createNarProofAdapter({
  keyId: process.env.NAR_SIGNING_KEY_ID,
  getPreviousHash: async (organizationId) => {
    const rows = await platformDb
      .select({ hash: auditRecords.narHash })
      .from(auditRecords)
      .where(eq(auditRecords.organizationId, organizationId))
      .orderBy(desc(auditRecords.createdAt))
      .limit(1)
    return rows[0]?.hash
  },
  persistRecord: async (record) => {
    await platformDb.insert(auditRecords).values({
      id: record.id,
      decisionRecordId: record.decisionRecordId,
      organizationId: record.organizationId,
      decisionType: record.decisionType,
      actionType: record.actionType,
      actorId: record.actorId,
      actorType: record.actorType,
      resourceType: record.resourceType,
      resourceId: record.resourceId,
      policyId: record.policyId,
      policyVersion: record.policyVersion,
      inputHash: record.inputHash,
      outcomeHash: record.outcomeHash,
      payload: record.payload,
      narHash: record.seal.hash,
      narSignature: record.seal.signature,
      previousHash: record.seal.previousHash,
      keyId: record.seal.keyId,
      storageType: record.storage?.type,
      storageUri: record.storage?.uri,
      immutable: record.storage?.immutable,
      retentionUntil: record.storage?.retentionUntil ? new Date(record.storage.retentionUntil) : null,
      createdAt: new Date(record.createdAt),
    })
    return { auditRecordId: record.id }
  },
  getSigningSecret: getNarSigningSecret,
})

export async function POST(request: Request) {
  return withRequestContext(request, () =>
    withSpan('api.quotes.create', { 'http.method': 'POST' }, async () => {
    const authResult = await authenticateUser()
    if (!authResult.ok) return authResult.response
    try {
      const body = await request.json()

    // Minimal validation
    if (!body.title) {
      return NextResponse.json(
        { ok: false, error: 'title is required' },
        { status: 400 },
      )
    }

    const ctx = await resolveOrgContext()
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
      return NextResponse.json(
        { ok: false, error: 'Quote decision validation failed', decision: preflightDecision.decision },
        { status: 422 },
      )
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

    return NextResponse.json({ ok: true, data: quote, decision: recordedDecision.decision }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
    }),
  )
}
