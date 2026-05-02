/**
 * API — /api/payouts
 * GET  → list payouts (optional creatorId filter)
 * POST → execute a payout
 *
 * Role enforcement: GET requires finance_admin or client_admin.
 *                   POST requires finance_admin only.
 */
import { NextResponse } from 'next/server'
import { withOrgScope, requireRole } from '@/lib/api-guards'
import { withSpan } from '@nzila/os-core/telemetry'
import { listPayouts, executePayout } from '@/lib/actions/payout-actions'
import { enforceDecision } from '@nzila/decision-core'
import { createNarProofAdapter, getNarSigningSecret } from '@nzila/nar'
import { platformDb } from '@nzila/db/platform'
import { auditRecords } from '@nzila/db/schema'
import { desc, eq } from 'drizzle-orm'

export async function GET(request: Request) {
  return withOrgScope(request, async ({ orgId }) =>
    withSpan('api.payouts.list', { 'http.method': 'GET' }, async () => {
      const roleGuard = await requireRole(orgId, ['finance_admin', 'client_admin'])
      if (!roleGuard.ok) return roleGuard.response

      const url = new URL(request.url)
      const page = Number(url.searchParams.get('page') ?? '1')
      const creatorId = url.searchParams.get('creatorId') ?? undefined

      const data = await listPayouts({ page, creatorId })
      return NextResponse.json({ ok: true, data })
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
  return withOrgScope(request, async ({ orgId, userId }) =>
    withSpan('api.payouts.execute', { 'http.method': 'POST' }, async () => {
      const roleGuard = await requireRole(orgId, ['finance_admin'])
      if (!roleGuard.ok) return roleGuard.response

      try {
        const body = await request.json()

        if (!body.creatorId || !body.amount) {
          return NextResponse.json(
            { ok: false, error: 'creatorId and amount are required' },
            { status: 400 },
          )
        }

        const preflightDecision = await enforceDecision({
          decisionType: 'zonga.payout.approved',
          organizationId: orgId,
          resourceId: 'pending',
          actor: {
            id: userId,
            type: 'user',
            role: roleGuard.role,
            authorityScope: ['payout:approve'],
          },
          authorityScope: ['payout:approve'],
          input: {
            creatorId: body.creatorId,
            amount: body.amount,
          },
          policy: {
            id: 'media.payout.approval',
            version: '1.0.0',
            domain: 'media',
          },
          actionType: 'payout:approve',
          proofAdapter: narProofAdapter,
          emitAuditPayload: true,
        })

        if (!preflightDecision.allowed) {
          return NextResponse.json(
            { ok: false, error: 'Decision validation failed', decision: preflightDecision.decision },
            { status: 422 },
          )
        }

        const result = await executePayout({
          creatorId: body.creatorId,
          amount: body.amount,
          currency: body.currency,
          payoutRail: body.payoutRail,
          creatorName: body.creatorName,
        })

        if (!result.success) {
          return NextResponse.json(
            { ok: false, error: 'Payout execution failed' },
            { status: 400 },
          )
        }

        const resourceId = (result as Record<string, unknown>).payoutId as string | undefined
          ?? (result as Record<string, unknown>).id as string | undefined
          ?? String(body.creatorId)

        const recordedDecision = await enforceDecision({
          decisionType: 'zonga.payout.approved',
          organizationId: orgId,
          resourceId,
          actor: {
            id: userId,
            type: 'user',
            role: roleGuard.role,
            authorityScope: ['payout:approve'],
          },
          authorityScope: ['payout:approve'],
          input: {
            creatorId: body.creatorId,
            amount: body.amount,
          },
          policy: {
            id: 'media.payout.approval',
            version: '1.0.0',
            domain: 'media',
          },
          actionType: 'payout:approve',
          proofAdapter: narProofAdapter,
          emitAuditPayload: true,
        })

        return NextResponse.json({ ok: true, data: result, decision: recordedDecision.decision }, { status: 201 })
      } catch (_err) {
        return NextResponse.json(
          { ok: false, error: 'Internal server error' },
          { status: 500 },
        )
      }
    }),
  )
}
