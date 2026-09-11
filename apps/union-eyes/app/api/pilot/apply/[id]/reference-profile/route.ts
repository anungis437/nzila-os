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
import { withLockedPilotMutation } from '@/lib/pilot/pilot-mutation';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type PilotApplicationRow = typeof pilotApplications.$inferSelect;
type PilotMetricRow = typeof pilotMetrics.$inferSelect;

/**
 * Pure computation from an already-loaded application + metric row — no DB
 * access (PR #752 round 25). Split out of the old `buildReferencePayload`
 * so POST can run it against a `FOR UPDATE`-LOCKED, freshly re-authorized
 * `application` (from `withLockedPilotMutation`) instead of the unlocked
 * snapshot GET uses, without duplicating this entire computation.
 */
function computeReferenceProfileData(application: PilotApplicationRow, metric: PilotMetricRow | undefined) {
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
    responses,
    referenceProfile,
    caseStudy,
    benchmarkDataset,
  };
}

/** Standalone, read-only latest-metric lookup — not part of the `responses` race POST protects. */
async function loadLatestPilotMetric(pilotId: string): Promise<PilotMetricRow | undefined> {
  return withSystemContext(async (_tx) => {
    const [m] = await db
      .select()
      .from(pilotMetrics)
      .where(eq(pilotMetrics.pilotId, pilotId))
      .orderBy(desc(pilotMetrics.lastCalculated))
      .limit(1);
    return m;
  });
}

async function buildReferencePayload(id: string) {
  // Runs before the ownership decision (below, in each handler) can be made,
  // so it must see the row regardless of the caller's own organization —
  // must run under withSystemContext (PR #752 round 18), never the ordinary
  // tenant runtime connection.
  const [application, metric] = await withSystemContext(async (_tx) => {
    const [app] = await db
      .select()
      .from(pilotApplications)
      .where(and(eq(pilotApplications.id, id)));

    if (!app) return [undefined, undefined] as const;

    const [m] = await db
      .select()
      .from(pilotMetrics)
      .where(eq(pilotMetrics.pilotId, app.id))
      .orderBy(desc(pilotMetrics.lastCalculated))
      .limit(1);

    return [app, m] as const;
  });

  if (!application) return { application: null };

  return { application, ...computeReferenceProfileData(application, metric) };
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
    const rawParams = context?.params ? await context.params : undefined;
    const id = rawParams?.id;
    if (!id) {
      return NextResponse.json({ error: 'Pilot application id is required' }, { status: 400 });
    }

    const requestPayload = (await request.json().catch(() => ({}))) as PersistReferencePayload;
    // Read-only, unrelated table — fetched BEFORE the lock, never nested
    // inside withLockedPilotMutation's own transaction (which would grab a
    // second connection from the pool while still holding the first).
    const metric = await loadLatestPilotMetric(id);

    // PR #752 round 25: locked, re-authorized, key-specific merge — this
    // write only ever touches the 4 reference-version fields, never the
    // whole `responses` column.
    const outcome = await withLockedPilotMutation<{ persisted: boolean; reason?: string; snapshot: unknown }>(id, 'steward', async ({ application }) => {
      const computed = computeReferenceProfileData(application, metric);

      const snapshot = buildPilotReferenceVersionRecord({
        generatedAt: computed.referenceProfile.generatedAt as string,
        source: requestPayload.source ?? 'manual',
        milestone: requestPayload.milestone,
        notes: requestPayload.notes,
        referenceProfile: computed.referenceProfile,
        caseStudy: computed.caseStudy,
        benchmarkDataset: computed.benchmarkDataset,
      });

      const existingVersions = Array.isArray(computed.responses.pilotReferenceVersions)
        ? [...computed.responses.pilotReferenceVersions]
        : [];

      const existingMatch = existingVersions.find(
        (version) =>
          version &&
          typeof version === 'object' &&
          'checksum' in version &&
          (version as { checksum?: string }).checksum === snapshot.checksum,
      );

      if (existingMatch) {
        return {
          data: {
            persisted: false,
            reason: 'Reference snapshot already exists for current content',
            snapshot: existingMatch,
          },
        };
      }

      existingVersions.push(snapshot);

      return {
        responsesPatch: {
          pilotReferenceVersions: existingVersions,
          latestPilotReferenceVersionId: snapshot.versionId,
          latestPilotReferenceChecksum: snapshot.checksum,
          latestPilotReferenceUpdatedAt: computed.referenceProfile.generatedAt,
        },
        data: {
          persisted: true,
          snapshot,
        },
      };
    });

    if (!outcome.ok) return outcome.response;

    return NextResponse.json({ data: outcome.data });
  } catch (error) {
    logger.error('pilot_reference_profile:persist_failed', {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Failed to persist reference profile' }, { status: 500 });
  }
});
