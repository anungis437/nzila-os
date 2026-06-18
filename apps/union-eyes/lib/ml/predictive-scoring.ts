/**
 * Predictive Engagement Scoring
 * 
 * SPRINT 8: Advanced Features
 * 
 * Purpose: Predict pilot success, member engagement, and organizer retention
 * using machine learning models trained on historical data.
 * 
 * Models:
 * 1. Pilot Success Prediction - Will a pilot application succeed?
 * 2. Member Engagement Score - How engaged will a member be?
 * 3. Organizer Retention Risk - Is an organizer at risk of disengagement?
 * 4. Case Resolution Prediction - How long will a case take?
 * 
 * Philosophy: "Predict to support, not surveil"
 * - Predictions are system-level, not individual surveillance
 * - Scores help allocate resources, not judge people
 * - Transparency: show why a prediction was made
 * - No punitive uses
 * 
 * Implementation: Simplified scoring algorithms (not full ML in this version)
 * In production, integrate with sklearn, TensorFlow, or cloud ML services
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PredictionResult {
  score: number; // 0-100
  confidence: number; // 0-100
  interpretation: string;
  factors: {
    name: string;
    impact: number; // -100 to +100
    value: any;
  }[];
  recommendations: string[];
}

export interface PilotSuccessPredictionInput {
  organizationType: string;
  memberCount: number;
  sectors: string[];
  jurisdictions: string[];
  readinessScore: number;
  currentSystem: 'none' | 'spreadsheet' | 'paper-based' | 'legacy-software' | 'other';
  challenges: string[];
  goals: string[];
  leadershipBuyIn: 'low' | 'medium' | 'high';
}

export interface MemberEngagementPredictionInput {
  memberSince: Date;
  caseCount: number;
  lastActivityDate: Date;
  communicationPreferences: {
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  issueTypes: string[];
  resolutionRate: number; // 0-100
}

export interface OrganizerRetentionPredictionInput {
  organizerSince: Date;
  casesHandled: number;
  avgCaseResolutionTime: number; // days
  memberSatisfactionScore: number; // 0-100
  lastLoginDate: Date;
  impactScore: number; // 0-100
  recognitionEvents: number;
}

// ============================================================================
// PILOT SUCCESS PREDICTION
// ============================================================================

/**
 * Predict probability of pilot success (approval + active + completed)
 * 
 * Factors considered:
 * - Organization size (larger = more resources)
 * - Readiness score (higher = more prepared)
 * - Current system (worse = more to gain)
 * - Leadership buy-in (higher = more support)
 * - Sector experience (some sectors more successful)
 * - Jurisdiction complexity (single jurisdiction easier)
 */
