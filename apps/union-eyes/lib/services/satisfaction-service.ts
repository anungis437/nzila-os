/**
 * Satisfaction Service — "Rate My LRO"
 *
 * Handles post-case-closure satisfaction surveys:
 * - Creating surveys when a claim is resolved/closed
 * - Submitting ratings
 * - Aggregating LRO performance metrics
 * - Dashboard analytics
 */

import { db } from '@/db/db';
import { satisfactionSurveys } from '@/db/schema';
import { eq, and, avg, count, desc, sql, inArray } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { RLSTx } from '@/lib/db/with-rls-context';
import type { NewSatisfactionSurvey, SatisfactionSurvey } from '@/db/schema';

// ============================================================================
// Types
// ============================================================================

export interface SatisfactionRatings {
  communicationRating: number;
  responsivenessRating: number;
  knowledgeRating: number;
  advocacyRating: number;
  professionalismRating: number;
  outcomeRating: number;
  feedback?: string;
  wouldRecommend?: boolean;
  isAnonymous?: boolean;
}

export interface LroPerformance {
  lroId: string;
  totalSurveys: number;
  completedSurveys: number;
  avgCommunication: number;
  avgResponsiveness: number;
  avgKnowledge: number;
  avgAdvocacy: number;
  avgProfessionalism: number;
  avgOutcome: number;
  overallAverage: number;
  recommendRate: number;
}

// ============================================================================
// Survey Lifecycle
// ============================================================================

/**
 * Create a satisfaction survey when a claim is resolved/closed.
 * The survey and its audit record commit together. `actorUserId` is the steward creating it by hand;
 * the claim-closure workflow passes none and is recorded as the system.
 */
export async function createSatisfactionSurvey(
  data: Pick<NewSatisfactionSurvey, 'organizationId' | 'claimId' | 'memberId' | 'lroId'>,
  actorUserId?: string
): Promise<SatisfactionSurvey> {
  try {
    return await db.transaction(async (tx) => {
      // Check if survey already exists for this claim+member in this organization
      const existing = await tx.query.satisfactionSurveys.findFirst({
        where: and(
          eq(satisfactionSurveys.organizationId, data.organizationId),
          eq(satisfactionSurveys.claimId, data.claimId),
          eq(satisfactionSurveys.memberId, data.memberId)
        ),
      });

      if (existing) {
        logger.info('Satisfaction survey already exists', { claimId: data.claimId });
        return existing;
      }

      const [survey] = await tx
        .insert(satisfactionSurveys)
        .values({
          ...data,
          status: 'pending',
          sentAt: new Date(),
        })
        .returning();

      await persistAtomicAudit(tx as unknown as RLSTx, {
        organizationId: data.organizationId,
        userId: actorUserId ?? 'system:claim-closure',
        action: 'satisfaction.survey.create',
        resourceType: 'satisfaction_surveys',
        resourceId: survey.id,
        details: { claimId: data.claimId, lroId: data.lroId },
      });

      logger.info('Created satisfaction survey', { surveyId: survey.id, claimId: data.claimId });
      return survey;
    });
  } catch (error) {
    logger.error('Error creating satisfaction survey', { error, data });
    throw new Error('Failed to create satisfaction survey');
  }
}

/**
 * Get a satisfaction survey by ID
 */
export async function getSatisfactionSurvey(id: string): Promise<SatisfactionSurvey | null> {
  const survey = await db.query.satisfactionSurveys.findFirst({
    where: eq(satisfactionSurveys.id, id),
  });
  return survey ?? null;
}

/**
 * A survey belongs to the member it was sent to: it is returned only to that member, within their organization.
 */
export async function getOwnSatisfactionSurvey(
  id: string,
  memberId: string,
  organizationId: string
): Promise<SatisfactionSurvey | null> {
  const survey = await db.query.satisfactionSurveys.findFirst({
    where: and(
      eq(satisfactionSurveys.id, id),
      eq(satisfactionSurveys.memberId, memberId),
      eq(satisfactionSurveys.organizationId, organizationId)
    ),
  });
  return survey ?? null;
}

/**
 * Get pending surveys for a member
 */
