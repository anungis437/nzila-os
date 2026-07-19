import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pilotApplications } from '@/db/schema';
import { withApiAuth, hasMinRole } from '@/lib/api-auth-guard';
import { enforcePilotOwnership } from '@/lib/pilot/pilot-ownership';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type TimelineEvent = {
  at: string;
  type: 'commercial_transition' | 'artifact_version' | 'reference_version' | 'intelligence';
  source: string;
  summary: string;
  data: Record<string, unknown>;
};

function asObject(value: any): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function normalizeAt(value: any): string | null {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
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
    const events: TimelineEvent[] = [];

    const transitions = Array.isArray(responses.commercialTransitionHistory)
      ? responses.commercialTransitionHistory
      : [];
    for (const entry of transitions) {
      const transition = asObject(entry);
      if (!transition) continue;
      const at = normalizeAt(transition.at);
      if (!at) continue;
      const from = typeof transition.from === 'string' ? transition.from : 'unknown';
      const to = typeof transition.to === 'string' ? transition.to : 'unknown';
      events.push({
        at,
        type: 'commercial_transition',
        source: typeof transition.source === 'string' ? transition.source : 'system',
        summary: `Commercial state moved ${from} -> ${to}`,
        data: transition,
      });
    }

    const artifactVersions = Array.isArray(responses.pilotArtifactVersions)
      ? responses.pilotArtifactVersions
      : [];
    for (const entry of artifactVersions) {
      const version = asObject(entry);
      if (!version) continue;
      const at = normalizeAt(version.createdAt);
      if (!at) continue;
      const versionId = typeof version.versionId === 'string' ? version.versionId : 'artifact';
      const milestone = typeof version.milestone === 'string' ? version.milestone : 'unspecified';
      events.push({
        at,
        type: 'artifact_version',
        source: typeof version.source === 'string' ? version.source : 'system',
        summary: `Artifact snapshot ${versionId} (${milestone})`,
        data: version,
      });
    }

    const referenceVersions = Array.isArray(responses.pilotReferenceVersions)
      ? responses.pilotReferenceVersions
      : [];
    for (const entry of referenceVersions) {
      const version = asObject(entry);
      if (!version) continue;
      const at = normalizeAt(version.createdAt);
      if (!at) continue;
      const versionId = typeof version.versionId === 'string' ? version.versionId : 'reference';
      const milestone = typeof version.milestone === 'string' ? version.milestone : 'unspecified';
      events.push({
        at,
        type: 'reference_version',
        source: typeof version.source === 'string' ? version.source : 'system',
        summary: `Reference snapshot ${versionId} (${milestone})`,
        data: version,
      });
    }

    const intelligence = asObject(responses.pilotIntelligence);
    const interactionTimeline = intelligence && Array.isArray(intelligence.interactionTimeline)
      ? intelligence.interactionTimeline
      : [];
    for (const entry of interactionTimeline) {
      const interaction = asObject(entry);
      if (!interaction) continue;
      const at = normalizeAt(interaction.at);
      if (!at) continue;
      const interactionType = typeof interaction.type === 'string' ? interaction.type : 'event';
      events.push({
        at,
        type: 'intelligence',
        source: typeof interaction.source === 'string' ? interaction.source : 'system',
        summary: `Intelligence event: ${interactionType}`,
        data: interaction,
      });
    }

    events.sort((left, right) => Date.parse(right.at) - Date.parse(left.at));

    return NextResponse.json({
      data: {
        pilotId: application.id,
        organizationName: application.organizationName,
        totalEvents: events.length,
        events,
      },
    });
  } catch (error) {
    logger.error('pilot_commercialization_timeline:get_failed', {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Failed to load commercialization timeline' }, { status: 500 });
  }
});
