/**
 * ARTIFACT TYPE: API Route
 * DOCTRINE_VERSION: 1.0.0
 *
 * GET /api/icra/results/[id]
 *
 * Returns the InstitutionalContinuityProfile JSON for an assessment.
 * Pseudonymous access via unguessable UUID. Rate-limited.
 */

import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { icraMaturityProfiles } from '@/db/schema/icra-schema';
import type { OrganizationalContinuityProfile } from '@/lib/icra/types';
import { rateLimit } from '@/lib/rate-limit';
import { logger } from '@/lib/logger';

interface Params {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params;

  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid assessment ID.' }, { status: 400 });
  }

  const rl = rateLimit(req, { maxRequests: 20, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: 'Rate limit exceeded.' }, { status: 429 });
  }

  try {
    const rows = await db
      .select({ profilePayload: icraMaturityProfiles.profilePayload })
      .from(icraMaturityProfiles)
      .where(eq(icraMaturityProfiles.assessmentId, id))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    }

    const profile = row.profilePayload as OrganizationalContinuityProfile;
    return NextResponse.json(profile, { status: 200 });
  } catch (err) {
    logger.error('icra.results.fetch_failed', { id, error: (err as Error).message });
    return NextResponse.json({ error: 'Failed to fetch results.' }, { status: 500 });
  }
}
