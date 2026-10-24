/**
 * Case Notes API — GET/POST /api/cases/[caseId]/notes
 *
 * Add and list case notes with audit trail and RLS isolation.
 *
 * PR-023: Case Detail / History / Notes UX Hardening
 */

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { and, eq, desc } from 'drizzle-orm'
import { withRLSContext } from '@/lib/db/with-rls-context'
import { claimUpdates } from '@/db/schema/claims-schema'
import { claimHistoryReference, publicClaimHistory } from '@/lib/cases/claim-history-reference'
import { persistAtomicAudit } from '@/lib/audit/atomic-audit'
import { logger } from '@/lib/logger'
import { buildUnionEvidencePack } from '@/lib/evidence'
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard'
import { authorizationDenialResponse } from '@/lib/api/authorization-denial'
import { getCaseActor, findReadableCase, caseHistoryVisibility, requireCaseAction, caseAuthorizationResponse } from '@/lib/cases/case-authorization'
import { resolveNoteInternal } from '@/lib/cases/note-visibility'

export const dynamic = 'force-dynamic'

const AddNoteSchema = z.object({
  text: z
    .string()
    .min(1, 'Note text is required')
    .max(10000, 'Note must be at most 10,000 characters'),
  isInternal: z.boolean().optional(),
})

/**
 * GET /api/cases/[caseId]/notes — List notes for a case
 */
export async function GET(_request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await params

    const actor = await getCaseActor()
    const orgId = actor.organizationId
    await requireEntitlement(orgId, 'grievance_case_suite')

    const notes = await withRLSContext(async (tx) => {
      const claim = await findReadableCase(tx, actor, caseId)

      if (!claim) return null

      const rows = await tx
        .select()
        .from(claimUpdates)
        .where(and(eq(claimUpdates.claimId, claimHistoryReference(claim.claimId)), caseHistoryVisibility(actor)))
        .orderBy(desc(claimUpdates.createdAt))
      return { claimId: claim.claimId, rows }
    })

    if (notes === null) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Case '${caseId}' not found.` },
        { status: 404 },
      )
    }

    return NextResponse.json({ caseId: notes.claimId, notes: notes.rows.map(note => publicClaimHistory(note, notes.claimId)) })
  } catch (error) {
    const denied = caseAuthorizationResponse(error) ?? authorizationDenialResponse(error)
    if (denied) return denied
    logger.error('Failed to get case notes', error as Error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/cases/[caseId]/notes — Add a note to a case
 */
export async function POST(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await params

    const actor = await getCaseActor()
    const { userId, organizationId: orgId } = actor
    await requireEntitlement(orgId, 'grievance_case_suite')

    // Parse body
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Request body must be valid JSON.' },
        { status: 400 },
      )
    }

    const parsed = AddNoteSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: 'Invalid note.',
          details: parsed.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 },
      )
    }

    const { text } = parsed.data
    const isInternal = resolveNoteInternal(parsed.data.isInternal, actor.role)
    await requireCaseAction(actor, isInternal ? 'note_add_internal' : 'note_add', caseId)

    const note = await withRLSContext(async (tx) => {
      const claim = await findReadableCase(tx, actor, caseId, true)

      if (!claim) return null

      const [newNote] = await tx
        .insert(claimUpdates)
        .values({
          claimId: claimHistoryReference(claim.claimId),
          updateType: 'note',
          message: text,
          createdBy: userId,
          isInternal,
          visibilityScope: isInternal ? 'staff' : 'member',
        })
        .returning()

      // The note and its audit record commit together; the audit carries the length, never the text.
      await persistAtomicAudit(tx, {
        organizationId: orgId,
        userId,
        action: 'case.note.add',
        resourceType: 'claim_updates',
        resourceId: newNote.updateId ?? null,
        details: { event: 'CASE_NOTE_ADDED', caseId, isInternal, contentLength: text.length },
      })

      return publicClaimHistory(newNote, claim.claimId)
    })

    if (!note) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Case '${caseId}' not found.` },
        { status: 404 },
      )
    }

    logger.info('Case note added', {
      caseId,
      noteId: note.updateId,
      isInternal,
    })

    buildUnionEvidencePack({
      actionType: 'CASE_NOTE_ADDED',
      orgId: orgId,
      actorId: userId,
      artifacts: [{ type: 'case_note', data: { caseId, noteId: note.updateId, isInternal } }],
    }).catch((err) =>
      logger.warn('Evidence pack failed', { error: String(err), actionType: 'CASE_NOTE_ADDED' }),
    )

    return NextResponse.json({ success: true, noteId: note.updateId }, { status: 201 })
  } catch (error) {
    const denied = caseAuthorizationResponse(error) ?? authorizationDenialResponse(error)
    if (denied) return denied
    logger.error('Failed to add case note', error as Error)
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 },
    )
  }
}
