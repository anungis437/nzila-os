/**
 * /api/workbook/[id]/memory-holders/[holderId]
 *
 *   PATCH  \u2014 update an existing memory holder (any subset of fields)
 *   DELETE \u2014 remove a memory holder
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { workbookMemoryHolders } from '@/db/schema/workbook-schema';
import { withClaimedWorkbookAccess } from '@/lib/workbook/access-control';
import { auditClaimedWorkbookWrite } from '@/lib/workbook/claimed-write-audit';
import { logger } from '@/lib/logger';
import { opaqueRef } from '@/lib/icra/opaque-ref';
import { guardPublicIntake } from '@/lib/public-intake/guard';
import { assertNoticeContract, holderNoticeSchema, HolderNoticeBlocked, IDENTIFYING_FIELDS, noticeColumns } from '@/lib/workbook/holder-notice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// A memory holder belongs to its workbook, and a workbook to the organization it was claimed into. The statement
// itself proves that ownership: the holder's workbook must carry the organization the authority resolved. A workbook
// with no stamped organization (pre-claim authoring, legacy claims) matches only while its stamp is still empty.
function holderInOrgWorkbook(workbookId: string, orgId: string | null) {
  return orgId
    ? sql`${workbookMemoryHolders.workbookId} IN (SELECT id FROM workbooks WHERE id = ${workbookId} AND (claimed_org_id = ${orgId} OR claimed_org_id IS NULL))`
    : sql`${workbookMemoryHolders.workbookId} IN (SELECT id FROM workbooks WHERE id = ${workbookId} AND claimed_org_id IS NULL)`;
}

const TENURE_BANDS = ['0_3y', '3_7y', '7_15y', '15y_plus'] as const;
const CRITICALITIES = ['routine', 'important', 'load_bearing', 'institution_critical'] as const;

const patchSchema = z.object({
  role: z.string().min(1).max(255).optional(),
  displayName: z.string().max(255).nullable().optional(),
  responsibility: z.string().min(1).max(2000).optional(),
  tenureBand: z.enum(TENURE_BANDS).nullable().optional(),
  criticality: z.enum(CRITICALITIES).nullable().optional(),
  successorIdentified: z.boolean().optional(),
  notes: z.string().max(4000).nullable().optional(),
  // Records that the named person has been told (see lib/workbook/holder-notice.ts): who recorded it and when come from the session.
  notice: holderNoticeSchema.optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; holderId: string }> },
) {
  const { id: workbookId, holderId } = await params;

  // The workbook identifier is a bearer credential until claimed. Bound
  // attempts and payload bytes before resolving authority or writing to SQL.
  const intake = await guardPublicIntake(request, { bucket: 'capability' });
  if (!intake.ok) return intake.response;

  const parse = patchSchema.safeParse(intake.json);
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { notice, ...columns } = parse.data;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(columns)) {
    if (v !== undefined) patch[k] = v;
  }
  const writesIdentifyingDetail = IDENTIFYING_FIELDS.some((field) => columns[field] !== undefined && columns[field] !== null);

  try {
    // Authorization is resolved first; the protected update then runs inside
    // the DB execution context that matches the resolved authority.
    const access = await withClaimedWorkbookAccess(
      { workbookId, operation: 'write' },
      async (authority) => {
        // A notice is attributed to the identified person who records it; an unclaimed workbook has none, and that is reported rather than faked.
        assertNoticeContract({ writesIdentifyingDetail, notice, authorityKind: authority.kind });
        if (notice && authority.actorUserId) Object.assign(patch, noticeColumns(notice, authority.actorUserId, new Date()));
        const orgId = authority.claimedOrgId;
        const updated = await db
          .update(workbookMemoryHolders)
          .set(patch)
          .where(
            and(
              eq(workbookMemoryHolders.id, holderId),
              eq(workbookMemoryHolders.workbookId, workbookId),
              holderInOrgWorkbook(workbookId, orgId),
            ),
          )
          .returning({ id: workbookMemoryHolders.id });
        if (updated.length > 0) {
          await auditClaimedWorkbookWrite(authority, {
            action: 'workbook.memory_holder.update',
            resourceType: 'workbook_memory_holders',
            resourceId: holderId,
            details: { fields: Object.keys(parse.data).filter((k) => parse.data[k as keyof typeof parse.data] !== undefined) },
          });
        } else {
          // A write that matched nothing is still an attempt by an identified person on the organization's people map.
          await auditClaimedWorkbookWrite(authority, {
            action: 'workbook.memory_holder.update_not_found',
            resourceType: 'workbook_memory_holders',
            resourceId: holderId,
            details: {},
          });
        }
        return updated;
      },
    );

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    if (access.value.length === 0) {
      return NextResponse.json({ error: 'Memory holder not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof HolderNoticeBlocked) {
      return NextResponse.json({ error: { code: err.code, message: 'This write needs a recorded notice to the named person' }, blockedOperation: err.blockedOperation }, { status: 409 });
    }
    logger.error('[workbook-memory-holder:patch] DB error', { workbookRef: opaqueRef(workbookId), holderId, err });
    return NextResponse.json({ error: 'Failed to update memory holder' }, { status: 503 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; holderId: string }> },
) {
  const { id: workbookId, holderId } = await params;

  const intake = await guardPublicIntake(request, { bucket: 'capability', readBody: false });
  if (!intake.ok) return intake.response;

  try {
    // Authorization is resolved first; the protected delete then runs inside
    // the DB execution context that matches the resolved authority.
    const access = await withClaimedWorkbookAccess(
      { workbookId, operation: 'write' },
      async (authority) => {
        const orgId = authority.claimedOrgId;
        const removed = await db
          .delete(workbookMemoryHolders)
          .where(
            and(
              eq(workbookMemoryHolders.id, holderId),
              eq(workbookMemoryHolders.workbookId, workbookId),
              holderInOrgWorkbook(workbookId, orgId),
            ),
          )
          .returning({ id: workbookMemoryHolders.id });
        if (removed.length > 0) {
          await auditClaimedWorkbookWrite(authority, {
            action: 'workbook.memory_holder.delete',
            resourceType: 'workbook_memory_holders',
            resourceId: holderId,
            details: {},
          });
        } else {
          await auditClaimedWorkbookWrite(authority, {
            action: 'workbook.memory_holder.delete_not_found',
            resourceType: 'workbook_memory_holders',
            resourceId: holderId,
            details: {},
          });
        }
        return removed;
      },
    );

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    if (access.value.length === 0) {
      return NextResponse.json({ error: 'Memory holder not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[workbook-memory-holder:delete] DB error', { workbookRef: opaqueRef(workbookId), holderId, err });
    return NextResponse.json({ error: 'Failed to delete memory holder' }, { status: 503 });
  }
}
