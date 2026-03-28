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
import { eq, and, avg, count, desc, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
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
 * Create a satisfaction survey when a claim is resolved/closed
 */
export async function createSatisfactionSurvey(
  data: Pick<NewSatisfactionSurvey, 'organizationId' | 'claimId' | 'memberId' | 'lroId'>
): Promise<SatisfactionSurvey> {
  try {
    // Check if survey already exists for this claim+member
    const existing = await db.query.satisfactionSurveys.findFirst({
      where: and(
        eq(satisfactionSurveys.claimId, data.claimId),
        eq(satisfactionSurveys.memberId, data.memberId)
      ),
    });

    if (existing) {
      logger.info('Satisfaction survey already exists', { claimId: data.claimId });
      return existing;
    }

    const [survey] = await db
      .insert(satisfactionSurveys)
      .values({
        ...data,
        status: 'pending',
        sentAt: new Date(),
      })
      .returning();

    logger.info('Created satisfaction survey', { surveyId: survey.id, claimId: data.claimId });
    return survey;
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
 * Get pending surveys for a member
 */
export async function getPendingSurveys(memberId: string): Promise<SatisfactionSurvey[]> {
  return db
    .select()
    .from(satisfactionSurveys)
    .where(
      and(
        eq(satisfactionSurveys.memberId, memberId),
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
  ratings: SatisfactionRatings
): Promise<SatisfactionSurvey> {
  try {
    // Verify ownership
    const survey = await getSatisfactionSurvey(surveyId);
    if (!survey) throw new Error('Survey not found');
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

    const [updated] = await db
      .update(satisfactionSurveys)
      .set({
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
      })
      .where(eq(satisfactionSurveys.id, surveyId))
      .returning();

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
  memberId: string
): Promise<SatisfactionSurvey> {
  const survey = await getSatisfactionSurvey(surveyId);
  if (!survey) throw new Error('Survey not found');
  if (survey.memberId !== memberId) throw new Error('Not authorized');

  const [updated] = await db
    .update(satisfactionSurveys)
    .set({ status: 'declined', updatedAt: new Date() })
    .where(eq(satisfactionSurveys.id, surveyId))
    .returning();

  return updated;
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
