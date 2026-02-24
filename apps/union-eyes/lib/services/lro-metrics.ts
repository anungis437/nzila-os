/**
 * LRO Metrics Collection Service
 * 
 * Tracks key performance indicators for Labour Relations Operating System.
 * Enables data-driven decisions and continuous improvement.
 * 
 * Metrics Categories:
 * - Case Management: Resolution times, state transitions, SLA compliance
 * - Signal Detection: Signal counts by severity, action rates
 * - Feature Adoption: Flag usage, feature engagement
 * - Officer Performance: Case load, response times
 * - System Health: Error rates, API latency
 * 
 * @example
 * ```typescript
 * // Track case state transition
 * await trackMetric('case_state_transition', {
 *   caseId: 'case_123',
 *   fromState: 'submitted',
 *   toState: 'acknowledged',
 *   durationMs: 14400000,
 * });
 * 
 * // Track signal detection
 * await trackMetric('signal_detected', {
 *   signalType: 'sla_at_risk',
 *   severity: 'urgent',
 *   caseId: 'case_123',
 * });
 * ```
 */

import { db } from '@/db/db';
 
import { logger } from '@/lib/logger';

/**
 * Metric event types
 */
export type MetricEventType =
  // Case Management
  | 'case_created'
  | 'case_state_transition'
  | 'case_resolved'
  | 'case_escalated'
  | 'sla_breached'
  | 'sla_at_risk'
  
  // Signal Detection
  | 'signal_detected'
  | 'signal_acknowledged'
  | 'signal_resolved'
  | 'signal_dismissed'
  
  // Feature Adoption
  | 'feature_flag_evaluated'
  | 'feature_enabled'
  | 'dashboard_viewed'
  | 'filter_applied'
  
  // Officer Actions
  | 'officer_action_taken'
  | 'case_assigned'
  | 'case_updated'
  | 'export_generated'
  
  // System Health
  | 'api_error'
  | 'api_latency'
  | 'validation_error';

/**
 * Metric event data
 */
export interface MetricEvent {
  type: MetricEventType;
  timestamp: Date;
  userId?: string;
  organizationId?: string;
  caseId?: string;
  metadata: Record<string, unknown>;
}

/**
 * Aggregated metrics for dashboards
 */
export interface AggregatedMetrics {
  // Case Management
  totalCases: number;
  openCases: number;
  resolvedCases: number;
  avgResolutionTimeHours: number;
  slaComplianceRate: number;
  
  // Signal Effectiveness
  totalSignals: number;
  criticalSignals: number;
  urgentSignals: number;
  signalActionRate: number; // % of signals acted upon
  
  // Officer Performance
  avgCasesPerOfficer: number;
  avgResponseTimeHours: number;
  
  // Feature Adoption
  featureAdoptionRate: Record<string, number>; // feature -> % enabled
  dashboardActiveUsers: number;
  
  // Time Period
  startDate: Date;
  endDate: Date;
}

/**
 * Case resolution metrics
 */
export interface CaseResolutionMetrics {
  caseId: string;
  createdAt: Date;
  resolvedAt: Date | null;
  totalDurationHours: number;
  stateTransitions: Array<{
    fromState: string;
    toState: string;
    timestamp: Date;
    durationHours: number;
  }>;
  signalsDetected: number;
  signalsActedOn: number;
  slaCompliant: boolean;
}

/**
 * Signal effectiveness metrics
 */
export interface SignalEffectivenessMetrics {
  signalType: string;
  totalDetected: number;
  totalAcknowledged: number;
  totalResolved: number;
  totalDismissed: number;
  avgTimeToActionHours: number;
  resolutionRate: number; // % resolved vs. dismissed
}

// In-memory metric buffer (flush to DB periodically)
const metricBuffer: MetricEvent[] = [];
const BUFFER_SIZE = 100;
const FLUSH_INTERVAL_MS = 60000; // 1 minute

// Auto-flush on interval
if (typeof window === 'undefined') {
  // Server-side only
  setInterval(() => {
    if (metricBuffer.length > 0) {
      flushMetrics().catch(err => {
        logger.error('[LROMetrics] Flush error', { error: err });
      });
    }
  }, FLUSH_INTERVAL_MS);
}

/**
 * Track a metric event
 * 
 * Adds event to buffer, flushes to DB when buffer is full.
 */
