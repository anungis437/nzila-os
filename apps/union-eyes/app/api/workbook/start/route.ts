/**
 * POST /api/workbook/start \u2014 Create a pseudonymous Governance Entropy Workbook.
 *
 * No authentication required (public pseudonymous intake, rate limited and body capped). Returns the new workbookId so the caller
 * can route into the workbook flow. Locale and UTM are accepted from the
 * body to preserve attribution and EN/FR posture from the landing page.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { workbooks, workbookModules, WORKBOOK_MODULE_IDS } from '@/db/schema/workbook-schema';
import { logger } from '@/lib/logger';
import { guardPublicIntake } from '@/lib/public-intake/guard';
import { opaqueRef } from '@/lib/icra/opaque-ref';
import { issueWorkbookCapability, setWorkbookCapabilityCookie } from '@/lib/workbook/workbook-capability';

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
  // Public pseudonymous intake: bounded by a per-client limit and a body cap. The workbook it creates holds no
  // tenant data and grants no access to any; it is a bearer-id record until claimed by an authenticated user.
  const intake = await guardPublicIntake(request, { bucket: 'write', challenge: true });
  if (!intake.ok) return intake.response;

  const parse = bodySchema.safeParse(intake.json ?? {});
  if (!parse.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parse.error.flatten().fieldErrors },
      { status: 422 },
    );
  }

  const { locale, consent, sectorBand, institutionSizeBand, utm } = parse.data;
  // The workbook id is public (page URLs, checkout redirects); this capability, returned once, is what reaches the workbook's data.
  const capability = issueWorkbookCapability();

  try {
    // The workbook and its module rows are one record: a failure seeding the modules must not leave a bare workbook.
    const wb = await withSystemContext(async (tx) => {
      const [created] = await tx
        .insert(workbooks)
        .values({
          locale,
          consent: consent ?? null,
          sectorBand: sectorBand ?? null,
          institutionSizeBand: institutionSizeBand ?? null,
          utmSource: utm?.source ?? null,
          utmMedium: utm?.medium ?? null,
          utmCampaign: utm?.campaign ?? null,
          capabilityTokenHash: capability.tokenHash,
          capabilityTokenExpiresAt: capability.expiresAt,
        })
        .returning({ id: workbooks.id });

      if (!created) return null;

      // Seed module status rows so the workbook hub renders deterministically.
      await tx
        .insert(workbookModules)
        .values(
          WORKBOOK_MODULE_IDS.map((moduleId) => ({
            workbookId: created.id,
            moduleId,
            status: 'not_started',
          })),
        )
        .onConflictDoNothing();

      return created;
    });

    if (!wb) {
      return NextResponse.json({ error: 'Failed to create workbook' }, { status: 500 });
    }
    logger.info('[workbook-start] Workbook created', { workbookRef: opaqueRef(wb.id), locale });

    const response = NextResponse.json({ workbookId: wb.id, capabilityToken: capability.token, capabilityExpiresAt: capability.expiresAt.toISOString() });
    setWorkbookCapabilityCookie(response, wb.id, capability.token);
    return response;
  } catch (err) {
    logger.error('[workbook-start] DB error', { err });
    return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
  }
}
