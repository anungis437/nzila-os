/**
 * Engagement Scoring System
 * Calculates and tracks member engagement scores across all communication channels
 * Implements score decay, tier classification, and automated re-engagement triggers
 */

import { db } from '@/db';
import { profiles, smsMessages, newsletterEngagement, surveyResponses, pollVotes, pushDeliveries, organizationMembers } from '@/db/schema';
import { eq, gte, and, sql } from 'drizzle-orm';
import { subDays, subMonths, differenceInDays } from 'date-fns';

// =============================================
// TYPES
// =============================================

export interface EngagementScore {
  profileId: string;
  totalScore: number;
  smsScore: number;
  newsletterScore: number;
  surveyScore: number;
  pollScore: number;
  pushScore: number;
  tier: 'highly-engaged' | 'active' | 'at-risk' | 'dormant';
  lastActivityDate: Date | null;
  daysSinceLastActivity: number;
  trend: 'improving' | 'stable' | 'declining';
  trendPercentage: number;
}

export interface EngagementHistory {
  profileId: string;
  date: Date;
  score: number;
  activities: {
    sms: number;
    newsletter: number;
    survey: number;
    poll: number;
    push: number;
  };
}

export interface ReEngagementTrigger {
  profileId: string;
  memberName: string;
  email: string;
  currentTier: string;
  previousTier: string;
  daysSinceLastActivity: number;
  recommendedAction: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

// =============================================
// CONSTANTS
// =============================================

// Score weights for different activities
const ACTIVITY_WEIGHTS = {
  sms: {
    received: 1,
    replied: 5,
    clicked: 3,
  },
  newsletter: {
    opened: 2,
    clicked: 5,
  },
  survey: {
    started: 3,
    completed: 10,
  },
  poll: {
    voted: 5,
  },
  push: {
    delivered: 1,
    clicked: 4,
  },
};

// Score decay rate (percentage per day)
const DECAY_RATE = 0.02; // 2% per day

// Engagement tier thresholds
const TIER_THRESHOLDS = {
  'highly-engaged': 100,
  'active': 50,
  'at-risk': 20,
  'dormant': 0,
};

// Re-engagement trigger thresholds
const REENGAGEMENT_THRESHOLDS = {
  daysSinceActivity: 14,
  tierDowngrade: true,
  scoreDropPercentage: 30,
};

// =============================================
// CORE FUNCTIONS
// =============================================

/**
 * Calculate engagement score for a single profile
 */
export async function calculateEngagementScore(
  profileId: string,
  organizationId: string,
  lookbackDays = 90
): Promise<EngagementScore> {
  const cutoffDate = subDays(new Date(), lookbackDays);

  // Fetch SMS engagement
  const smsActivity = await db
    .select({
      received: sql<number>`count(*)`,
      replied: sql<number>`count(case when ${smsMessages.direction} = 'inbound' then 1 end)`,
      clicked: sql<number>`0`, // SMS doesn&apos;t track clicks
      lastActivity: sql<Date>`max(${smsMessages.sentAt})`,
    })
    .from(smsMessages)
    .where(
      and(
        eq(smsMessages.organizationId, organizationId),
        eq(smsMessages.userId, profileId),
        gte(smsMessages.sentAt, cutoffDate)
      )
    )
    .then((rows) => rows[0]);

  // Fetch newsletter engagement
  const newsletterActivity = await db
    .select({
      opened: sql<number>`count(case when ${newsletterEngagement.eventType} = 'open' then 1 end)`,
      clicked: sql<number>`count(case when ${newsletterEngagement.eventType} = 'click' then 1 end)`,
      lastActivity: sql<Date>`max(${newsletterEngagement.occurredAt})`,
    })
    .from(newsletterEngagement)
    .where(
      and(
        eq(newsletterEngagement.profileId, profileId),
        gte(newsletterEngagement.occurredAt, cutoffDate)
      )
    )
    .then((rows) => rows[0]);

  // Fetch survey engagement
  const surveyActivity = await db
    .select({
      started: sql<number>`count(distinct ${surveyResponses.surveyId})`,
      completed: sql<number>`count(case when ${surveyResponses.completedAt} is not null then 1 end)`,
      lastActivity: sql<Date>`max(${surveyResponses.startedAt})`,
    })
    .from(surveyResponses)
    .where(
      and(
        eq(surveyResponses.organizationId, organizationId),
        eq(surveyResponses.userId, profileId),
        gte(surveyResponses.startedAt, cutoffDate)
      )
    )
    .then((rows) => rows[0]);

  // Fetch poll engagement
  const pollActivity = await db
    .select({
      voted: sql<number>`count(*)`,
      lastActivity: sql<Date>`max(${pollVotes.votedAt})`,
    })
    .from(pollVotes)
    .where(
      and(
        eq(pollVotes.organizationId, organizationId),
        eq(pollVotes.userId, profileId),
        gte(pollVotes.votedAt, cutoffDate)
      )
    )
    .then((rows) => rows[0]);

  // Fetch push notification engagement
  const pushActivity = await db
    .select({
      delivered: sql<number>`count(case when ${pushDeliveries.status} = 'delivered' then 1 end)`,
      clicked: sql<number>`count(case when ${pushDeliveries.status} = 'clicked' then 1 end)`,
      lastActivity: sql<Date>`max(${pushDeliveries.deliveredAt})`,
    })
    .from(pushDeliveries)
    .where(
      and(
        eq(pushDeliveries.deviceId, profileId), // Assumes device linked to profile
        gte(pushDeliveries.createdAt, cutoffDate)
      )
    )
    .then((rows) => rows[0]);

  // Calculate raw scores
  const smsScore =
    (smsActivity.received || 0) * ACTIVITY_WEIGHTS.sms.received +
    (smsActivity.replied || 0) * ACTIVITY_WEIGHTS.sms.replied +
    (smsActivity.clicked || 0) * ACTIVITY_WEIGHTS.sms.clicked;

  const newsletterScore =
    (newsletterActivity.opened || 0) * ACTIVITY_WEIGHTS.newsletter.opened +
    (newsletterActivity.clicked || 0) * ACTIVITY_WEIGHTS.newsletter.clicked;

  const surveyScore =
    (surveyActivity.started || 0) * ACTIVITY_WEIGHTS.survey.started +
    (surveyActivity.completed || 0) * ACTIVITY_WEIGHTS.survey.completed;

  const pollScore = (pollActivity.voted || 0) * ACTIVITY_WEIGHTS.poll.voted;

  const pushScore =
    (pushActivity.delivered || 0) * ACTIVITY_WEIGHTS.push.delivered +
    (pushActivity.clicked || 0) * ACTIVITY_WEIGHTS.push.clicked;

  // Find most recent activity
  const activityDates = [
    smsActivity.lastActivity,
    newsletterActivity.lastActivity,
    surveyActivity.lastActivity,
    pollActivity.lastActivity,
    pushActivity.lastActivity,
  ].filter((d): d is Date => d !== null);

  const lastActivityDate = activityDates.length > 0 ? new Date(Math.max(...activityDates.map(d => d.getTime()))) : null;
  const daysSinceLastActivity = lastActivityDate ? differenceInDays(new Date(), lastActivityDate) : lookbackDays;

  // Apply decay based on days since last activity
  const decayFactor = Math.pow(1 - DECAY_RATE, daysSinceLastActivity);
  const totalScore = (smsScore + newsletterScore + surveyScore + pollScore + pushScore) * decayFactor;

  // Determine tier
  let tier: EngagementScore['tier'] = 'dormant';
  if (totalScore >= TIER_THRESHOLDS['highly-engaged']) {
    tier = 'highly-engaged';
  } else if (totalScore >= TIER_THRESHOLDS['active']) {
    tier = 'active';
  } else if (totalScore >= TIER_THRESHOLDS['at-risk']) {
    tier = 'at-risk';
  }

  // Calculate trend
  const previousScore = await calculatePreviousScore(profileId, organizationId, lookbackDays);
  let trend: EngagementScore['trend'] = 'stable';
  let trendPercentage = 0;

  if (previousScore > 0) {
    const change = ((totalScore - previousScore) / previousScore) * 100;
    trendPercentage = change;

    if (change > 10) {
      trend = 'improving';
    } else if (change < -10) {
      trend = 'declining';
    }
  }

  return {
    profileId,
    totalScore: Math.round(totalScore),
    smsScore: Math.round(smsScore * decayFactor),
    newsletterScore: Math.round(newsletterScore * decayFactor),
    surveyScore: Math.round(surveyScore * decayFactor),
    pollScore: Math.round(pollScore * decayFactor),
    pushScore: Math.round(pushScore * decayFactor),
    tier,
    lastActivityDate,
    daysSinceLastActivity,
    trend,
    trendPercentage,
  };
}

/**
 * Calculate engagement score for the previous period
 */
async function calculatePreviousScore(
  profileId: string,
  organizationId: string,
  lookbackDays: number
): Promise<number> {
  const previousCutoffStart = subDays(new Date(), lookbackDays * 2);
  const previousCutoffEnd = subDays(new Date(), lookbackDays);

  // Simplified previous score calculation (similar logic as main calculation)
  const smsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(smsMessages)
    .where(
      and(
        eq(smsMessages.organizationId, organizationId),
        eq(smsMessages.userId, profileId),
        gte(smsMessages.sentAt, previousCutoffStart),
        sql`${smsMessages.sentAt} < ${previousCutoffEnd}`
      )
    )
    .then((rows) => rows[0]?.count || 0);

  const newsletterCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(newsletterEngagement)
    .where(
      and(
        eq(newsletterEngagement.profileId, profileId),
        gte(newsletterEngagement.occurredAt, previousCutoffStart),
        sql`${newsletterEngagement.occurredAt} < ${previousCutoffEnd}`
      )
    )
    .then((rows) => rows[0]?.count || 0);

  const surveyCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(surveyResponses)
    .where(
      and(
        eq(surveyResponses.organizationId, organizationId),
        eq(surveyResponses.userId, profileId),
        gte(surveyResponses.startedAt, previousCutoffStart),
        sql`${surveyResponses.startedAt} < ${previousCutoffEnd}`
      )
    )
    .then((rows) => rows[0]?.count || 0);

  const pollCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(pollVotes)
    .where(
      and(
        eq(pollVotes.organizationId, organizationId),
        eq(pollVotes.userId, profileId),
        gte(pollVotes.votedAt, previousCutoffStart),
        sql`${pollVotes.votedAt} < ${previousCutoffEnd}`
      )
    )
    .then((rows) => rows[0]?.count || 0);

  // Simple average score calculation
  return (smsCount * 2 + newsletterCount * 3 + surveyCount * 5 + pollCount * 5) * 1.5;
}

/**
 * Calculate engagement scores for all profiles in a tenant
 */
export async function calculateAllEngagementScores(
  organizationId: string,
  lookbackDays = 90
): Promise<EngagementScore[]> {
  // Get all members for tenant (organization)
  const allProfiles = await db
    .select({ id: organizationMembers.userId })
    .from(organizationMembers)
    .where(eq(organizationMembers.organizationId, organizationId));

  // Calculate scores in parallel
  const scores = await Promise.all(
    allProfiles.map((profile) => calculateEngagementScore(profile.id, organizationId, lookbackDays))
  );

  return scores.sort((a, b) => b.totalScore - a.totalScore);
}

/**
 * Get engagement history for a profile
 */
export async function getEngagementHistory(
  profileId: string,
  organizationId: string,
  months = 6
): Promise<EngagementHistory[]> {
  const history: EngagementHistory[] = [];
  const _startDate = subMonths(new Date(), months);

  // Calculate score for each month
  for (let i = 0; i < months; i++) {
    const monthStart = subMonths(new Date(), months - i);
    const monthEnd = subMonths(new Date(), months - i - 1);

    // Get activity counts for the month
    const smsCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(smsMessages)
      .where(
        and(
          eq(smsMessages.organizationId, organizationId),
          eq(smsMessages.userId, profileId),
          gte(smsMessages.sentAt, monthStart),
          sql`${smsMessages.sentAt} < ${monthEnd}`
        )
      )
      .then((rows) => rows[0]?.count || 0);

    const newsletterCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(newsletterEngagement)
      .where(
        and(
          eq(newsletterEngagement.profileId, profileId),
          gte(newsletterEngagement.occurredAt, monthStart),
          sql`${newsletterEngagement.occurredAt} < ${monthEnd}`
        )
      )
      .then((rows) => rows[0]?.count || 0);

    const surveyCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(surveyResponses)
      .where(
        and(
          eq(surveyResponses.organizationId, organizationId),
          eq(surveyResponses.userId, profileId),
          gte(surveyResponses.startedAt, monthStart),
          sql`${surveyResponses.startedAt} < ${monthEnd}`
        )
      )
      .then((rows) => rows[0]?.count || 0);

    const pollCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(pollVotes)
      .where(
        and(
          eq(pollVotes.organizationId, organizationId),
          eq(pollVotes.userId, profileId),
          gte(pollVotes.votedAt, monthStart),
          sql`${pollVotes.votedAt} < ${monthEnd}`
        )
      )
      .then((rows) => rows[0]?.count || 0);

    const pushCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(pushDeliveries)
      .where(
        and(
          eq(pushDeliveries.deviceId, profileId),
          gte(pushDeliveries.createdAt, monthStart),
          sql`${pushDeliveries.createdAt} < ${monthEnd}`
        )
      )
      .then((rows) => rows[0]?.count || 0);

    const monthScore =
      smsCount * ACTIVITY_WEIGHTS.sms.received +
      newsletterCount * ACTIVITY_WEIGHTS.newsletter.opened +
      surveyCount * ACTIVITY_WEIGHTS.survey.completed +
      pollCount * ACTIVITY_WEIGHTS.poll.voted +
      pushCount * ACTIVITY_WEIGHTS.push.delivered;

    history.push({
      profileId,
      date: monthStart,
      score: Math.round(monthScore),
      activities: {
        sms: smsCount,
        newsletter: newsletterCount,
        survey: surveyCount,
        poll: pollCount,
        push: pushCount,
      },
    });
  }

  return history;
}

/**
 * Identify profiles that need re-engagement
 */
export async function identifyReEngagementTargets(
  organizationId: string
): Promise<ReEngagementTrigger[]> {
  const scores = await calculateAllEngagementScores(organizationId);
  const triggers: ReEngagementTrigger[] = [];

  for (const score of scores) {
    // Get profile details
    // Note: profiles table doesn&apos;t have firstName/lastName fields
    const profile = await db
      .select({
        userId: profiles.userId,
        email: profiles.email,
      })
      .from(profiles)
      .where(eq(profiles.userId, score.profileId))
      .then((rows) => rows[0]);

    if (!profile) continue;

    const memberName = profile.email || 'Unknown Member';

    // Check if member needs re-engagement
    let shouldTrigger = false;
    let recommendedAction = '';
    let priority: ReEngagementTrigger['priority'] = 'low';

    // Tier downgrade trigger
    if (score.tier === 'dormant' && score.trend === 'declining') {
      shouldTrigger = true;
      recommendedAction = 'Send personalized re-engagement campaign';
      priority = 'urgent';
    } else if (score.tier === 'at-risk' && score.daysSinceLastActivity > REENGAGEMENT_THRESHOLDS.daysSinceActivity) {
      shouldTrigger = true;
      recommendedAction = 'Send targeted content based on previous interests';
      priority = 'high';
    } else if (score.tier === 'active' && score.trend === 'declining' && score.trendPercentage < -REENGAGEMENT_THRESHOLDS.scoreDropPercentage) {
      shouldTrigger = true;
      recommendedAction = 'Check in with member and gather feedback';
      priority = 'medium';
    } else if (score.daysSinceLastActivity > REENGAGEMENT_THRESHOLDS.daysSinceActivity * 2) {
      shouldTrigger = true;
      recommendedAction = 'Send survey to understand disengagement reasons';
      priority = 'high';
    }

    if (shouldTrigger) {
      // Determine previous tier
      let previousTier = score.tier;
      if (score.trend === 'declining') {
        const tiers: EngagementScore['tier'][] = ['highly-engaged', 'active', 'at-risk', 'dormant'];
        const currentIndex = tiers.indexOf(score.tier);
        if (currentIndex > 0) {
          previousTier = tiers[currentIndex - 1];
        }
      }

      triggers.push({
        profileId: score.profileId,
        memberName,
        email: profile.email || '',
        currentTier: score.tier,
        previousTier,
        daysSinceLastActivity: score.daysSinceLastActivity,
        recommendedAction,
        priority,
      });
    }
  }

  // Sort by priority
  const priorityOrder: Record<ReEngagementTrigger['priority'], number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
  };

  return triggers.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

/**
 * Get top engaged members
 */
export async function getTopEngagedMembers(
  organizationId: string,
  limit = 50
): Promise<(EngagementScore & { memberName: string; email: string })[]> {
  const scores = await calculateAllEngagementScores(organizationId);

  // Get profile details for top members
  const topScores = scores.slice(0, limit);
  const profileIds = topScores.map((s) => s.profileId);

  const profileDetails = await db
    .select({
      userId: profiles.userId,
      email: profiles.email,
    })
    .from(profiles)
    .where(sql`${profiles.userId} = ANY(${profileIds})`);

  return topScores.map((score) => {
    const profile = profileDetails.find((p) => p.userId === score.profileId);
    return {
      ...score,
      memberName: profile?.email || 'Unknown',
      email: profile?.email || '',
    };
  });
}

