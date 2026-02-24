/**
 * Pilot Health Scoring Service
 * 
 * Purpose: Calculate pilot program health scores based on adoption, engagement, and effectiveness
 * Philosophy: Measure system success, not individual performance
 */

import { PilotMetrics, PilotHealthScoreBreakdown, PilotMilestone } from '@/types/marketing';

/**
 * Calculate overall pilot health score (0-100)
 * 
 * Weighted algorithm:
 * - Organizer adoption: 30% (critical for success)
 * - Member engagement: 25% (key indicator)
 * - Usage (cases managed): 15% (system utilization)
 * - Effectiveness (resolution time): 20% (tangible improvement)
 * - Progress (milestones): 10% (implementation maturity)
 */
export function calculatePilotHealth(metrics: PilotMetrics): number {
  const breakdown = calculatePilotHealthBreakdown(metrics);
  return breakdown.overall;
}

/**
 * Calculate detailed health score breakdown for transparency
 */
export function calculatePilotHealthBreakdown(
  metrics: PilotMetrics
): PilotHealthScoreBreakdown {
  const weights = {
    adoption: 0.30,
    engagement: 0.25,
    usage: 0.15,
    effectiveness: 0.20,
    progress: 0.10,
  };

  // Adoption score: target 80% of organizers active
  const adoptionScore = Math.min((metrics.organizerAdoptionRate / 80) * 100, 100);

  // Engagement score: target 40% of members engaged
  const engagementScore = Math.min((metrics.memberEngagementRate / 40) * 100, 100);

  // Usage score: target 50 cases managed per month
  // Normalize by days active
  const monthlyPaceTarget = 50;
  const monthlyPace = (metrics.casesManaged / metrics.daysActive) * 30;
  const usageScore = Math.min((monthlyPace / monthlyPaceTarget) * 100, 100);

  // Effectiveness score: target < 30 days to resolution
  // Lower is better, so inverse calculation
  const targetResolutionDays = 30;
  const resolutionDays = Number(metrics.avgTimeToResolution) / 24; // Convert hours to days
  const effectivenessScore = resolutionDays <= targetResolutionDays
    ? 100
    : Math.max(0, 100 - ((resolutionDays - targetResolutionDays) / targetResolutionDays) * 100);

  // Progress score: milestone completion rate
  const completedMilestones = metrics.milestones.filter(m => m.status === 'complete').length;
  const progressScore = (completedMilestones / metrics.milestones.length) * 100;

  // Calculate weighted overall score
  const overall = Math.round(
    adoptionScore * weights.adoption +
    engagementScore * weights.engagement +
    usageScore * weights.usage +
    effectivenessScore * weights.effectiveness +
    progressScore * weights.progress
  );

  return {
    overall,
    adoption: Math.round(adoptionScore),
    engagement: Math.round(engagementScore),
    usage: Math.round(usageScore),
    effectiveness: Math.round(effectivenessScore),
    progress: Math.round(progressScore),
  };
}

/**
 * Get health score status and interpretation
 */
export function getHealthScoreStatus(score: number): {
  status: 'excellent' | 'good' | 'needs-attention' | 'critical';
  label: string;
  description: string;
  recommendations: string[];
} {
  if (score >= 85) {
    return {
      status: 'excellent',
      label: 'Excellent',
      description: 'Pilot is thriving. Strong adoption and engagement across the board.',
      recommendations: [
        'Document success factors for other pilots',
        'Consider expanding to additional departments',
        'Identify organizer champions for peer mentoring',
      ],
    };
  }

  if (score >= 70) {
    return {
      status: 'good',
      label: 'Good',
      description: 'Pilot is on track. Most metrics are healthy with room for improvement.',
      recommendations: [
        'Focus on lagging metrics',
        'Increase organizer training sessions',
        'Gather feedback from less-engaged users',
      ],
    };
  }

  if (score >= 50) {
    return {
      status: 'needs-attention',
      label: 'Needs Attention',
      description: 'Pilot needs support. Some critical metrics are below target.',
      recommendations: [
        'Schedule check-in with union leadership',
        'Identify and address blockers',
        'Provide additional training resources',
        'Consider adjusting timeline or scope',
      ],
    };
  }

  return {
    status: 'critical',
    label: 'Critical',
    description: 'Pilot requires immediate intervention. Multiple metrics significantly below target.',
    recommendations: [
      'Immediate leadership escalation required',
      'Conduct root cause analysis',
      'Assess if pilot should be paused for realignment',
      'Provide intensive support and training',
    ],
  };
}

