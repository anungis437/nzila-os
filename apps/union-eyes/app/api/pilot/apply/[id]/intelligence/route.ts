import { NextResponse, type NextRequest } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { pilotApplications } from '@/db/schema';
import { withApiAuth, hasMinRole } from '@/lib/api-auth-guard';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

type IntelligencePayload = {
  lessonLearned?: string;
  objectionRaised?: string;
  requestedFeature?: string;
  deploymentBlocker?: string;
  stakeholderSentiment?: {
    stakeholder?: string;
    sentiment?: 'negative' | 'neutral' | 'positive';
    note?: string;
  };
  source?: string;
};

function toStringArray(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
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

    const responses = (application.responses ?? {}) as Record<string, unknown>;
    const intelligence =
      typeof responses.pilotIntelligence === 'object' && responses.pilotIntelligence
        ? (responses.pilotIntelligence as Record<string, unknown>)
        : {};

    const lessonsLearned = toStringArray(intelligence.lessonsLearned);
    const objectionsRaised = toStringArray(intelligence.objectionsRaised);
    const requestedFeatures = toStringArray(intelligence.requestedFeatures);
    const deploymentBlockers = toStringArray(intelligence.deploymentBlockers);
    const stakeholderSentiment = Array.isArray(intelligence.stakeholderSentiment)
      ? intelligence.stakeholderSentiment
      : [];

    return NextResponse.json({
      data: {
        lessonsLearned,
        objectionsRaised,
        requestedFeatures,
        deploymentBlockers,
        stakeholderSentiment,
        counts: {
          lessonsLearned: lessonsLearned.length,
          objectionsRaised: objectionsRaised.length,
          requestedFeatures: requestedFeatures.length,
          deploymentBlockers: deploymentBlockers.length,
          stakeholderSentiment: stakeholderSentiment.length,
        },
      },
    });
  } catch (error) {
    logger.error('pilot_intelligence:get_failed', {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Failed to load pilot intelligence' }, { status: 500 });
  }
});

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

    const payload = (await request.json().catch(() => ({}))) as IntelligencePayload;

    const [application] = await db
      .select()
      .from(pilotApplications)
      .where(and(eq(pilotApplications.id, id)));

    if (!application) {
      return NextResponse.json({ error: 'Pilot application not found' }, { status: 404 });
    }

    const responses = { ...((application.responses ?? {}) as Record<string, unknown>) };
    const intelligence =
      typeof responses.pilotIntelligence === 'object' && responses.pilotIntelligence
        ? ({ ...(responses.pilotIntelligence as Record<string, unknown>) } as Record<string, unknown>)
        : {};

    const lessonsLearned = toStringArray(intelligence.lessonsLearned);
    const objectionsRaised = toStringArray(intelligence.objectionsRaised);
    const requestedFeatures = toStringArray(intelligence.requestedFeatures);
    const deploymentBlockers = toStringArray(intelligence.deploymentBlockers);
    const stakeholderSentiment = Array.isArray(intelligence.stakeholderSentiment)
      ? [...intelligence.stakeholderSentiment]
      : [];
    const interactionTimeline = Array.isArray(intelligence.interactionTimeline)
      ? [...intelligence.interactionTimeline]
      : [];

    const nowIso = new Date().toISOString();

    if (payload.lessonLearned && payload.lessonLearned.trim().length > 0) {
      lessonsLearned.push(payload.lessonLearned.trim());
      interactionTimeline.push({ at: nowIso, type: 'lesson_learned', value: payload.lessonLearned.trim(), source: payload.source ?? 'api' });
    }

    if (payload.objectionRaised && payload.objectionRaised.trim().length > 0) {
      objectionsRaised.push(payload.objectionRaised.trim());
      interactionTimeline.push({ at: nowIso, type: 'objection_raised', value: payload.objectionRaised.trim(), source: payload.source ?? 'api' });
    }

    if (payload.requestedFeature && payload.requestedFeature.trim().length > 0) {
      requestedFeatures.push(payload.requestedFeature.trim());
      interactionTimeline.push({ at: nowIso, type: 'requested_feature', value: payload.requestedFeature.trim(), source: payload.source ?? 'api' });
    }

    if (payload.deploymentBlocker && payload.deploymentBlocker.trim().length > 0) {
      deploymentBlockers.push(payload.deploymentBlocker.trim());
      interactionTimeline.push({ at: nowIso, type: 'deployment_blocker', value: payload.deploymentBlocker.trim(), source: payload.source ?? 'api' });
    }

    if (payload.stakeholderSentiment) {
      const sentimentRecord = {
        at: nowIso,
        stakeholder: payload.stakeholderSentiment.stakeholder ?? 'unspecified',
        sentiment: payload.stakeholderSentiment.sentiment ?? 'neutral',
        note: payload.stakeholderSentiment.note ?? '',
        source: payload.source ?? 'api',
      };
      stakeholderSentiment.push(sentimentRecord);
      interactionTimeline.push({ at: nowIso, type: 'stakeholder_sentiment', value: sentimentRecord });
    }

    intelligence.lessonsLearned = lessonsLearned;
    intelligence.objectionsRaised = objectionsRaised;
    intelligence.requestedFeatures = requestedFeatures;
    intelligence.deploymentBlockers = deploymentBlockers;
    intelligence.stakeholderSentiment = stakeholderSentiment;
    intelligence.interactionTimeline = interactionTimeline;
    intelligence.updatedAt = nowIso;

    responses.pilotIntelligence = intelligence;

    await db
      .update(pilotApplications)
      .set({ responses })
      .where(eq(pilotApplications.id, application.id));

    return NextResponse.json({
      data: {
        id: application.id,
        pilotIntelligence: intelligence,
      },
    });
  } catch (error) {
    logger.error('pilot_intelligence:update_failed', {
      error: (error as Error).message,
    });
    return NextResponse.json({ error: 'Failed to update pilot intelligence' }, { status: 500 });
  }
});
