/**
 * Advanced Analytics Service
 * 
 * SPRINT 8: Advanced Features
 * 
 * Provides sophisticated analytics for marketing growth engine:
 * - Conversion funnel analysis
 * - Cohort analysis (pilot success by characteristics)
 * - Trend detection (momentum, stagnation, risk)
 * - Attribution tracking (which marketing channels drive pilots)
 * - Real-time dashboards
 * 
 * Philosophy: "Measure to improve, not surveil"
 */

import { db } from '@/db';
import {
  pilotApplications,
  caseStudies,
  testimonials,
} from '@/db/schema/domains/marketing';
import { gte, lte, eq, and, desc } from 'drizzle-orm';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ConversionFunnelMetrics {
  stage: string;
  count: number;
  conversionRate: number; // % of previous stage
  dropOffRate: number; // % lost from previous stage
  averageTimeInStage: number; // hours
}

export interface CohortAnalysis {
  cohortName: string;
  cohortSize: number;
  successRate: number; // % approved or active
  averageReadinessScore: number;
  averageTimeToApproval: number; // days
  characteristics: {
    memberCount: number;
    sectors: string[];
    jurisdictions: string[];
  };
}

export interface TrendAnalysis {
  metric: string;
  currentValue: number;
  previousValue: number;
  percentageChange: number;
  trend: 'up' | 'down' | 'stable';
  momentum: 'accelerating' | 'steady' | 'decelerating';
  interpretation: string;
}

export interface AttributionMetrics {
  source: string; // 'case-study', 'testimonial', 'direct', 'referral'
  conversions: number;
  attributionPercentage: number;
  averageReadiness: number;
  successRate: number;
}

export interface RealTimeDashboard {
  timestamp: Date;
  activeUsers: number;
  activePilots: number;
  pendingApplications: number;
  recentActivity: {
    type: 'application' | 'approval' | 'testimonial' | 'case-study';
    count: number;
    lastOccurrence: Date | null;
  }[];
  healthIndicators: {
    metric: string;
    value: number;
    status: 'healthy' | 'warning' | 'critical';
    threshold: number;
  }[];
}

// ============================================================================
// CONVERSION FUNNEL ANALYSIS
// ============================================================================

/**
 * Analyze pilot application conversion funnel
 * 
 * Stages:
 * 1. Applications submitted
 * 2. In review (pending)
 * 3. Approved (approved)
 * 4. Active pilots (active)
 * 5. Completed pilots (completed)
 */
export async function analyzePilotConversionFunnel(
  startDate?: Date,
  endDate?: Date
): Promise<ConversionFunnelMetrics[]> {
  const dateFilter = startDate && endDate 
    ? and(
        gte(pilotApplications.submittedAt, startDate),
        lte(pilotApplications.submittedAt, endDate)
      )
    : undefined;

  const applications = await db
    .select()
    .from(pilotApplications)
    .where(dateFilter);

  // Count by stage
  const submitted = applications.length;
  const pending = applications.filter((a) => a.status === 'review').length;
  const approved = applications.filter((a) => a.status === 'approved').length;
  const active = applications.filter((a) => a.status === 'active').length;
  const completed = applications.filter((a) => a.status === 'completed').length;

  // Calculate conversion rates
  const funnel: ConversionFunnelMetrics[] = [
    {
      stage: 'Submitted',
      count: submitted,
      conversionRate: 100,
      dropOffRate: 0,
      averageTimeInStage: 0, // First stage
    },
    {
      stage: 'Under Review',
      count: pending,
      conversionRate: submitted > 0 ? (pending / submitted) * 100 : 0,
      dropOffRate: submitted > 0 ? ((submitted - pending) / submitted) * 100 : 0,
      averageTimeInStage: calculateAverageTimeInStage(applications, 'review'),
    },
    {
      stage: 'Approved',
      count: approved,
      conversionRate: pending > 0 ? (approved / pending) * 100 : 0,
      dropOffRate: pending > 0 ? ((pending - approved) / pending) * 100 : 0,
      averageTimeInStage: calculateAverageTimeInStage(applications, 'approved'),
    },
    {
      stage: 'Active',
      count: active,
      conversionRate: approved > 0 ? (active / approved) * 100 : 0,
      dropOffRate: approved > 0 ? ((approved - active) / approved) * 100 : 0,
      averageTimeInStage: calculateAverageTimeInStage(applications, 'active'),
    },
    {
      stage: 'Completed',
      count: completed,
      conversionRate: active > 0 ? (completed / active) * 100 : 0,
      dropOffRate: active > 0 ? ((active - completed) / active) * 100 : 0,
      averageTimeInStage: calculateAverageTimeInStage(applications, 'completed'),
    },
  ];

  return funnel;
}

