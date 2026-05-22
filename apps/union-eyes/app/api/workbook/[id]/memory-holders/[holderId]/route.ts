/**
 * /api/workbook/[id]/memory-holders/[holderId]
 *
 *   PATCH  \u2014 update an existing memory holder (any subset of fields)
 *   DELETE \u2014 remove a memory holder
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { workbookMemoryHolders } from '@/db/schema/workbook-schema';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

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
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; holderId: string }> },
) {
  const { id: workbookId, holderId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parse = patchSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(parse.data)) {
    if (v !== undefined) patch[k] = v;
  }

  try {
    const result = await db
      .update(workbookMemoryHolders)
      .set(patch)
      .where(
        and(
          eq(workbookMemoryHolders.id, holderId),
          eq(workbookMemoryHolders.workbookId, workbookId),
        ),
      )
      .returning({ id: workbookMemoryHolders.id });

    if (result.length === 0) {
      return NextResponse.json({ error: 'Memory holder not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[workbook-memory-holder:patch] DB error', { workbookId, holderId, err });
    return NextResponse.json({ error: 'Failed to update memory holder' }, { status: 503 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; holderId: string }> },
) {
  const { id: workbookId, holderId } = await params;
  try {
    const result = await db
      .delete(workbookMemoryHolders)
      .where(
        and(
          eq(workbookMemoryHolders.id, holderId),
          eq(workbookMemoryHolders.workbookId, workbookId),
        ),
      )
      .returning({ id: workbookMemoryHolders.id });

    if (result.length === 0) {
      return NextResponse.json({ error: 'Memory holder not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error('[workbook-memory-holder:delete] DB error', { workbookId, holderId, err });
    return NextResponse.json({ error: 'Failed to delete memory holder' }, { status: 503 });
  }
}