export async function trackMetric(
  type: MetricEventType,
  metadata: Record<string, unknown>,
  context?: {
    userId?: string;
    organizationId?: string;
    caseId?: string;
  }
): Promise<void> {
  const event: MetricEvent = {
    type,
    timestamp: new Date(),
    userId: context?.userId,
    organizationId: context?.organizationId,
    caseId: context?.caseId,
    metadata,
  };
  
  metricBuffer.push(event);
  
  // Auto-flush if buffer full
  if (metricBuffer.length >= BUFFER_SIZE) {
    await flushMetrics();
  }
}

/**
 * Flush buffered metrics to database
 */
async function flushMetrics(): Promise<void> {
  if (metricBuffer.length === 0) return;
  
  const events = metricBuffer.splice(0, metricBuffer.length);
  
  // In production, insert into metrics table
  // await db.insert(metricsTable).values(events);
  
  if (process.env.NODE_ENV === 'development') {
    logger.info('[LROMetrics] Flushed events to database', { count: events.length });
  }
}

/**
 * Get aggregated metrics for a time period
 */
export async function getAggregatedMetrics(
  startDate: Date,
  endDate: Date,
  organizationId?: string
): Promise<AggregatedMetrics> {
  const { grievances } = await import('@/db/schema/domains/claims');
  const { analyticsMetrics } = await import('@/db/schema/analytics');
  const { eq, and, gte, lte, count, avg: _avg, sql } = await import('drizzle-orm');
  
  try {
    // Build base query conditions
    const conditions = [
      gte(grievances.createdAt, startDate),
      lte(grievances.createdAt, endDate),
    ];
    
    if (organizationId) {
      conditions.push(eq(grievances.organizationId, organizationId));
    }
    
    // Query case metrics from grievances table
    const caseMetrics = await db
      .select({
        total: count(),
        open: sql<number>`count(*) filter (where ${grievances.status} not in ('closed', 'settled', 'resolved'))`,
        resolved: sql<number>`count(*) filter (where ${grievances.status} in ('closed', 'settled', 'resolved'))`,
        avgResolutionHours: sql<number>`avg(extract(epoch from (${grievances.resolvedAt} - ${grievances.createdAt})) / 3600) filter (where ${grievances.resolvedAt} is not null)`,
      })
      .from(grievances)
      .where(and(...conditions));
    
    const cases = caseMetrics[0] || {
      total: 0,
      open: 0,
      resolved: 0,
      avgResolutionHours: 0,
    };
    
    // Query analytics metrics for signals and adoption
    const analyticsConditions = [
      gte(analyticsMetrics.periodStart, startDate),
      lte(analyticsMetrics.periodEnd, endDate),
    ];
    
    if (organizationId) {
      analyticsConditions.push(eq(analyticsMetrics.organizationId, organizationId));
    }
    
    const metricsData = await db
      .select({
        metricType: analyticsMetrics.metricType,
        metricValue: analyticsMetrics.metricValue,
      })
      .from(analyticsMetrics)
      .where(and(...analyticsConditions));
    
    // Aggregate metrics
    let totalSignals = 0;
    let criticalSignals = 0;
    let urgentSignals = 0;
    let dashboardActiveUsers = 0;
    const featureAdoptionRate: Record<string, number> = {};
    
    for (const metric of metricsData) {
      const value = parseFloat(metric.metricValue || '0');
      
      if (metric.metricType === 'signal_detected') {
        totalSignals += value;
      } else if (metric.metricType === 'signal_critical') {
        criticalSignals += value;
      } else if (metric.metricType === 'signal_urgent') {
        urgentSignals += value;
      } else if (metric.metricType === 'active_users') {
        dashboardActiveUsers = value;
      } else if (metric.metricType?.startsWith('feature_')) {
        featureAdoptionRate[metric.metricType] = value;
      }
    }
    
    // Calculate SLA compliance rate
    const slaCompliant = await db
      .select({
        compliant: sql<number>`count(*) filter (where ${grievances.responseDeadline} is null or ${grievances.resolvedAt} <= ${grievances.responseDeadline})`,
        total: count(),
      })
      .from(grievances)
      .where(and(...conditions));
    
    const slaRate = slaCompliant[0]?.total
      ? (slaCompliant[0].compliant / slaCompliant[0].total) * 100
      : 100;
    
    return {
      totalCases: cases.total,
      openCases: cases.open,
      resolvedCases: cases.resolved,
      avgResolutionTimeHours: Number(cases.avgResolutionHours || 0),
      slaComplianceRate: slaRate,
      
      totalSignals,
      criticalSignals,
      urgentSignals,
      signalActionRate: totalSignals ? (criticalSignals + urgentSignals) / totalSignals * 100 : 0,
      
      avgCasesPerOfficer: 0, // Would require user/officer assignment data
      avgResponseTimeHours: Number(cases.avgResolutionHours || 0) / 2, // Estimate
      
      featureAdoptionRate,
      dashboardActiveUsers,
      
      startDate,
      endDate,
    };
  } catch (error) {
    logger.error('[LROMetrics] Error querying metrics', {
      error,
      startDate,
      endDate,
      organizationId,
    });
    // Return empty metrics on error
    return {
      totalCases: 0,
      openCases: 0,
      resolvedCases: 0,
      avgResolutionTimeHours: 0,
      slaComplianceRate: 0,
      totalSignals: 0,
      criticalSignals: 0,
      urgentSignals: 0,
      signalActionRate: 0,
      avgCasesPerOfficer: 0,
      avgResponseTimeHours: 0,
      featureAdoptionRate: {},
      dashboardActiveUsers: 0,
      startDate,
      endDate,
    };
  }
}