export function predictPilotSuccess(input: PilotSuccessPredictionInput): PredictionResult {
  const factors: PredictionResult['factors'] = [];

  // Factor 1: Member count (larger organizations have more resources)
  let memberCountScore = 0;
  if (input.memberCount > 1000) {
    memberCountScore = 25;
  } else if (input.memberCount > 500) {
    memberCountScore = 20;
  } else if (input.memberCount > 100) {
    memberCountScore = 15;
  } else {
    memberCountScore = 10;
  }
  factors.push({
    name: 'Organization Size',
    impact: memberCountScore,
    value: `${input.memberCount} members`,
  });

  // Factor 2: Readiness score (direct correlation)
  const readinessScore = (input.readinessScore / 100) * 30; // Max 30 points
  factors.push({
    name: 'Readiness Assessment',
    impact: readinessScore,
    value: `${input.readinessScore}/100`,
  });

  // Factor 3: Current system (worse = more pain, more motivation)
  let currentSystemScore = 0;
  switch (input.currentSystem) {
    case 'none':
      currentSystemScore = 15; // High motivation
      break;
    case 'paper-based':
      currentSystemScore = 20; // Very high motivation
      break;
    case 'spreadsheet':
      currentSystemScore = 10; // Some pain
      break;
    case 'legacy-software':
      currentSystemScore = 5; // Some existing investment
      break;
    default:
      currentSystemScore = 8;
  }
  factors.push({
    name: 'Current System Pain',
    impact: currentSystemScore,
    value: input.currentSystem,
  });

  // Factor 4: Leadership buy-in (critical for success)
  let leadershipScore = 0;
  switch (input.leadershipBuyIn) {
    case 'high':
      leadershipScore = 25;
      break;
    case 'medium':
      leadershipScore = 15;
      break;
    case 'low':
      leadershipScore = 5;
      break;
  }
  factors.push({
    name: 'Leadership Buy-In',
    impact: leadershipScore,
    value: input.leadershipBuyIn,
  });

  // Factor 5: Jurisdiction complexity (fewer = easier)
  const jurisdictionScore = input.jurisdictions.length === 1 ? 10 : input.jurisdictions.length === 2 ? 7 : 3;
  factors.push({
    name: 'Jurisdiction Simplicity',
    impact: jurisdictionScore,
    value: `${input.jurisdictions.length} jurisdiction${input.jurisdictions.length > 1 ? 's' : ''}`,
  });

  // Calculate total score
  const totalScore = Math.min(
    memberCountScore + readinessScore + currentSystemScore + leadershipScore + jurisdictionScore,
    100
  );

  // Confidence (based on data completeness)
  const confidence = 85; // Simplified - would calculate based on input completeness

  // Interpretation
  let interpretation = '';
  if (totalScore >= 80) {
    interpretation = 'High likelihood of pilot success. Strong readiness and organizational support.';
  } else if (totalScore >= 60) {
    interpretation = 'Moderate likelihood of success. Some risk factors present but manageable.';
  } else if (totalScore >= 40) {
    interpretation = 'Uncertain outcome. Significant challenges require mitigation before approval.';
  } else {
    interpretation = 'Low likelihood of success. Multiple risk factors suggest deferring until conditions improve.';
  }

  // Recommendations
  const recommendations: string[] = [];
  if (leadershipScore < 20) {
    recommendations.push('Strengthen leadership buy-in through executive briefings and peer testimonials');
  }
  if (readinessScore < 20) {
    recommendations.push('Improve technical readiness through training or infrastructure investment');
  }
  if (currentSystemScore < 10) {
    recommendations.push('Document pain points from current system to build urgency');
  }
  if (input.jurisdictions.length > 2) {
    recommendations.push('Consider phased rollout: start with single jurisdiction, expand after success');
  }
  if (recommendations.length === 0) {
    recommendations.push('Organization is well-positioned for pilot success');
  }

  return {
    score: totalScore,
    confidence,
    interpretation,
    factors,
    recommendations,
  };
}

// ============================================================================
// MEMBER ENGAGEMENT PREDICTION
// ============================================================================

/**
 * Predict member engagement level (0-100)
 * 
 * Factors:
 * - Tenure (longer = more invested)
 * - Activity recency (recent = engaged)
 * - Case count (more cases = more needs)
 * - Resolution rate (success breeds engagement)
 * - Communication preferences set (engaged members customize)
 */
