import { NextResponse, type NextRequest } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pilotApplications, pilotMetrics } from '@/db/schema';
import { withApiAuth, hasMinRole } from '@/lib/api-auth-guard';
import {
  buildPilotReferenceVersionRecord,
  buildProposalPackage,
  normalizeCommercialState,
} from '@/lib/pilot/commercialization-wave1';
import { enforcePilotOwnership } from '@/lib/pilot/pilot-ownership';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

async function buildReferencePayload(id: string) {
  const [application] = await db
    .select()
    .from(pilotApplications)
    .where(and(eq(pilotApplications.id, id)));

  if (!application) return { application: null };

  const [metric] = await db
    .select()
    .from(pilotMetrics)
    .where(eq(pilotMetrics.pilotId, application.id))
    .orderBy(desc(pilotMetrics.lastCalculated))
    .limit(1);

  const responses = (application.responses ?? {}) as Record<string, unknown>;
  const commercialState = normalizeCommercialState(responses.commercialState);

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
      championScore: typeof responses.championScore === 'number' ? responses.championScore : undefined,
      activityScore: typeof responses.activityScore === 'number' ? responses.activityScore : undefined,
    },
  );

  const adoptionRate = metric?.organizerAdoptionRate
    ? Number(metric.organizerAdoptionRate)
    : proposal.signals.adoptionScore;
  const engagementRate = metric?.memberEngagementRate
    ? Number(metric.memberEngagementRate)
    : proposal.signals.activityScore;
  const healthScore = metric?.healthScore ? Number(metric.healthScore) : 100 - proposal.signals.riskScore;
  const casesManaged = metric?.casesManaged ?? 0;
  const daysActive = metric?.daysActive ?? 0;

  const referenceProfile = {
    pilotId: application.id,
    organizationName: application.organizationName,
    opportunityTier: proposal.qualificationScores.opportunityTier,
    deploymentMetrics: {
      daysActive,
      casesManaged,
      adoptionRate,
      engagementRate,
      healthScore,
    },
    testimonial: {
      quote:
        typeof responses.referenceTestimonialQuote === 'string' && responses.referenceTestimonialQuote.trim().length > 0
          ? responses.referenceTestimonialQuote
          : `${application.organizationName} established a repeatable pilot operating cadence with measurable adoption growth.`,
      author:
        typeof responses.referenceTestimonialAuthor === 'string' && responses.referenceTestimonialAuthor.trim().length > 0
          ? responses.referenceTestimonialAuthor
          : application.contactName,
      role:
        typeof responses.referenceTestimonialRole === 'string' && responses.referenceTestimonialRole.trim().length > 0
          ? responses.referenceTestimonialRole
          : 'Pilot Sponsor',
    },
    timeSaved: {
      estimatedHoursPerWeek: Math.max(6, Math.round(adoptionRate * 0.18)),
      methodology: 'Estimated from adoption and activity progression during pilot period.',
    },
    renewalLikelihood: proposal.signals.renewalLikelihood,
    generatedAt: proposal.generatedAt,
  };

  const caseStudy = {
    title: `${application.organizationName}: 90-day pilot outcomes`,
    summary: `${application.organizationName} reached opportunity tier ${proposal.qualificationScores.opportunityTier} with overall score ${proposal.qualificationScores.overallOpportunityScore}.`,
    outcomes: [
      `Adoption rate: ${adoptionRate}`,
      `Engagement rate: ${engagementRate}`,
      `Health score: ${healthScore}`,
      `Renewal likelihood: ${proposal.signals.renewalLikelihood}`,
    ],
    quote: referenceProfile.testimonial.quote,
  };

  const benchmarkDataset = {
    schemaVersion: '1.0',
    generatedAt: proposal.generatedAt,
    record: {
      pilotId: application.id,
      organizationType: application.organizationType,
      memberCount: application.memberCount,
      opportunityTier: proposal.qualificationScores.opportunityTier,
      overallOpportunityScore: proposal.qualificationScores.overallOpportunityScore,
      adoptionRate,
      engagementRate,
      healthScore,
      renewalLikelihood: proposal.signals.renewalLikelihood,
      expansionLikelihood: proposal.signals.expansionLikelihood,
    },
  };

  return {
    application,
    responses,
    referenceProfile,
    caseStudy,
    benchmarkDataset,
  };
}

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

    const payload = await buildReferencePayload(id);
    if (!payload.application) {
      return NextResponse.json({ error: 'Pilot application not found' }, { status: 404 });
    }

    const denied = await enforcePilotOwnership(payload.application);
    if (denied) return denied;

    const persistedVersions = Array.isArray(payload.responses.pilotReferenceVersions)
      ? payload.responses.pilotReferenceVersions
      : [];

    return NextResponse.json({
      data: {
        referenceProfile: payload.referenceProfile,
        caseStudy: payload.caseStudy,
        benchmarkDataset: payload.benchmarkDataset,
        persistedVersions,
        latestVersionId:
          typeof payload.responses.latestPilotReferenceVersionId === 'string'
            ? payload.responses.latestPilotReferenceVersionId
            : null,
      },
    });
  } catch (error) {
    logger.error('pilot_reference_profile:generate_failed', {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Failed to generate reference profile' }, { status: 500 });
  }
});

type PersistReferencePayload = {
  source?: string;
  milestone?: string;
  notes?: string;
};

export const POST = withApiAuth(async (request: NextRequest, context?: { params?: Promise<{ id: string }> | { id: string } }) => {
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

    const requestPayload = (await request.json().catch(() => ({}))) as PersistReferencePayload;
    const payload = await buildReferencePayload(id);
    if (!payload.application) {
      return NextResponse.json({ error: 'Pilot application not found' }, { status: 404 });
    }

    const denied = await enforcePilotOwnership(payload.application);
    if (denied) return denied;

    const snapshot = buildPilotReferenceVersionRecord({
      generatedAt: payload.referenceProfile.generatedAt as string,
      source: requestPayload.source ?? 'manual',
      milestone: requestPayload.milestone,
      notes: requestPayload.notes,
      referenceProfile: payload.referenceProfile,
      caseStudy: payload.caseStudy,
      benchmarkDataset: payload.benchmarkDataset,
    });

    const responses = { ...payload.responses };
    const existingVersions = Array.isArray(responses.pilotReferenceVersions)
      ? [...responses.pilotReferenceVersions]
      : [];

    const existingMatch = existingVersions.find(
      (version) =>
        version &&
        typeof version === 'object' &&
        'checksum' in version &&
        (version as { checksum?: string }).checksum === snapshot.checksum,
    );

    if (existingMatch) {
      return NextResponse.json({
        data: {
          persisted: false,
          reason: 'Reference snapshot already exists for current content',
          snapshot: existingMatch,
        },
      });
    }

    existingVersions.push(snapshot);
    responses.pilotReferenceVersions = existingVersions;
    responses.latestPilotReferenceVersionId = snapshot.versionId;
    responses.latestPilotReferenceChecksum = snapshot.checksum;
    responses.latestPilotReferenceUpdatedAt = payload.referenceProfile.generatedAt;

    await db
      .update(pilotApplications)
      .set({ responses })
      .where(eq(pilotApplications.id, payload.application.id));

    return NextResponse.json({
      data: {
        persisted: true,
        snapshot,
      },
    });
  } catch (error) {
    logger.error('pilot_reference_profile:persist_failed', {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Failed to persist reference profile' }, { status: 500 });
  }
});