/**
 * Calculate milestone health (on-track, at-risk, blocked)
 */
export function calculateMilestoneHealth(milestones: PilotMilestone[]): {
  onTrack: number;
  atRisk: number;
  blocked: number;
  completed: number;
} {
  const now = new Date();

  return milestones.reduce(
    (acc, milestone) => {
      if (milestone.status === 'complete') {
        acc.completed++;
      } else if (milestone.status === 'blocked') {
        acc.blocked++;
      } else if (milestone.targetDate && new Date(milestone.targetDate) < now) {
        acc.atRisk++; // Past target date but not complete
      } else {
        acc.onTrack++;
      }
      return acc;
    },
    { onTrack: 0, atRisk: 0, blocked: 0, completed: 0 }
  );
}

/**
 * Predict pilot success likelihood based on early metrics
 * Use this after 30 days to forecast final outcome
 */
export function predictPilotSuccess(metrics: PilotMetrics): {
  likelihood: 'very-likely' | 'likely' | 'uncertain' | 'unlikely';
  confidence: number; // 0-100
  reasoning: string;
} {
  if (metrics.daysActive < 30) {
    return {
      likelihood: 'uncertain',
      confidence: 30,
      reasoning: 'Insufficient data (< 30 days). Early trends suggest wait for more data.',
    };
  }

  const _healthScore = calculatePilotHealth(metrics);
  const breakdown = calculatePilotHealthBreakdown(metrics);

  // Critical success factors
  const hasStrongAdoption = breakdown.adoption >= 70;
  const hasEngagement = breakdown.engagement >= 60;
  const showsEffectiveness = breakdown.effectiveness >= 60;

  if (hasStrongAdoption && hasEngagement && showsEffectiveness) {
    return {
      likelihood: 'very-likely',
      confidence: 85,
      reasoning: 'Strong adoption, engagement, and proven effectiveness. Pilot is on track for success.',
    };
  }

  if (hasStrongAdoption || (hasEngagement && showsEffectiveness)) {
    return {
      likelihood: 'likely',
      confidence: 70,
      reasoning: 'Key success indicators are positive. Some areas need improvement but trajectory is good.',
    };
  }

  if (breakdown.adoption < 40 || breakdown.engagement < 30) {
    return {
      likelihood: 'unlikely',
      confidence: 75,
      reasoning: 'Low adoption or engagement. Without course correction, pilot may not achieve goals.',
    };
  }

  return {
    likelihood: 'uncertain',
    confidence: 50,
    reasoning: 'Mixed signals. Some metrics strong, others weak. Outcome depends on interventions.',
  };
}

/**
 * Generate health report for stakeholders
 */
export function generateHealthReport(metrics: PilotMetrics): {
  summary: string;
  breakdown: PilotHealthScoreBreakdown;
  status: ReturnType<typeof getHealthScoreStatus>;
  milestones: ReturnType<typeof calculateMilestoneHealth>;
  prediction: ReturnType<typeof predictPilotSuccess>;
  keyMetrics: {
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'stable';
  }[];
} {
  const breakdown = calculatePilotHealthBreakdown(metrics);
  const status = getHealthScoreStatus(breakdown.overall);
  const milestoneHealth = calculateMilestoneHealth(metrics.milestones);
  const prediction = predictPilotSuccess(metrics);

  return {
    summary: `Pilot health score: ${breakdown.overall}/100 (${status.label}). ${status.description}`,
    breakdown,
    status,
    milestones: milestoneHealth,
    prediction,
    keyMetrics: [
      {
        label: 'Days Active',
        value: `${metrics.daysActive} days`,
      },
      {
        label: 'Organizer Adoption',
        value: `${metrics.organizerAdoptionRate.toFixed(0)}%`,
      },
      {
        label: 'Member Engagement',
        value: `${metrics.memberEngagementRate.toFixed(0)}%`,
      },
      {
        label: 'Cases Managed',
        value: metrics.casesManaged.toString(),
      },
      {
        label: 'Avg Resolution Time',
        value: `${(Number(metrics.avgTimeToResolution) / 24).toFixed(1)} days`,
      },
    ],
  };
}

/**
 * Example usage:
 * 
 * const metrics = await getPilotMetrics(pilotId);
 * const health = calculatePilotHealth(metrics);
 * const breakdown = calculatePilotHealthBreakdown(metrics);
 * const report = generateHealthReport(metrics);
 * 
 * logger.info(`Health: ${health}/100`);
 * logger.info(`Adoption: ${breakdown.adoption}/100`);
 * logger.info(`Status: ${report.status.label}`);
 */