export function predictMemberEngagement(input: MemberEngagementPredictionInput): PredictionResult {
  const factors: PredictionResult['factors'] = [];

  // Factor 1: Tenure (longer membership = more investment)
  const tenureDays = Math.floor((Date.now() - input.memberSince.getTime()) / (1000 * 60 * 60 * 24));
  let tenureScore = 0;
  if (tenureDays > 365) {
    tenureScore = 25; // 1+ years
  } else if (tenureDays > 180) {
    tenureScore = 20; // 6+ months
  } else if (tenureDays > 90) {
    tenureScore = 15; // 3+ months
  } else {
    tenureScore = 10; // New member
  }
  factors.push({
    name: 'Membership Tenure',
    impact: tenureScore,
    value: `${Math.floor(tenureDays / 30)} months`,
  });

  // Factor 2: Activity recency (recent = engaged)
  const daysSinceActivity = Math.floor((Date.now() - input.lastActivityDate.getTime()) / (1000 * 60 * 60 * 24));
  let recencyScore = 0;
  if (daysSinceActivity < 7) {
    recencyScore = 30; // Active this week
  } else if (daysSinceActivity < 30) {
    recencyScore = 20; // Active this month
  } else if (daysSinceActivity < 90) {
    recencyScore = 10; // Active this quarter
  } else {
    recencyScore = 5; // Stale
  }
  factors.push({
    name: 'Recent Activity',
    impact: recencyScore,
    value: `${daysSinceActivity} days ago`,
  });

  // Factor 3: Case count (more cases = more invested)
  let caseCountScore = 0;
  if (input.caseCount > 5) {
    caseCountScore = 20;
  } else if (input.caseCount > 2) {
    caseCountScore = 15;
  } else if (input.caseCount > 0) {
    caseCountScore = 10;
  } else {
    caseCountScore = 5; // No cases yet
  }
  factors.push({
    name: 'Case Volume',
    impact: caseCountScore,
    value: `${input.caseCount} cases`,
  });

  // Factor 4: Resolution rate (success = engagement)
  const resolutionScore = (input.resolutionRate / 100) * 15; // Max 15 points
  factors.push({
    name: 'Case Success Rate',
    impact: resolutionScore,
    value: `${input.resolutionRate}%`,
  });

  // Factor 5: Communication preferences (customization = engagement)
  const prefsSet = [
    input.communicationPreferences.email,
    input.communicationPreferences.sms,
    input.communicationPreferences.push,
  ].filter(Boolean).length;
  const prefsScore = prefsSet * 3.33; // Max 10 points
  factors.push({
    name: 'Customization',
    impact: prefsScore,
    value: `${prefsSet}/3 channels configured`,
  });

  // Calculate total score
  const totalScore = Math.min(tenureScore + recencyScore + caseCountScore + resolutionScore + prefsScore, 100);

  // Confidence
  const confidence = input.caseCount > 0 ? 90 : 70; // Higher confidence with case history

  // Interpretation
  let interpretation = '';
  if (totalScore >= 75) {
    interpretation = 'Highly engaged member. Active user with strong case history.';
  } else if (totalScore >= 50) {
    interpretation = 'Moderately engaged member. Regular user with some activity.';
  } else if (totalScore >= 30) {
    interpretation = 'Low engagement member. Occasional user, may need outreach.';
  } else {
    interpretation = 'At-risk member. Minimal activity, recommend re-engagement campaign.';
  }

  // Recommendations
  const recommendations: string[] = [];
  if (daysSinceActivity > 60) {
    recommendations.push('Member inactive for 60+ days - send re-engagement notification');
  }
  if (input.caseCount === 0) {
    recommendations.push('Member has no open cases - consider onboarding follow-up');
  }
  if (prefsSet === 0) {
    recommendations.push('Communication preferences not set - send setup reminder');
  }
  if (input.resolutionRate < 50 && input.caseCount > 0) {
    recommendations.push('Low resolution rate - offer support or escalation options');
  }
  if (recommendations.length === 0) {
    recommendations.push('Member is well-engaged - maintain current support level');
  }

  return {
    score: totalScore,
    confidence,
    interpretation,
    factors,
    recommendations,
  };
}

// ============================================================================
// ORGANIZER RETENTION PREDICTION
// ============================================================================

/**
 * Predict organizer retention risk (0-100, higher = at risk)
 * 
 * Factors:
 * - Burnout indicators (high caseload, long resolution times)
 * - Disengagement (infrequent login, low impact score)
 * - Low recognition (no acknowledgment for work)
 * - Member dissatisfaction (low satisfaction scores)
 */
