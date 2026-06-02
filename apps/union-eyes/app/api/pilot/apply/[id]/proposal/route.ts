import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pilotApplications } from '@/db/schema';
import { withApiAuth, hasMinRole } from '@/lib/api-auth-guard';
import { buildProposalPackage, normalizeCommercialState } from '@/lib/pilot/commercialization-wave1';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export const GET = withApiAuth(async (_request: NextRequest, context?: { params?: Promise<{ id: string }> | { id: string } }) => {
  try {
    const canAccess = await hasMinRole('steward');
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const rawParams = context?.params ? await context.params : undefined;
    const id = rawParams?.id;

    if (!id) {
      return NextResponse.json({ error: 'Pilot application id is required' }, { status: 400 });
    }

    const [application] = await db
      .select()
      .from(pilotApplications)
      .where(and(eq(pilotApplications.id, id)));

    if (!application) {
      return NextResponse.json({ error: 'Pilot application not found' }, { status: 404 });
    }

    const responses = (application.responses ?? {}) as Record<string, unknown>;
    const commercialState = normalizeCommercialState(responses.commercialState);
    const championScore =
      typeof responses.championScore === 'number' ? responses.championScore : undefined;
    const activityScore =
      typeof responses.activityScore === 'number' ? responses.activityScore : undefined;

    const proposal = buildProposalPackage(
      {
        id: application.id,
        organizationName: application.organizationName,
        organizationType: application.organizationType as 'local' | 'regional' | 'national',
        contactName: application.contactName,
        contactEmail: application.contactEmail,
        memberCount: application.memberCount,
        jurisdictions: application.jurisdictions ?? [],
        sectors: application.sectors ?? [],
        currentSystem: application.currentSystem,
        challenges: application.challenges ?? [],
        goals: application.goals ?? [],
        readinessScore: application.readinessScore,
      },
      {
        commercialState,
        championScore,
        activityScore,
      },
    );

    return NextResponse.json({
      data: proposal,
    });
  } catch (error) {
    logger.error('pilot_proposal:generate_failed', {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Failed to generate proposal package' }, { status: 500 });
  }
});
