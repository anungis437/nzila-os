import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pilotApplications } from '@/db/schema';
import { withApiAuth, hasMinRole } from '@/lib/api-auth-guard';
import { enforcePilotOwnership } from '@/lib/pilot/pilot-ownership';
import {
  buildPilotArtifactDiffSummary,
  buildPilotArtifactVersionRecord,
  buildProposalPackage,
  type PilotArtifactVersionRecord,
  normalizeCommercialState,
} from '@/lib/pilot/commercialization-wave1';
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

    const denied = await enforcePilotOwnership(application);
    if (denied) return denied;

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

    const persistedVersions = Array.isArray(responses.pilotArtifactVersions)
      ? responses.pilotArtifactVersions
      : [];
    const typedVersions = persistedVersions.filter(
      (version): version is PilotArtifactVersionRecord =>
        Boolean(version) && typeof version === 'object' && 'versionId' in version && 'artifacts' in version,
    );
    const latestVersion = typedVersions[typedVersions.length - 1] ?? null;
    const previousVersion = typedVersions.length > 1 ? typedVersions[typedVersions.length - 2] : null;
    const latestDiff = latestVersion && previousVersion
      ? buildPilotArtifactDiffSummary(previousVersion, latestVersion)
      : null;

    return NextResponse.json({
      data: {
        generatedAt: proposal.generatedAt,
        qualification: proposal.qualification,
        qualificationScores: proposal.qualificationScores,
        economicsTier: proposal.economicsTier,
        artifacts: proposal.artifacts,
        persistedVersions,
        latestVersion,
        latestDiff,
        latestVersionId:
          typeof responses.latestPilotArtifactVersionId === 'string'
            ? responses.latestPilotArtifactVersionId
            : null,
      },
    });
  } catch (error) {
    logger.error('pilot_artifacts:generate_failed', {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Failed to generate pilot artifacts' }, { status: 500 });
  }
});

type PersistArtifactsPayload = {
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

    const payload = (await request.json().catch(() => ({}))) as PersistArtifactsPayload;

    const [application] = await db
      .select()
      .from(pilotApplications)
      .where(and(eq(pilotApplications.id, id)));

    if (!application) {
      return NextResponse.json({ error: 'Pilot application not found' }, { status: 404 });
    }

    const denied = await enforcePilotOwnership(application);
    if (denied) return denied;

    const responses = { ...((application.responses ?? {}) as Record<string, unknown>) };
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

    const snapshot = buildPilotArtifactVersionRecord({
      generatedAt: proposal.generatedAt,
      source: payload.source ?? 'manual',
      milestone: payload.milestone,
      notes: payload.notes,
      commercialState,
      qualificationScores: proposal.qualificationScores,
      artifacts: proposal.artifacts,
    });

    const existingVersions = Array.isArray(responses.pilotArtifactVersions)
      ? [...responses.pilotArtifactVersions]
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
          reason: 'Artifact snapshot already exists for current content',
          snapshot: existingMatch,
        },
      });
    }

    existingVersions.push(snapshot);
    responses.pilotArtifactVersions = existingVersions;
    responses.latestPilotArtifactVersionId = snapshot.versionId;
    responses.latestPilotArtifactChecksum = snapshot.checksum;
    responses.latestPilotArtifactUpdatedAt = proposal.generatedAt;

    await db
      .update(pilotApplications)
      .set({ responses })
      .where(eq(pilotApplications.id, application.id));

    return NextResponse.json({
      data: {
        persisted: true,
        snapshot,
      },
    });
  } catch (error) {
    logger.error('pilot_artifacts:persist_failed', {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Failed to persist pilot artifacts' }, { status: 500 });
  }
});
