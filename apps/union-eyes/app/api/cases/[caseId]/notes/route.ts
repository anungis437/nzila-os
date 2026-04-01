/**
 * Case Notes API — GET/POST /api/cases/[caseId]/notes
 *
 * Add and list case notes with audit trail and RLS isolation.
 *
 * PR-023: Case Detail / History / Notes UX Hardening
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { claimUpdates, claims } from '@/db/schema/claims-schema';
import { auditDataMutation } from '@/lib/audit-logger';
import { logger } from '@/lib/logger';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';

export const dynamic = 'force-dynamic';

const AddNoteSchema = z.object({
  text: z.string().min(1, 'Note text is required').max(10000, 'Note must be at most 10,000 characters'),
  isInternal: z.boolean().optional().default(false),
});

/**
 * GET /api/cases/[caseId]/notes — List notes for a case
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params;

    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'Authentication required.' },
        { status: 401 },
      );
    }
    await requireEntitlement(orgId, 'grievance_case_suite');

    const notes = await withRLSContext(async (tx) => {
      // Verify the case exists (RLS enforces org isolation)
      const [claim] = await tx
        .select({ claimId: claims.claimId })
        .from(claims)
        .where(eq(claims.claimId, caseId))
        .limit(1);

      if (!claim) return null;

      return tx
        .select()
        .from(claimUpdates)
        .where(eq(claimUpdates.claimId, caseId))
        .orderBy(desc(claimUpdates.createdAt));
    });

    if (notes === null) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Case '${caseId}' not found.` },
        { status: 404 },
      );
    }

    return NextResponse.json({ caseId, notes });
  } catch (error) {
    logger.error('Failed to get case notes', error as Error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/cases/[caseId]/notes — Add a note to a case
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await params;

    const { userId, orgId } = await auth();
    if (!userId || !orgId) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED', message: 'Authentication required.' },
        { status: 401 },
      );
    }
    await requireEntitlement(orgId, 'grievance_case_suite');

    // Parse body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'INVALID_INPUT', message: 'Request body must be valid JSON.' },
        { status: 400 },
      );
    }

    const parsed = AddNoteSchema.safeParse(body);
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
      );
    }

    const { text, isInternal } = parsed.data;

    const note = await withRLSContext(async (tx) => {
      // Verify case exists (RLS enforces org isolation)
      const [claim] = await tx
        .select({ claimId: claims.claimId })
        .from(claims)
        .where(eq(claims.claimId, caseId))
        .limit(1);

      if (!claim) return null;

      const [newNote] = await tx
        .insert(claimUpdates)
        .values({
          claimId: caseId,
          updateType: 'note',
          message: text,
          createdBy: userId,
          isInternal,
          visibilityScope: isInternal ? 'staff' : 'member',
        })
        .returning();

      return newNote;
    });

    if (!note) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: `Case '${caseId}' not found.` },
        { status: 404 },
      );
    }

    // Audit trail — log note ID + content hash (not full text for privacy)
    await auditDataMutation({
      userId,
      organizationId: orgId,
      resource: 'claim_updates',
      resourceId: note.updateId,
      action: 'create',
      details: {
        event: 'CASE_NOTE_ADDED',
        caseId,
        isInternal,
        contentLength: text.length,
      },
    });

    logger.info('Case note added', {
      caseId,
      noteId: note.updateId,
      isInternal,
    });

    return NextResponse.json(
      { success: true, noteId: note.updateId },
      { status: 201 },
    );
  } catch (error) {
    logger.error('Failed to add case note', error as Error);
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
