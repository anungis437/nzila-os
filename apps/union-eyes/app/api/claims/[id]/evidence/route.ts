/**
 * GET /api/claims/[id]/evidence
 *
 * Returns the evidence pack for a claim:
 * - Claim metadata
 * - Workflow events (status_change audit trail)
 * - Documents / attachments
 * - Defensibility pack (if previously generated)
 */
import { NextRequest, NextResponse } from 'next/server'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { claims, claimUpdates } from '@/db/schema'
import { defensibilityPacks } from '@/db/schema/defensibility-packs-schema'
import { eq, and, desc } from 'drizzle-orm'
import { logger } from '@/lib/logger'
import { clientErrorResponse } from '@/lib/api/authorization-denial'
import { claimHistoryReference } from '@/lib/cases/claim-history-reference'
import {
  caseAuthorizationResponse,
  caseHistoryVisibility,
  findReadableCase,
  getCaseActor,
} from '@/lib/cases/case-authorization'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // Organization and case authority are derived server-side; evidence is the internal file, so it needs the kernel's
    // internal-read decision for this case.
    const actor = await getCaseActor()
    const { id: claimId } = await params

    const evidence = await withRLSContext(async (tx) => {
      const readable = await findReadableCase(tx, actor, claimId, false, 'case:read_internal')
      if (!readable) return null

      const [claim] = await tx
        .select()
        .from(claims)
        .where(and(eq(claims.claimId, readable.claimId), eq(claims.organizationId, actor.organizationId)))
        .limit(1)
      if (!claim) return null

      const updates = await tx
        .select()
        .from(claimUpdates)
        .where(and(eq(claimUpdates.claimId, claimHistoryReference(claim.claimId)), caseHistoryVisibility(readable.visibility)))
        .orderBy(claimUpdates.createdAt)

      const [pack] = await tx
        .select()
        .from(defensibilityPacks)
        .where(eq(defensibilityPacks.caseId, claim.claimId))
        .orderBy(desc(defensibilityPacks.generatedAt))
        .limit(1)

      return { claim, updates, pack }
    })

    if (!evidence) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }
    const { claim, updates, pack } = evidence

    return NextResponse.json({
      claim: {
        claimId: claim.claimId,
        claimNumber: claim.claimNumber,
        status: claim.status,
        priority: claim.priority,
        claimType: claim.claimType,
        incidentDate: claim.incidentDate,
        location: claim.location,
        description: claim.description,
        assignedTo: claim.assignedTo,
        progress: claim.progress,
        createdAt: claim.createdAt,
        updatedAt: claim.updatedAt,
        closedAt: claim.closedAt,
        attachments: claim.attachments,
      },
      events: updates.map((u) => ({
        id: u.updateId,
        type: u.updateType,
        message: u.message,
        createdBy: u.createdBy,
        isInternal: u.isInternal,
        visibilityScope: u.visibilityScope,
        metadata: u.metadata,
        createdAt: u.createdAt,
      })),
      documents: Array.isArray(claim.attachments) ? claim.attachments : [],
      audit_log: updates
        .filter((u) => u.updateType === 'status_change')
        .map((u) => ({
          id: u.updateId,
          action: u.updateType,
          message: u.message,
          actor: u.createdBy,
          timestamp: u.createdAt,
          metadata: u.metadata,
        })),
      defensibility_pack: pack
        ? {
            version: pack.packVersion,
            generated_at: pack.generatedAt,
            integrity_hash: pack.integrityHash,
            verification_status: pack.verificationStatus,
          }
        : null,
      generated_at: new Date().toISOString(),
    })
  } catch (err) {
    const denied = caseAuthorizationResponse(err) ?? clientErrorResponse(err)
    if (denied) return denied
    logger.error('Evidence pack export failed', { error: String(err) })
    return NextResponse.json(
      { error: 'Failed to export evidence' },
      { status: 500 },
    )
  }
}