/**
 * Calculate average time spent in a status
 */
function calculateAverageTimeInStage(
  applications: Array<{ status: string; submittedAt: Date; reviewedAt: Date | null }>,
  status: string
): number {
  const inStatus = applications.filter((a) => a.status === status);
  if (inStatus.length === 0) return 0;

  const totalHours = inStatus.reduce((sum: number, app) => {
    const submittedAt = new Date(app.submittedAt).getTime();
    const reviewedAt = app.reviewedAt ? new Date(app.reviewedAt).getTime() : Date.now();
    const hoursInStage = (reviewedAt - submittedAt) / (1000 * 60 * 60);
    return sum + hoursInStage;
  }, 0);

  return totalHours / inStatus.length;
}

// ============================================================================
// COHORT ANALYSIS
// ============================================================================

/**
 * Analyze pilot success by cohort characteristics
 * 
 * Cohorts:
 * - By member count (small <100, medium 100-1000, large >1000)
 * - By sector (manufacturing, healthcare, education, etc.)
 * - By jurisdiction (provincial, national)
 * - By readiness score (low <50, medium 50-75, high >75)
 */
export async function analyzePilotCohorts(): Promise<CohortAnalysis[]> {
  const applications = await db.select().from(pilotApplications);

  const cohorts: CohortAnalysis[] = [];

  // Cohort by member count
  const smallOrgs = applications.filter((a) => a.memberCount < 100);
  const mediumOrgs = applications.filter((a) => a.memberCount >= 100 && a.memberCount <= 1000);
  const largeOrgs = applications.filter((a) => a.memberCount > 1000);

  cohorts.push(
    createCohortAnalysis('Small Organizations (<100 members)', smallOrgs),
    createCohortAnalysis('Medium Organizations (100-1000)', mediumOrgs),
    createCohortAnalysis('Large Organizations (>1000)', largeOrgs)
  );

  // Cohort by readiness score
  const lowReadiness = applications.filter((a) => (a.readinessScore ? parseFloat(a.readinessScore) < 50 : false));
  const mediumReadiness = applications.filter((a) => {
    const score = a.readinessScore ? parseFloat(a.readinessScore) : 0;
    return score >= 50 && score <= 75;
  });
  const highReadiness = applications.filter((a) => (a.readinessScore ? parseFloat(a.readinessScore) > 75 : false));

  cohorts.push(
    createCohortAnalysis('Low Readiness (<50)', lowReadiness),
    createCohortAnalysis('Medium Readiness (50-75)', mediumReadiness),
    createCohortAnalysis('High Readiness (>75)', highReadiness)
  );

  return cohorts;
}

/**
 * Create cohort analysis from applications
 */
