/**
 * POST /api/workbook/start \u2014 Create a pseudonymous Governance Entropy Workbook.
 *
 * No authentication required. Returns the new workbookId so the caller
 * can route into the workbook flow. Locale and UTM are accepted from the
 * body to preserve attribution and EN/FR posture from the landing page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/db';
import { workbooks, workbookModules, WORKBOOK_MODULE_IDS } from '@/db/schema/workbook-schema';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bodySchema = z.object({
  locale: z.string().min(2).max(16).default('en-CA'),
  consent: z
    .object({
      consentToPersist: z.boolean(),
      consentToPersistAt: z.string().datetime().optional(),
    })
    .optional(),
  sectorBand: z.string().max(64).nullable().optional(),
  institutionSizeBand: z.string().max(64).nullable().optional(),
  utm: z
    .object({
      source: z.string().max(128).nullable().optional(),
      medium: z.string().max(128).nullable().optional(),
      campaign: z.string().max(128).nullable().optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    if (request.headers.get('content-length') && Number(request.headers.get('content-length')) > 0) {
      body = await request.json();
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parse = bodySchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { locale, consent, sectorBand, institutionSizeBand, utm } = parse.data;

  try {
    const [wb] = await db
      .insert(workbooks)
      .values({
        locale,
        consent: consent ?? null,
        sectorBand: sectorBand ?? null,
        institutionSizeBand: institutionSizeBand ?? null,
        utmSource: utm?.source ?? null,
        utmMedium: utm?.medium ?? null,
        utmCampaign: utm?.campaign ?? null,
      })
      .returning({ id: workbooks.id });

    if (!wb) {
      return NextResponse.json({ error: 'Failed to create workbook' }, { status: 500 });
    }

    // Seed module status rows so the workbook hub renders deterministically.
    await db
      .insert(workbookModules)
      .values(
        WORKBOOK_MODULE_IDS.map((moduleId) => ({
          workbookId: wb.id,
          moduleId,
          status: 'not_started',
        })),
      )
      .onConflictDoNothing();

    logger.info('[workbook-start] Workbook created', { workbookId: wb.id, locale });

    return NextResponse.json({ workbookId: wb.id });
  } catch (err) {
    logger.error('[workbook-start] DB error', { err });
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
}
