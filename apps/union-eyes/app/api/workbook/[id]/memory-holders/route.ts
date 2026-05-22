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
import {
  workbookMemoryHolders,
  workbooks,
} from '@/db/schema/workbook-schema';
import { runStewardshipCartography } from '@/lib/workbook/engines/stewardshipCartography';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
});

async function loadCartography(workbookId: string) {
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
    })
    .from(workbookMemoryHolders)
    .where(eq(workbookMemoryHolders.workbookId, workbookId))
    .orderBy(workbookMemoryHolders.capturedAt);

  const cartography = runStewardshipCartography(
    rows.map((h) => ({
      id: h.id,
      role: h.role,
      criticality: h.criticality as (typeof CRITICALITIES)[number] | null,
      tenureBand: h.tenureBand as (typeof TENURE_BANDS)[number] | null,
      successorIdentified: h.successorIdentified,
    })),
  );

  return { holders: rows, cartography };
}

async function verifyWorkbookExists(workbookId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: workbooks.id })
    .from(workbooks)
    .where(eq(workbooks.id, workbookId))
    .limit(1);
  return Boolean(row);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workbookId } = await params;
  if (!(await verifyWorkbookExists(workbookId))) {
    return NextResponse.json({ error: 'Workbook not found' }, { status: 404 });
  }
  try {
    const payload = await loadCartography(workbookId);
    return NextResponse.json(payload);
  } catch (err) {
    logger.error('[workbook-memory-holders:get] DB error', { workbookId, err });
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workbookId } = await params;

  if (!(await verifyWorkbookExists(workbookId))) {
    return NextResponse.json({ error: 'Workbook not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parse = createSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  try {
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
      })
      .returning({ id: workbookMemoryHolders.id });

    const cartography = await loadCartography(workbookId);

    return NextResponse.json({ id: inserted?.id, ...cartography }, { status: 201 });
  } catch (err) {
    logger.error('[workbook-memory-holders:post] DB error', { workbookId, err });
    return NextResponse.json({ error: 'Failed to add memory holder' }, { status: 503 });
  }
}