export function predictOrganizerRetentionRisk(input: OrganizerRetentionPredictionInput): PredictionResult {
  const factors: PredictionResult['factors'] = [];

  // Factor 1: Caseload (too high = burnout risk)
  let caseloadRisk = 0;
  if (input.casesHandled > 50) {
    caseloadRisk = 25; // Very high risk
  } else if (input.casesHandled > 30) {
    caseloadRisk = 15; // Moderate risk
  } else if (input.casesHandled > 15) {
    caseloadRisk = 5; // Healthy load
  } else {
    caseloadRisk = 10; // Too low (disengagement?)
  }
  factors.push({
    name: 'Caseload Volume',
    impact: caseloadRisk,
    value: `${input.casesHandled} cases`,
  });

  // Factor 2: Case resolution time (long = frustration)
  let resolutionTimeRisk = 0;
  if (input.avgCaseResolutionTime > 60) {
    resolutionTimeRisk = 20; // Very long
  } else if (input.avgCaseResolutionTime > 30) {
    resolutionTimeRisk = 10; // Moderate
  } else {
    resolutionTimeRisk = 0; // Good
  }
  factors.push({
    name: 'Resolution Time',
    impact: resolutionTimeRisk,
    value: `${input.avgCaseResolutionTime.toFixed(0)} days avg`,
  });

  // Factor 3: Recent activity (infrequent login = disengagement)
  const daysSinceLogin = Math.floor((Date.now() - input.lastLoginDate.getTime()) / (1000 * 60 * 60 * 24));
  let activityRisk = 0;
  if (daysSinceLogin > 14) {
    activityRisk = 30; // Very concerning
  } else if (daysSinceLogin > 7) {
    activityRisk = 15; // Concerning
  } else {
    activityRisk = 0; // Active
  }
  factors.push({
    name: 'Recent Activity',
    impact: activityRisk,
    value: `${daysSinceLogin} days since login`,
  });

  // Factor 4: Recognition (low = underappreciated)
  let recognitionRisk = 0;
  if (input.recognitionEvents === 0) {
    recognitionRisk = 15; // No recognition
  } else if (input.recognitionEvents < 3) {
    recognitionRisk = 5; // Some recognition
  } else {
    recognitionRisk = 0; // Well-recognized
  }
  factors.push({
    name: 'Recognition',
    impact: recognitionRisk,
    value: `${input.recognitionEvents} recognition events`,
  });

  // Factor 5: Member satisfaction (low = frustration)
  const satisfactionRisk = ((100 - input.memberSatisfactionScore) / 100) * 10; // Max 10 points
  factors.push({
    name: 'Member Satisfaction',
    impact: satisfactionRisk,
    value: `${input.memberSatisfactionScore}/100`,
  });

  // Calculate total risk score
  const totalRisk = Math.min(caseloadRisk + resolutionTimeRisk + activityRisk + recognitionRisk + satisfactionRisk, 100);

  // Confidence
  const confidence = input.casesHandled > 10 ? 85 : 65; // Higher confidence with more data

  // Interpretation — wellbeing framing, supportive intent (see file header: "Predict to support, not surveil")
  let interpretation = '';
  if (totalRisk >= 70) {
    interpretation = 'High burnout signal. Offer immediate support and workload relief.';
  } else if (totalRisk >= 50) {
    interpretation = 'Elevated burnout signal. Check in and offer support.';
  } else if (totalRisk >= 30) {
    interpretation = 'Low burnout signal. Organizer is engaged and supported.';
  } else {
    interpretation = 'Very low burnout signal. Organizer is thriving.';
  }

  // Recommendations
  const recommendations: string[] = [];
  if (caseloadRisk > 20) {
    recommendations.push('Redistribute caseload - organizer at risk of burnout');
  }
  if (activityRisk > 20) {
    recommendations.push('Reach out personally - extended absence may indicate disengagement');
  }
  if (recognitionRisk > 10) {
    recommendations.push('Recognize organizer achievements - send appreciation message or highlight impact');
  }
  if (resolutionTimeRisk > 15) {
    recommendations.push('Review case complexity - may need additional resources or training');
  }
  if (satisfactionRisk > 5) {
    recommendations.push('Low member satisfaction - offer coaching or process improvement support');
  }
  if (recommendations.length === 0) {
    recommendations.push('Organizer is healthy and engaged - maintain current support');
  }

  return {
    score: totalRisk,
    confidence,
    interpretation,
    factors,
    recommendations,
  };
}

