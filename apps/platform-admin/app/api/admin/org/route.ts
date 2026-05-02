/**
 * Platform Admin — Org Admin API
 *
 * GET  /api/admin/org       — Resolve org context (entitlements, decisions)
 * POST /api/admin/org/check-entitlement — Check org feature entitlement via CP
 *
 * All routes are strictly org-scoped. Cross-org access is blocked.
 * All mutations flow through the Control Plane client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { withOrgScope } from '../../../../lib/org-scope-guard'
import { getOrgScopedCpClient } from '../../../../lib/control-plane-client'
import { enforceDecision } from '@nzila/decision-core'
import { createNarProofAdapter, getNarSigningSecret } from '@nzila/nar'
import { platformDb } from '@nzila/db/platform'
import { auditRecords } from '@nzila/db/schema'
import { desc, eq } from 'drizzle-orm'

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

// GET /api/admin/org?orgId=<uuid>
export async function GET(request: NextRequest) {
  return withOrgScope(request, async (context) => {
    const cp = getOrgScopedCpClient(context.orgId)

    const [decisions] = await Promise.all([
      cp.getOrgDecisions(),
    ])

    return NextResponse.json({
      ok: true,
      data: {
        orgId: context.orgId,
        actorId: context.actorId,
        orgRole: context.orgRole,
        recentDecisions: decisions.slice(0, 10),
      },
    })
  })
}

// POST /api/admin/org — check entitlement
export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('Idempotency-Key')
  if (!idempotencyKey || idempotencyKey.trim().length === 0) {
    return NextResponse.json(
      { ok: false, error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Idempotency-Key header is required' } },
      { status: 400 },
    )
  }

  return withOrgScope(request, async (context) => {
    const body = await request.json() as { feature?: string }

    if (!body.feature || typeof body.feature !== 'string') {
      return NextResponse.json(
        { ok: false, error: { code: 'MISSING_FEATURE', message: 'feature is required' } },
        { status: 400 },
      )
    }

    const cp = getOrgScopedCpClient(context.orgId)
    const entitlement = await cp.checkEntitlement(body.feature, context.actorId)

    const decisionEvaluation = await enforceDecision({
      decisionType: 'platform.org.entitlement.checked',
      organizationId: context.orgId,
      resourceId: context.orgId,
      actor: {
        id: context.actorId,
        type: 'user',
        role: context.orgRole,
        authorityScope: ['org:entitlement:check'],
      },
      authorityScope: ['org:entitlement:check'],
      input: {
        feature: body.feature,
      },
      policy: {
        id: 'platform.org.entitlement',
        version: '1.0.0',
        domain: 'platform',
      },
      actionType: 'org:entitlement:check',
      proofAdapter: narProofAdapter,
      emitAuditPayload: true,
      auditRecordId: entitlement.decisionId,
    })

    const decision = {
      ...decisionEvaluation.decision,
      outcome: {
        status: entitlement.granted ? 'approved' : 'rejected',
        reasonCode: entitlement.granted ? 'ENTITLEMENT_GRANTED' : 'ENTITLEMENT_DENIED',
        explanationTrace: [
          `Feature ${body.feature} resolved from ${entitlement.source}.`,
          `Tier ${entitlement.tier ?? 'none'} ${entitlement.granted ? 'granted' : 'did not grant'} access.`,
        ],
      },
    }

    return NextResponse.json({ ok: true, data: entitlement, decision })
  })
}