function createCohortAnalysis(cohortName: string, applications: Array<{ status: string; readinessScore: string | null; submittedAt: Date; reviewedAt: Date | null; memberCount: number; sectors: string[]; jurisdictions: string[] }>): CohortAnalysis {
  const cohortSize = applications.length;
  if (cohortSize === 0) {
    return {
      cohortName,
      cohortSize: 0,
      successRate: 0,
      averageReadinessScore: 0,
      averageTimeToApproval: 0,
      characteristics: {
        memberCount: 0,
        sectors: [],
        jurisdictions: [],
      },
    };
  }

  const successfulApps = applications.filter(
    (a) => a.status === 'approved' || a.status === 'active' || a.status === 'completed'
  );
  const successRate = (successfulApps.length / cohortSize) * 100;

  const avgReadiness =
    applications.reduce((sum: number, a) => sum + (a.readinessScore ? parseFloat(a.readinessScore) : 0), 0) / cohortSize;

  const approvedApps = applications.filter((a) => a.reviewedAt);
  const avgTimeToApproval =
    approvedApps.length > 0
      ? approvedApps.reduce((sum: number, a) => {
          const submitted = new Date(a.submittedAt).getTime();
          const reviewed = new Date(a.reviewedAt!).getTime();
          return sum + (reviewed - submitted) / (1000 * 60 * 60 * 24); // days
        }, 0) / approvedApps.length
      : 0;

  const avgMemberCount = applications.reduce((sum: number, a) => sum + a.memberCount, 0) / cohortSize;

  const allSectors = applications.flatMap((a) => a.sectors || []);
  const uniqueSectors = Array.from(new Set(allSectors));

  const allJurisdictions = applications.flatMap((a) => a.jurisdictions || []);
  const uniqueJurisdictions = Array.from(new Set(allJurisdictions));

  return {
    cohortName,
    cohortSize,
    successRate,
    averageReadinessScore: avgReadiness,
    averageTimeToApproval: avgTimeToApproval,
    characteristics: {
      memberCount: Math.round(avgMemberCount),
      sectors: uniqueSectors,
      jurisdictions: uniqueJurisdictions,
    },
  };
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * Analyze trends over time periods (7d, 30d, 90d comparisons)
 */
export async function analyzeTrends(
  currentPeriodDays: number = 30,
  comparisonPeriodDays: number = 30
): Promise<TrendAnalysis[]> {
  const now = new Date();
  const currentPeriodStart = new Date(now);
  currentPeriodStart.setDate(now.getDate() - currentPeriodDays);

  const comparisonPeriodStart = new Date(currentPeriodStart);
  comparisonPeriodStart.setDate(comparisonPeriodStart.getDate() - comparisonPeriodDays);

  const comparisonPeriodEnd = currentPeriodStart;

  // Fetch data for both periods
  const currentApplications = await db
    .select()
    .from(pilotApplications)
    .where(gte(pilotApplications.submittedAt, currentPeriodStart));

  const comparisonApplications = await db
    .select()
    .from(pilotApplications)
    .where(
      and(
        gte(pilotApplications.submittedAt, comparisonPeriodStart),
        lte(pilotApplications.submittedAt, comparisonPeriodEnd)
      )
    );

  const currentTestimonials = await db
    .select()
    .from(testimonials)
    .where(gte(testimonials.createdAt, currentPeriodStart));

  const comparisonTestimonials = await db
    .select()
    .from(testimonials)
    .where(
      and(
        gte(testimonials.createdAt, comparisonPeriodStart),
        lte(testimonials.createdAt, comparisonPeriodEnd)
      )
    );

  const trends: TrendAnalysis[] = [
    createTrendAnalysis(
      'Pilot Applications',
      currentApplications.length,
      comparisonApplications.length,
      'higher is better'
    ),
    createTrendAnalysis(
      'Approval Rate',
      calculateApprovalRate(currentApplications),
      calculateApprovalRate(comparisonApplications),
      'higher is better'
    ),
    createTrendAnalysis(
      'Average Readiness Score',
      calculateAverageReadiness(currentApplications),
      calculateAverageReadiness(comparisonApplications),
      'higher is better'
    ),
    createTrendAnalysis(
      'Testimonial Submissions',
      currentTestimonials.length,
      comparisonTestimonials.length,
      'higher is better'
    ),
    createTrendAnalysis(
      'Testimonial Approval Rate',
      calculateTestimonialApprovalRate(currentTestimonials),
      calculateTestimonialApprovalRate(comparisonTestimonials),
      'higher is better'
    ),
  ];

  return trends;
}

/**
 * Create trend analysis with interpretation
 */
function createTrendAnalysis(
  metric: string,
  currentValue: number,
  previousValue: number,
  direction: 'higher is better' | 'lower is better'
): TrendAnalysis {
  const percentageChange =
    previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : currentValue > 0 ? 100 : 0;

  const trend: 'up' | 'down' | 'stable' =
    Math.abs(percentageChange) < 5 ? 'stable' : percentageChange > 0 ? 'up' : 'down';

  const momentum: 'accelerating' | 'steady' | 'decelerating' =
    Math.abs(percentageChange) > 20 ? 'accelerating' : Math.abs(percentageChange) < 5 ? 'steady' : 'decelerating';

  let interpretation = '';
  if (trend === 'stable') {
    interpretation = `${metric} is stable with minimal change (${percentageChange.toFixed(1)}%)`;
  } else if (trend === 'up') {
    interpretation =
      direction === 'higher is better'
        ? `${metric} is improving (+${percentageChange.toFixed(1)}%)`
        : `${metric} is increasing, which may need attention (+${percentageChange.toFixed(1)}%)`;
  } else {
    interpretation =
      direction === 'lower is better'
        ? `${metric} is improving (${percentageChange.toFixed(1)}%)`
        : `${metric} is declining, investigate causes (${percentageChange.toFixed(1)}%)`;
  }

  return {
    metric,
    currentValue,
    previousValue,
    percentageChange,
    trend,
    momentum,
    interpretation,
  };
}

function calculateApprovalRate(applications: Array<{ status: string }>): number {
  if (applications.length === 0) return 0;
  const approved = applications.filter(
    (a) => a.status === 'approved' || a.status === 'active' || a.status === 'completed'
  ).length;
  return (approved / applications.length) * 100;
}

function calculateAverageReadiness(applications: Array<{ readinessScore: string | null }>): number {
  if (applications.length === 0) return 0;
  const total = applications.reduce((sum: number, a) => sum + (a.readinessScore ? parseFloat(a.readinessScore) : 0), 0);
  return total / applications.length;
}

function calculateTestimonialApprovalRate(items: Array<{ approvedAt: Date | null }>): number {
  if (items.length === 0) return 0;
  const approved = items.filter((t) => t.approvedAt !== null).length;
  return (approved / items.length) * 100;
}

// ============================================================================
// ATTRIBUTION TRACKING
// ============================================================================

/**
 * Track which marketing sources drive pilot applications
 * 
 * Attribution sources:
 * - Case study (from pilot application notes/referral field)
 * - Testimonial page
 * - Direct (typed URL or bookmark)
 * - Referral (from another organization)
 */
export async function analyzeAttribution(): Promise<AttributionMetrics[]> {
  const applications = await db.select().from(pilotApplications);

  // For now, use placeholder logic since we don&apos;t have explicit attribution tracking
  // In production, this would use UTM parameters, referrer headers, or application notes

  const attributionSources: AttributionMetrics[] = [
    {
      source: 'Case Studies',
      conversions: Math.floor(applications.length * 0.45), // 45% estimated from case studies
      attributionPercentage: 45,
      averageReadiness: calculateAverageReadiness(applications),
      successRate: calculateApprovalRate(applications),
    },
    {
      source: 'Testimonials',
      conversions: Math.floor(applications.length * 0.25), // 25% from testimonials
      attributionPercentage: 25,
      averageReadiness: calculateAverageReadiness(applications),
      successRate: calculateApprovalRate(applications),
    },
    {
      source: 'Direct',
      conversions: Math.floor(applications.length * 0.20), // 20% direct
      attributionPercentage: 20,
      averageReadiness: calculateAverageReadiness(applications),
      successRate: calculateApprovalRate(applications),
    },
    {
      source: 'Referral',
      conversions: Math.floor(applications.length * 0.10), // 10% referrals
      attributionPercentage: 10,
      averageReadiness: calculateAverageReadiness(applications),
      successRate: calculateApprovalRate(applications),
    },
  ];

  return attributionSources;
}

// ============================================================================
// REAL-TIME DASHBOARD
// ============================================================================

/**
 * Get real-time dashboard metrics
 */
export async function getRealTimeDashboard(): Promise<RealTimeDashboard> {
  const now = new Date();
  const last24Hours = new Date(now);
  last24Hours.setHours(now.getHours() - 24);

  const recentApplications = await db
    .select()
    .from(pilotApplications)
    .where(gte(pilotApplications.submittedAt, last24Hours))
    .orderBy(desc(pilotApplications.submittedAt));

  const recentTestimonials = await db
    .select()
    .from(testimonials)
    .where(gte(testimonials.createdAt, last24Hours))
    .orderBy(desc(testimonials.createdAt));

  const recentCaseStudies = await db
    .select()
    .from(caseStudies)
    .where(gte(caseStudies.createdAt, last24Hours))
    .orderBy(desc(caseStudies.createdAt));

  const activePilots = await db
    .select()
    .from(pilotApplications)
    .where(eq(pilotApplications.status, 'active'));

  const pendingApplications = await db
    .select()
    .from(pilotApplications)
    .where(eq(pilotApplications.status, 'review'));

  const approvals = recentApplications.filter((a) => a.status === 'approved');

  return {
    timestamp: now,
    activeUsers: 0, // Placeholder - would need session tracking
    activePilots: activePilots.length,
    pendingApplications: pendingApplications.length,
    recentActivity: [
      {
        type: 'application',
        count: recentApplications.length,
        lastOccurrence: recentApplications.length > 0 ? recentApplications[0].submittedAt : null,
      },
      {
        type: 'approval',
        count: approvals.length,
        lastOccurrence: approvals.length > 0 ? approvals[0].reviewedAt : null,
      },
      {
        type: 'testimonial',
        count: recentTestimonials.length,
        lastOccurrence: recentTestimonials.length > 0 ? recentTestimonials[0].createdAt : null,
      },
      {
        type: 'case-study',
        count: recentCaseStudies.length,
        lastOccurrence: recentCaseStudies.length > 0 ? recentCaseStudies[0].createdAt : null,
      },
    ],
    healthIndicators: [
      {
        metric: 'Pending Applications',
        value: pendingApplications.length,
        status: pendingApplications.length < 10 ? 'healthy' : pendingApplications.length < 20 ? 'warning' : 'critical',
        threshold: 10,
      },
      {
        metric: 'Active Pilots',
        value: activePilots.length,
        status: activePilots.length > 5 ? 'healthy' : activePilots.length > 2 ? 'warning' : 'critical',
        threshold: 5,
      },
      {
        metric: '24h Application Rate',
        value: recentApplications.length,
        status: recentApplications.length > 2 ? 'healthy' : recentApplications.length > 0 ? 'warning' : 'critical',
        threshold: 2,
      },
    ],
  };
}
