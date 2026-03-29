// Observability: @nzila/os-core/telemetry — structured logging and request tracing available via os-core.
/**
 * API — Entity Audit Chain Verification
 * POST /api/audit/verify-entity-chain → verify audit chain integrity for a specific org
 *
 * Exposes the verifyEntityAuditChain() function from lib/audit-db as an HTTP endpoint.
 * This verifies the full hash-chain linkage of audit events for an org,
 * checking both previousHash linkage and per-event hash recomputation.
 *
 * SEC-CHAIN-001: Complements /api/audit/verify-chain (generic) with
 * entity-specific audit chain verification that includes hash recomputation.
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireOrgAccess } from '@/lib/api-guards'
import { verifyEntityAuditChain, recordAuditEvent, AUDIT_ACTIONS } from '@/lib/audit-db'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('api.audit.verify-entity-chain')

const VerifyEntityChainSchema = z.object({
  orgId: z.string().uuid(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = VerifyEntityChainSchema.safeParse(body)
  if (!parsed.success)
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { orgId } = parsed.data

  // Check authentication + org membership (platform_admin bypasses)
  const guard = await requireOrgAccess(orgId, {
    platformBypass: ['platform_admin'],
  })
  if (!guard.ok) return guard.response

  try {
    const result = await verifyEntityAuditChain(orgId)

    // Audit the verification itself
    await recordAuditEvent({
      orgId,
      actorClerkUserId: guard.context.userId,
      action: AUDIT_ACTIONS.EVIDENCE_PACK_VERIFY,
      targetType: 'audit_chain',
      targetId: orgId,
      afterJson: {
        valid: result.valid,
        totalEvents: result.totalEvents,
        ...(result.brokenAtIndex !== undefined && { brokenAtIndex: result.brokenAtIndex }),
      },
    })

    logger.info('Entity audit chain verified', {
      orgId,
      valid: result.valid,
      totalEvents: result.totalEvents,
    })

    return NextResponse.json({
      chainType: 'entity-audit',
      orgId,
      ...result,
      verifiedAt: new Date().toISOString(),
    })
  } catch (error) {
    logger.error('Entity audit chain verification failed', { orgId, error })
    return NextResponse.json(
      { error: 'Chain verification failed' },
      { status: 500 },
    )
  }
}
