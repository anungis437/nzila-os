/**
 * /api/workbook/[id]/memory-holders
 *
 *   GET    \u2014 list all memory holders for a workbook + current cartography
 *   POST   \u2014 create a new memory holder
 *
 * Pseudonymous flow: the workbookId acts as the bearer credential for
 * unclaimed workbooks. Claimed workbooks additionally require the caller
 * to match claimedByUserId or claimedOrgId (enforced via auth() lookup).
 *
 * Anti-surveillance: rate-limited writes; no PII required (displayName is
 * nullable). The cartography engine never reads displayName or notes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { workbooks, workbookMemoryHolders } from '@/db/schema/workbook-schema';
import { runStewardshipCartography } from '@/lib/workbook/engines/stewardshipCartography';
import { withClaimedWorkbookAccess } from '@/lib/workbook/access-control';
import { extractWorkbookCapability } from '@/lib/workbook/workbook-capability';
import { auditClaimedWorkbookWrite, auditWorkbookRead } from '@/lib/workbook/claimed-write-audit';
import { logger } from '@/lib/logger';
import { opaqueRef } from '@/lib/icra/opaque-ref';
import { guardPublicIntake } from '@/lib/public-intake/guard';
import { assertNoticeContract, holderNoticeSchema, HolderNoticeBlocked, IDENTIFYING_FIELDS, noticeColumns, projectHolder, summarizeNotice, verifyNoticeDelivery, type NoticeViewer } from '@/lib/workbook/holder-notice';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Safety ceiling: never build an unbounded personal-data cartography or accept
// unlimited bearer-capability writes. This is an operational bound, not a
// product decision about how many roles a union should model.
export const MAX_WORKBOOK_MEMORY_HOLDERS = 200;

class WorkbookMemoryHolderLimitError extends Error {
  constructor() { super('Workbook memory-holder capacity exceeded'); }
}

const TENURE_BANDS = ['0_3y', '3_7y', '7_15y', '15y_plus'] as const;
const CRITICALITIES = ['routine', 'important', 'load_bearing', 'institution_critical'] as const;

const createSchema = z.object({
  role: z.string().min(1).max(255),
  displayName: z.string().max(255).nullable().optional(),
  responsibility: z.string().min(1).max(2000),
  tenureBand: z.enum(TENURE_BANDS).nullable().optional(),
  criticality: z.enum(CRITICALITIES).nullable().optional(),
  successorIdentified: z.boolean().default(false),
  notes: z.string().max(4000).nullable().optional(),
  // Records that the named person has been told (see lib/workbook/holder-notice.ts): who recorded it and when come from the session.
  notice: holderNoticeSchema.optional(),
});

async function loadCartography(workbookId: string, viewer: NoticeViewer) {
  const rows = await db
    .select({
      id: workbookMemoryHolders.id,
      role: workbookMemoryHolders.role,
      displayName: workbookMemoryHolders.displayName,
      responsibility: workbookMemoryHolders.responsibility,
      tenureBand: workbookMemoryHolders.tenureBand,
      criticality: workbookMemoryHolders.criticality,
      successorIdentified: workbookMemoryHolders.successorIdentified,
      notes: workbookMemoryHolders.notes,
      noticeState: workbookMemoryHolders.noticeState,
      noticeEvidence: workbookMemoryHolders.noticeEvidence,
      notifiedAt: workbookMemoryHolders.notifiedAt,
      noticeChannel: workbookMemoryHolders.noticeChannel,
    })
    .from(workbookMemoryHolders)
    .where(eq(workbookMemoryHolders.workbookId, workbookId))
    .orderBy(workbookMemoryHolders.capturedAt)
    .limit(MAX_WORKBOOK_MEMORY_HOLDERS + 1);

  // A partial cartography would be materially misleading. Fail explicitly
  // rather than silently truncating the institution's memory-holder map.
  if (rows.length > MAX_WORKBOOK_MEMORY_HOLDERS) throw new WorkbookMemoryHolderLimitError();

  const cartography = runStewardshipCartography(
    rows.map((h) => ({
      id: h.id,
      role: h.role,
      criticality: h.criticality as (typeof CRITICALITIES)[number] | null,
      tenureBand: h.tenureBand as (typeof TENURE_BANDS)[number] | null,
      successorIdentified: h.successorIdentified,
    })),
  );

  // What each named person's notice rests on is shown with them (none, a person's statement, or a verified delivery). A name or note whose notice
  // does not meet the policy is shown only to the claimant; everyone else gets it withheld, and is told that it was.
  return { holders: rows.map((row) => projectHolder(row, viewer)), cartography, notice: summarizeNotice(rows) };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workbookId } = await params;
  // The identifier of an unclaimed workbook is its only credential, so reads are slowed like every other bearer route.
  const intake = await guardPublicIntake(request, { bucket: 'capability', readBody: false });
  if (!intake.ok) return intake.response;
  try {
    // Authorization is resolved first; the protected cartography read then runs
    // inside the DB execution context that matches the resolved authority.
    const access = await withClaimedWorkbookAccess(
      { workbookId, operation: 'read', capability: extractWorkbookCapability(request, workbookId) },
      async (authority) => {
        // The people this workbook names have no notice that they are recorded: the read is recorded first, and does not happen if the
        // record cannot be written (an unclaimed workbook under the pseudonymous public-intake audit, a claimed one under its organization).
        await auditWorkbookRead(authority, {
          action: 'workbook.memory_holder.read',
          resourceType: 'workbook_memory_holders',
          resourceId: workbookId,
          details: { authority: authority.kind },
        });
        return loadCartography(workbookId, authority.kind);
      },
    );
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    return NextResponse.json(access.value);
  } catch (err) {
    if (err instanceof WorkbookMemoryHolderLimitError) {
      return NextResponse.json({ error: 'Workbook memory-holder limit exceeded; review required' }, { status: 409 });
    }
    logger.error('[workbook-memory-holders:get] DB error', { workbookRef: opaqueRef(workbookId), err });
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workbookId } = await params;

  // Rate limited and body capped before the body is parsed, and before any DB execution context so no transaction is held open across
  // the request body read.
  const intake = await guardPublicIntake(request, { bucket: 'capability' });
  if (!intake.ok) return intake.response;
  const body: unknown = intake.json;

  const parse = createSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  // A notice is checked with the channel's delivery verifier, if one is registered (none is), before any transaction opens: a provider call is not
  // made while the workbook row is locked. Without a confirming verifier the notice stays a person's statement.
  const verification = parse.data.notice ? await verifyNoticeDelivery(parse.data.notice) : null;

  try {
    // Authorization is resolved first; the protected insert + cartography read
    // then run inside the DB execution context that matches the authority.
    const access = await withClaimedWorkbookAccess(
      { workbookId, operation: 'write', capability: extractWorkbookCapability(request, workbookId) },
      async (authority) => {
        // A notice is attributed to the identified person who records it; an unclaimed workbook has none, and that is reported rather than faked.
        const writesIdentifyingDetail = IDENTIFYING_FIELDS.some((field) => parse.data[field] !== undefined && parse.data[field] !== null);
        try {
          assertNoticeContract({ writesIdentifyingDetail, notice: parse.data.notice, authorityKind: authority.kind, verification });
        } catch (error) {
          if (!(error instanceof HolderNoticeBlocked)) throw error;
          // The refusal is itself recorded (the workbook is not touched, so nothing rolls it back).
          await auditClaimedWorkbookWrite(authority, {
            action: 'workbook.memory_holder.create_refused',
            resourceType: 'workbook_memory_holders',
            resourceId: workbookId,
            details: { code: error.code, fields: IDENTIFYING_FIELDS.filter((field) => parse.data[field] !== undefined && parse.data[field] !== null) },
          });
          return { refused: error } as const;
        }
        // Lock the parent workbook within the authority transaction. Concurrent
        // writers serialize on this row, so a count check cannot race another
        // POST and exceed the ceiling. Recheck ownership after acquiring the
        // lock: a claim/transfer may have occurred after authorization.
        const [lockedWorkbook] = await db
          .select({
            id: workbooks.id,
            claimedByUserId: workbooks.claimedByUserId,
            claimedOrgId: workbooks.claimedOrgId,
          })
          .from(workbooks)
          .where(eq(workbooks.id, workbookId))
          .for('update');
        if (
          !lockedWorkbook ||
          lockedWorkbook.claimedByUserId !== authority.claimedByUserId ||
          (lockedWorkbook.claimedOrgId != null && lockedWorkbook.claimedOrgId !== authority.claimedOrgId)
        ) throw new Error('Workbook authority changed before memory-holder write');

        const existingHolders = await db
          .select({ id: workbookMemoryHolders.id })
          .from(workbookMemoryHolders)
          .where(eq(workbookMemoryHolders.workbookId, workbookId))
          .limit(MAX_WORKBOOK_MEMORY_HOLDERS);
        if (existingHolders.length >= MAX_WORKBOOK_MEMORY_HOLDERS) {
          throw new WorkbookMemoryHolderLimitError();
        }

        const [inserted] = await db
          .insert(workbookMemoryHolders)
          .values({
            workbookId,
            role: parse.data.role,
            displayName: parse.data.displayName ?? null,
            responsibility: parse.data.responsibility,
            tenureBand: parse.data.tenureBand ?? null,
            criticality: parse.data.criticality ?? null,
            successorIdentified: parse.data.successorIdentified,
            notes: parse.data.notes ?? null,
            ...(parse.data.notice && authority.actorUserId ? noticeColumns(parse.data.notice, authority.actorUserId, new Date(), verification) : {}),
          })
          .returning({ id: workbookMemoryHolders.id });

        await auditClaimedWorkbookWrite(authority, {
          action: 'workbook.memory_holder.create',
          resourceType: 'workbook_memory_holders',
          resourceId: inserted?.id ?? workbookId,
          details: { role: parse.data.role },
        });

        const cartography = await loadCartography(workbookId, authority.kind);
        return { id: inserted?.id, ...cartography };
      },
    );

    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const outcome = access.value;
    if ('refused' in outcome && outcome.refused instanceof HolderNoticeBlocked) {
      const refused = outcome.refused;
      return NextResponse.json({ error: { code: refused.code, message: 'A name or note about a person needs a delivery-verified notice to that person, and none can be recorded yet' }, blockedOperation: refused.blockedOperation }, { status: 409 });
    }
    return NextResponse.json(access.value, { status: 201 });
  } catch (err) {
    if (err instanceof HolderNoticeBlocked) {
      return NextResponse.json({ error: { code: err.code, message: 'This write needs a recorded notice to the named person' }, blockedOperation: err.blockedOperation }, { status: 409 });
    }
    if (err instanceof WorkbookMemoryHolderLimitError) {
      return NextResponse.json({ error: 'Workbook memory-holder limit reached; review required' }, { status: 409 });
    }
    logger.error('[workbook-memory-holders:post] DB error', { workbookRef: opaqueRef(workbookId), err });
    return NextResponse.json({ error: 'Failed to add memory holder' }, { status: 503 });
  }
}