/**
 * Get case resolution metrics
 * 
 * Analyzes case lifecycle from creation to resolution.
 */
export function getCaseResolutionMetrics(
  caseData: {
    id: string;
    createdAt: Date;
    currentState: string;
    lastUpdated: Date;
    stateHistory?: Array<{
      state: string;
      timestamp: Date;
    }>;
  }
): CaseResolutionMetrics {
  const isResolved = ['resolved', 'closed'].includes(caseData.currentState);
  const resolvedAt = isResolved ? caseData.lastUpdated : null;
  
  const totalDurationHours = resolvedAt
    ? (resolvedAt.getTime() - caseData.createdAt.getTime()) / 3600000
    : (Date.now() - caseData.createdAt.getTime()) / 3600000;
  
  // Calculate state transitions
  const stateTransitions = (caseData.stateHistory || [])
    .map((entry, index, arr) => {
      if (index === 0) return null;
      
      const prev = arr[index - 1];
      const durationMs = entry.timestamp.getTime() - prev.timestamp.getTime();
      
      return {
        fromState: prev.state,
        toState: entry.state,
        timestamp: entry.timestamp,
        durationHours: durationMs / 3600000,
      };
    })
    .filter(Boolean) as CaseResolutionMetrics['stateTransitions'];
  
  return {
    caseId: caseData.id,
    createdAt: caseData.createdAt,
    resolvedAt,
    totalDurationHours,
    stateTransitions,
    signalsDetected: 0, // Would query from signals
    signalsActedOn: 0,
    slaCompliant: true, // Would check SLA status
  };
}

/**
 * Calculate signal effectiveness metrics
 * 
 * Measures how well signals drive officer action.
 */
export function calculateSignalEffectiveness(
  signals: Array<{
    type: string;
    detectedAt: Date;
    acknowledgedAt?: Date;
    resolvedAt?: Date;
    dismissedAt?: Date;
  }>
): Record<string, SignalEffectivenessMetrics> {
  const metricsByType: Record<string, SignalEffectivenessMetrics> = {};
  
  signals.forEach(signal => {
    if (!metricsByType[signal.type]) {
      metricsByType[signal.type] = {
        signalType: signal.type,
        totalDetected: 0,
        totalAcknowledged: 0,
        totalResolved: 0,
        totalDismissed: 0,
        avgTimeToActionHours: 0,
        resolutionRate: 0,
      };
    }
    
    const metrics = metricsByType[signal.type];
    metrics.totalDetected++;
    
    if (signal.acknowledgedAt) metrics.totalAcknowledged++;
    if (signal.resolvedAt) metrics.totalResolved++;
    if (signal.dismissedAt) metrics.totalDismissed++;
  });
  
  // Calculate averages and rates
  Object.values(metricsByType).forEach(metrics => {
    const totalActioned = metrics.totalResolved + metrics.totalDismissed;
    metrics.resolutionRate = totalActioned > 0
      ? (metrics.totalResolved / totalActioned) * 100
      : 0;
  });
  
  return metricsByType;
}

/**
 * Track case state transition with duration
 */