export async function getPendingSurveys(memberId: string, organizationId: string): Promise<SatisfactionSurvey[]> {
  return db
    .select()
    .from(satisfactionSurveys)
    .where(
      and(
        eq(satisfactionSurveys.memberId, memberId),
        eq(satisfactionSurveys.organizationId, organizationId),
        eq(satisfactionSurveys.status, 'pending')
      )
    )
    .orderBy(desc(satisfactionSurveys.sentAt));
}

/**
 * Get survey for a specific claim (for the member)
 */
export async function getSurveyForClaim(
  claimId: string,
  memberId: string
): Promise<SatisfactionSurvey | null> {
  const survey = await db.query.satisfactionSurveys.findFirst({
    where: and(
      eq(satisfactionSurveys.claimId, claimId),
      eq(satisfactionSurveys.memberId, memberId)
    ),
  });
  return survey ?? null;
}

/**
 * Submit satisfaction ratings
 */
export async function submitSatisfactionRatings(
  surveyId: string,
  memberId: string,
  ratings: SatisfactionRatings,
  organizationId?: string
): Promise<SatisfactionSurvey> {
  try {
    // Verify ownership
    const survey = await getSatisfactionSurvey(surveyId);
    if (!survey || (organizationId && survey.organizationId !== organizationId)) throw new Error('Survey not found');
    if (survey.memberId !== memberId) throw new Error('Not authorized to submit this survey');
    if (survey.status === 'completed') throw new Error('Survey already completed');

    // Calculate overall score
    const ratingValues = [
      ratings.communicationRating,
      ratings.responsivenessRating,
      ratings.knowledgeRating,
      ratings.advocacyRating,
      ratings.professionalismRating,
      ratings.outcomeRating,
    ];
    const overallScore = (ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length).toFixed(2);

    const updated = await db.transaction(async (tx) => {
      const completionFields = {
          communicationRating: ratings.communicationRating,
          responsivenessRating: ratings.responsivenessRating,
          knowledgeRating: ratings.knowledgeRating,
          advocacyRating: ratings.advocacyRating,
          professionalismRating: ratings.professionalismRating,
          outcomeRating: ratings.outcomeRating,
          overallScore,
          feedback: ratings.feedback,
          wouldRecommend: ratings.wouldRecommend,
          isAnonymous: ratings.isAnonymous ?? false,
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        };
      const [row] = await tx
        .update(satisfactionSurveys)
        .set(completionFields)
        .where(
          and(
            eq(satisfactionSurveys.id, surveyId),
            eq(satisfactionSurveys.memberId, memberId),
            eq(satisfactionSurveys.organizationId, survey.organizationId),
            inArray(satisfactionSurveys.status, ['pending', 'sent'])
          )
        )
        .returning();
      if (!row) throw new Error('Survey already completed');

      // The record names the survey and its outcome, not the ratings or the free text.
      await persistAtomicAudit(tx as unknown as RLSTx, {
        organizationId: survey.organizationId,
        userId: memberId,
        action: 'satisfaction.survey.submit',
        resourceType: 'satisfaction_surveys',
        resourceId: surveyId,
        details: { claimId: survey.claimId },
      });
      return row;
    });

    logger.info('Satisfaction survey completed', { surveyId, overallScore });
    return updated;
  } catch (error) {
    logger.error('Error submitting satisfaction ratings', { error, surveyId });
    throw error;
  }
}

/**
 * Decline a satisfaction survey
 */
export async function declineSurvey(
  surveyId: string,
  memberId: string,
  organizationId?: string
): Promise<SatisfactionSurvey> {
  const survey = await getSatisfactionSurvey(surveyId);
  if (!survey || (organizationId && survey.organizationId !== organizationId)) throw new Error('Survey not found');
  if (survey.memberId !== memberId) throw new Error('Not authorized');

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(satisfactionSurveys)
      .set({ status: 'declined', updatedAt: new Date() })
      .where(
        and(
          eq(satisfactionSurveys.id, surveyId),
          eq(satisfactionSurveys.memberId, memberId),
          eq(satisfactionSurveys.organizationId, survey.organizationId),
          inArray(satisfactionSurveys.status, ['pending', 'sent'])
        )
      )
      .returning();
    if (!updated) throw new Error('Survey can no longer be declined');

    await persistAtomicAudit(tx as unknown as RLSTx, {
      organizationId: survey.organizationId,
      userId: memberId,
      action: 'satisfaction.survey.decline',
      resourceType: 'satisfaction_surveys',
      resourceId: surveyId,
      details: { claimId: survey.claimId },
    });
    return updated;
  });
}