// ============================================================================
// BATCH PREDICTIONS
// ============================================================================

/**
 * Run predictions for multiple pilots (for cohort analysis)
 */
export function batchPredictPilotSuccess(
  inputs: PilotSuccessPredictionInput[]
): { input: PilotSuccessPredictionInput; prediction: PredictionResult }[] {
  return inputs.map((input) => ({
    input,
    prediction: predictPilotSuccess(input),
  }));
}

/**
 * Run predictions for multiple members (for engagement campaigns)
 */
export function batchPredictMemberEngagement(
  inputs: MemberEngagementPredictionInput[]
): { input: MemberEngagementPredictionInput; prediction: PredictionResult }[] {
  return inputs.map((input) => ({
    input,
    prediction: predictMemberEngagement(input),
  }));
}

/**
 * Run predictions for multiple organizers (for retention interventions)
 */
export function batchPredictOrganizerRetention(
  inputs: OrganizerRetentionPredictionInput[]
): { input: OrganizerRetentionPredictionInput; prediction: PredictionResult }[] {
  return inputs.map((input) => ({
    input,
    prediction: predictOrganizerRetentionRisk(input),
  }));
}

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example 1: Pilot application review
 * 
 * const prediction = predictPilotSuccess({
 *   organizationType: 'local',
 *   memberCount: 1200,
 *   sectors: ['manufacturing'],
 *   jurisdictions: ['Ontario'],
 *   readinessScore: 78,
 *   currentSystem: 'paper-based',
 *   challenges: ['slow-resolution', 'lack-of-transparency'],
 *   goals: ['faster-resolution', 'member-engagement'],
 *   leadershipBuyIn: 'high',
 * });
 * 
 * if (prediction.score >= 70) {
 *   logger.info('Approve pilot - high success probability');
 * } else {
 *   logger.info('Defer or reject - address risk factors:', prediction.recommendations);
 * }
 */

/**
 * Example 2: Member re-engagement campaign
 * 
 * const atRiskMembers = await db.select().from(members).where(...);
 * const predictions = batchPredictMemberEngagement(atRiskMembers.map(m => ({
 *   memberSince: m.createdAt,
 *   caseCount: m.caseCount,
 *   lastActivityDate: m.lastActivityDate,
 *   communicationPreferences: m.preferences,
 *   issueTypes: m.issueTypes,
 *   resolutionRate: m.resolutionRate,
 * })));
 * 
 * const needsReengagement = predictions.filter(p => p.prediction.score < 40);
 * await sendReengagementCampaign(needsReengagement.map(p => p.input));
 */

/**
 * Example 3: Organizer support interventions
 * 
 * const organizers = await db.select().from(organizerProfiles).where(...);
 * const predictions = batchPredictOrganizerRetention(organizers.map(o => ({
 *   organizerSince: o.createdAt,
 *   casesHandled: o.casesHandled,
 *   avgCaseResolutionTime: o.avgResolutionTime,
 *   memberSatisfactionScore: o.satisfactionScore,
 *   lastLoginDate: o.lastLoginDate,
 *   impactScore: o.impactScore,
 *   recognitionEvents: o.recognitionEvents,
 * })));
 * 
 * const highRisk = predictions.filter(p => p.prediction.score >= 60);
 * await escalateToManagement(highRisk);
 */