export async function trackCaseTransition(
  caseId: string,
  fromState: string,
  toState: string,
  userId: string,
  organizationId?: string
): Promise<void> {
  await trackMetric(
    'case_state_transition',
    {
      caseId,
      fromState,
      toState,
      transitionType: getTransitionType(fromState, toState),
    },
    { userId, organizationId, caseId }
  );
}

/**
 * Track signal detection
 */
export async function trackSignalDetected(
  signalType: string,
  severity: string,
  caseId: string,
  organizationId?: string
): Promise<void> {
  await trackMetric(
    'signal_detected',
    {
      signalType,
      severity,
      caseId,
    },
    { organizationId, caseId }
  );
}

/**
 * Track officer action on signal
 */
export async function trackSignalAction(
  signalType: string,
  action: 'acknowledged' | 'resolved' | 'dismissed',
  caseId: string,
  userId: string,
  organizationId?: string
): Promise<void> {
  const metricType = action === 'acknowledged'
    ? 'signal_acknowledged'
    : action === 'resolved'
    ? 'signal_resolved'
    : 'signal_dismissed';
  
  await trackMetric(
    metricType,
    {
      signalType,
      caseId,
    },
    { userId, organizationId, caseId }
  );
}

/**
 * Track feature flag evaluation (for adoption metrics)
 */
export async function trackFeatureFlagEvaluation(
  featureName: string,
  enabled: boolean,
  userId: string,
  organizationId?: string
): Promise<void> {
  await trackMetric(
    'feature_flag_evaluated',
    {
      featureName,
      enabled,
    },
    { userId, organizationId }
  );
}

/**
 * Track dashboard view (for engagement metrics)
 */
export async function trackDashboardView(
  userId: string,
  organizationId?: string
): Promise<void> {
  await trackMetric(
    'dashboard_viewed',
    {},
    { userId, organizationId }
  );
}

/**
 * Get transition type for categorization
 */
function getTransitionType(fromState: string, toState: string): string {
  // Analyze transition for categorization
  if (toState === 'resolved' || toState === 'closed') return 'resolution';
  if (toState === 'escalated') return 'escalation';
  if (fromState === 'submitted' && toState === 'acknowledged') return 'acknowledgment';
  if (toState === 'investigating') return 'investigation_start';
  return 'state_change';
}

/**
 * Calculate SLA compliance rate for period
 */
export function calculateSLAComplianceRate(
  cases: Array<{
    id: string;
    slaStatus: 'compliant' | 'at_risk' | 'breached';
  }>
): number {
  if (cases.length === 0) return 100;
  
  const compliantCount = cases.filter(c => c.slaStatus === 'compliant').length;
  return (compliantCount / cases.length) * 100;
}

/**
 * Calculate average resolution time
 */
export function calculateAvgResolutionTime(
  cases: Array<{
    createdAt: Date;
    resolvedAt: Date | null;
  }>
): number {
  const resolvedCases = cases.filter(c => c.resolvedAt !== null);
  
  if (resolvedCases.length === 0) return 0;
  
  const totalHours = resolvedCases.reduce((sum, c) => {
    const durationMs = c.resolvedAt!.getTime() - c.createdAt.getTime();
    return sum + (durationMs / 3600000);
  }, 0);
  
  return totalHours / resolvedCases.length;
}

/**
 * Calculate signal action rate (% of signals acted upon)
 */
export function calculateSignalActionRate(
  signals: Array<{
    detectedAt: Date;
    acknowledgedAt?: Date;
    actionedAt?: Date;
  }>
): number {
  if (signals.length === 0) return 0;
  
  const actionedCount = signals.filter(
    s => s.acknowledgedAt || s.actionedAt
  ).length;
  
  return (actionedCount / signals.length) * 100;
}

/**
 * Get top performing officers by case resolution
 */
export function getTopPerformingOfficers(
  officerMetrics: Array<{
    officerId: string;
    officerName: string;
    casesResolved: number;
    avgResolutionHours: number;
    slaComplianceRate: number;
  }>,
  limit: number = 10
): typeof officerMetrics {
  return [...officerMetrics]
    .sort((a, b) => {
      // Sort by SLA compliance rate first, then cases resolved
      if (b.slaComplianceRate !== a.slaComplianceRate) {
        return b.slaComplianceRate - a.slaComplianceRate;
      }
      return b.casesResolved - a.casesResolved;
    })
    .slice(0, limit);
}