// ============================================================================
// LRO Performance Analytics
// ============================================================================

/**
 * Get LRO performance metrics (aggregated ratings)
 */
export async function getLroPerformance(
  lroId: string,
  organizationId?: string
): Promise<LroPerformance> {
  try {
    const conditions = [
      eq(satisfactionSurveys.lroId, lroId),
      eq(satisfactionSurveys.status, 'completed'),
    ];
    if (organizationId) {
      conditions.push(eq(satisfactionSurveys.organizationId, organizationId));
    }

    const [metrics] = await db
      .select({
        totalSurveys: count(),
        avgCommunication: avg(satisfactionSurveys.communicationRating),
        avgResponsiveness: avg(satisfactionSurveys.responsivenessRating),
        avgKnowledge: avg(satisfactionSurveys.knowledgeRating),
        avgAdvocacy: avg(satisfactionSurveys.advocacyRating),
        avgProfessionalism: avg(satisfactionSurveys.professionalismRating),
        avgOutcome: avg(satisfactionSurveys.outcomeRating),
      })
      .from(satisfactionSurveys)
      .where(and(...conditions));

    // Get recommend rate
    const [recommendMetrics] = await db
      .select({
        total: count(),
        recommended: sql<number>`COUNT(*) FILTER (WHERE ${satisfactionSurveys.wouldRecommend} = true)`,
      })
      .from(satisfactionSurveys)
      .where(and(...conditions, sql`${satisfactionSurveys.wouldRecommend} IS NOT NULL`));

    const n = (v: string | null) => parseFloat(v ?? '0');

    const avgValues = [
      n(metrics.avgCommunication),
      n(metrics.avgResponsiveness),
      n(metrics.avgKnowledge),
      n(metrics.avgAdvocacy),
      n(metrics.avgProfessionalism),
      n(metrics.avgOutcome),
    ];
    const overallAverage = avgValues.reduce((a, b) => a + b, 0) / (avgValues.length || 1);

    return {
      lroId,
      totalSurveys: metrics.totalSurveys,
      completedSurveys: metrics.totalSurveys,
      avgCommunication: n(metrics.avgCommunication),
      avgResponsiveness: n(metrics.avgResponsiveness),
      avgKnowledge: n(metrics.avgKnowledge),
      avgAdvocacy: n(metrics.avgAdvocacy),
      avgProfessionalism: n(metrics.avgProfessionalism),
      avgOutcome: n(metrics.avgOutcome),
      overallAverage: parseFloat(overallAverage.toFixed(2)),
      recommendRate: recommendMetrics.total > 0
        ? parseFloat(((recommendMetrics.recommended / recommendMetrics.total) * 100).toFixed(1))
        : 0,
    };
  } catch (error) {
    logger.error('Error getting LRO performance', { error, lroId });
    throw new Error('Failed to get LRO performance');
  }
}

/**
 * Get all LRO performance rankings for an organization
 */
export async function getOrganizationLroRankings(
  organizationId: string
): Promise<LroPerformance[]> {
  try {
    const lros = await db
      .selectDistinct({ lroId: satisfactionSurveys.lroId })
      .from(satisfactionSurveys)
      .where(
        and(
          eq(satisfactionSurveys.organizationId, organizationId),
          eq(satisfactionSurveys.status, 'completed')
        )
      );

    const performances = await Promise.all(
      lros.map(({ lroId }) => getLroPerformance(lroId, organizationId))
    );

    // Sort by overall average descending
    performances.sort((a, b) => b.overallAverage - a.overallAverage);

    return performances;
  } catch (error) {
    logger.error('Error getting organization LRO rankings', { error, organizationId });
    throw new Error('Failed to get LRO rankings');
  }
}
