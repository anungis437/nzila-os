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
import { requireApiAuth } from '@/lib/api-auth-guard'
import { db } from '@/db/db'
import { claims, claimUpdates } from '@/db/schema'
import { defensibilityPacks } from '@/db/schema/defensibility-packs-schema'
import { eq, desc } from 'drizzle-orm'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId: _userId } = await requireApiAuth({
      orgScoped: true,
      roles: ['steward', 'admin'],
    })

    const { id: claimId } = await params

    // Fetch claim
    const [claim] = await db
      .select()
      .from(claims)
      .where(eq(claims.claimId, claimId))
      .limit(1)

    if (!claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    // Fetch all updates (audit log)
    const updates = await db
      .select()
      .from(claimUpdates)
      .where(eq(claimUpdates.claimId, claimId))
      .orderBy(claimUpdates.createdAt)

    // Fetch latest defensibility pack if available
    const [pack] = await db
      .select()
      .from(defensibilityPacks)
      .where(eq(defensibilityPacks.caseId, claimId))
      .orderBy(desc(defensibilityPacks.generatedAt))
      .limit(1)

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
    logger.error('Evidence pack export failed', { error: String(err) })
    return NextResponse.json(
      { error: 'Failed to export evidence' },
      { status: 500 },
    )
  }
}
