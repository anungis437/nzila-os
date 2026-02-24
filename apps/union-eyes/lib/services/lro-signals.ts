/**
 * LRO Signals API
 * 
 * Real-time alert system for Labour Relations Officers.
 * Detects cases requiring attention and generates actionable signals.
 * 
 * Principle: "Signal what needs attention. Suppress what doesn&apos;t."
 */

import { differenceInBusinessDays } from 'date-fns';
import { calculateCaseSlaStatus, type SlaStatus } from './sla-calculator';
import type { CaseState } from './case-workflow-fsm';

/**
 * Signal severity levels
 */
export type SignalSeverity = 'critical' | 'urgent' | 'warning' | 'info';

/**
 * Signal types
 */
export type SignalType = 
  | 'sla_breached'           // SLA already breached
  | 'sla_at_risk'            // SLA at 80%+ threshold
  | 'case_stale'             // No activity in X days
  | 'urgent_state'           // Case in urgent workflow state
  | 'acknowledgment_overdue' // Submitted but not acknowledged
  | 'member_waiting'         // Member awaiting response
  | 'escalation_needed';     // Case should be escalated

/**
 * Timeline event for signal processing
 */
export interface TimelineEvent {
  timestamp: Date;
  type: 'submitted' | 'acknowledged' | 'first_response' | 'investigation_complete' | 'other';
}

/**
 * Case data for signal detection
 */
export interface CaseForSignals {
  id: string;
  title: string;
  memberId: string;
  memberName: string;
  currentState: CaseState;
  priority: 'low' | 'medium' | 'high' | 'critical';
  createdAt: Date;
  lastUpdated: Date;
  timeline: TimelineEvent[];
  assignedOfficerId?: string;
}

/**
 * Generated signal/alert
 */
export interface Signal {
  id: string;
  caseId: string;
  type: SignalType;
  severity: SignalSeverity;
  title: string;
  description: string;
  actionable: boolean;
  actionText?: string;
  context: {
    casePriority: string;
    currentState: string;
    daysElapsed?: number;
    slaStatus?: SlaStatus;
    slaType?: string;
    memberName?: string;
  };
  generatedAt: Date;
  expiresAt?: Date;
}

/**
 * Webhook payload for external integrations
 */
export interface WebhookPayload {
  event: 'signal.created' | 'signal.resolved';
  signal: Signal;
  case: {
    id: string;
    title: string;
    url: string;
  };
  timestamp: Date;
}

/**
 * Dashboard summary statistics
 */
export interface DashboardStats {
  totalCritical: number;
  totalUrgent: number;
  totalWarning: number;
  breachedCases: number;
  atRiskCases: number;
  staleCases: number;
  awaitingAcknowledgment: number;
  memberWaiting: number;
}

/**
 * Signal detection configuration
 */
export const SIGNAL_CONFIG = {
  STALE_THRESHOLD_DAYS: 7,           // No activity in 7 days = stale
  ACKNOWLEDGMENT_DEADLINE_DAYS: 2,   // Must acknowledge within 2 days
  MEMBER_WAITING_THRESHOLD_DAYS: 3,  // Member waiting > 3 days
  INVESTIGATION_THRESHOLD_DAYS: 10,  // Investigation > 10 days = escalate
} as const;

/**
 * Detect all signals for a given case
 * 
 * @param caseData - Case data with timeline
 * @param currentDate - Current date for calculations
 * @returns Array of detected signals
 * 
 * @example
 * ```typescript
 * const signals = detectSignals(caseData, new Date());
 * signals.forEach(s => {
 *   logger.info('Signal detected', { severity: s.severity, title: s.title });
 * });
 * ```
 */
export function detectSignals(
  caseData: CaseForSignals,
  currentDate: Date = new Date()
): Signal[] {
  const signals: Signal[] = [];
  
  // Skip terminal states (no action needed)
  if (['closed', 'resolved', 'withdrawn', 'escalated'].includes(caseData.currentState)) {
    return signals;
  }
  
  // Calculate SLA status
  const slaAssessment = calculateCaseSlaStatus(
    caseData.id,
    caseData.timeline,
    currentDate
  );
  
  // Signal 1: SLA Breached (CRITICAL)
  const breachedSlas: string[] = [];
  if (slaAssessment.acknowledgment?.status === 'breached') {
    breachedSlas.push('acknowledgment');
  }
  if (slaAssessment.firstResponse?.status === 'breached') {
    breachedSlas.push('first_response');
  }
  if (slaAssessment.investigation?.status === 'breached') {
    breachedSlas.push('investigation');
  }
  
  if (breachedSlas.length > 0) {
    signals.push({
      id: `${caseData.id}-sla-breached`,
      caseId: caseData.id,
      type: 'sla_breached',
      severity: 'critical',
      title: `SLA Breached: ${breachedSlas.join(', ')}`,
      description: `Case has breached ${breachedSlas.length} SLA standard(s). Immediate action required.`,
      actionable: true,
      actionText: 'Review case and update member',
      context: {
        casePriority: caseData.priority,
        currentState: caseData.currentState,
        slaStatus: 'breached',
        slaType: breachedSlas.join(', '),
        memberName: caseData.memberName,
      },
      generatedAt: currentDate,
    });
  }
  
  // Signal 2: SLA At Risk (URGENT)
  const atRiskSlas = slaAssessment.criticalSlas;
  if (atRiskSlas.length > 0 && breachedSlas.length === 0) {
    signals.push({
      id: `${caseData.id}-sla-at-risk`,
      caseId: caseData.id,
      type: 'sla_at_risk',
      severity: 'urgent',
      title: `SLA At Risk: ${atRiskSlas.join(', ')}`,
      description: `Case is approaching SLA breach (>80% elapsed). Act now to prevent breach.`,
      actionable: true,
      actionText: 'Prioritize this case',
      context: {
        casePriority: caseData.priority,
        currentState: caseData.currentState,
        slaStatus: 'at_risk',
        slaType: atRiskSlas.join(', '),
        memberName: caseData.memberName,
      },
      generatedAt: currentDate,
    });
  }
  
  // Signal 3: Acknowledgment Overdue (CRITICAL)
  if (caseData.currentState === 'submitted') {
    const daysSinceSubmitted = differenceInBusinessDays(
      currentDate,
      caseData.timeline.find(e => e.type === 'submitted')?.timestamp || caseData.createdAt
    );
    
    if (daysSinceSubmitted >= SIGNAL_CONFIG.ACKNOWLEDGMENT_DEADLINE_DAYS) {
      signals.push({
        id: `${caseData.id}-acknowledgment-overdue`,
        caseId: caseData.id,
        type: 'acknowledgment_overdue',
        severity: 'critical',
        title: 'Acknowledgment Overdue',
        description: `Case submitted ${daysSinceSubmitted} business days ago. Must acknowledge within 2 days.`,
        actionable: true,
        actionText: 'Acknowledge case receipt',
        context: {
          casePriority: caseData.priority,
          currentState: caseData.currentState,
          daysElapsed: daysSinceSubmitted,
          memberName: caseData.memberName,
        },
        generatedAt: currentDate,
      });
    }
  }
  
  // Signal 4: Member Waiting (URGENT)
  if (caseData.currentState === 'pending_response') {
    const lastResponseEvent = caseData.timeline
      .filter(e => e.type === 'first_response' || e.type === 'other')
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];
    
    if (lastResponseEvent) {
      const daysSinceLastResponse = differenceInBusinessDays(
        currentDate,
        lastResponseEvent.timestamp
      );
      
      if (daysSinceLastResponse >= SIGNAL_CONFIG.MEMBER_WAITING_THRESHOLD_DAYS) {
        signals.push({
          id: `${caseData.id}-member-waiting`,
          caseId: caseData.id,
          type: 'member_waiting',
          severity: 'urgent',
          title: 'Member Awaiting Response',
          description: `Member has been waiting ${daysSinceLastResponse} business days for response.`,
          actionable: true,
          actionText: 'Send member update',
          context: {
            casePriority: caseData.priority,
            currentState: caseData.currentState,
            daysElapsed: daysSinceLastResponse,
            memberName: caseData.memberName,
          },
          generatedAt: currentDate,
        });
      }
    }
  }
  
  // Signal 5: Case Stale (WARNING)
  const daysSinceActivity = differenceInBusinessDays(currentDate, caseData.lastUpdated);
  if (daysSinceActivity >= SIGNAL_CONFIG.STALE_THRESHOLD_DAYS) {
    signals.push({
      id: `${caseData.id}-stale`,
      caseId: caseData.id,
      type: 'case_stale',
      severity: 'warning',
      title: 'Stale Case',
      description: `No activity for ${daysSinceActivity} business days. Review and update status.`,
      actionable: true,
      actionText: 'Update case status',
      context: {
        casePriority: caseData.priority,
        currentState: caseData.currentState,
        daysElapsed: daysSinceActivity,
        memberName: caseData.memberName,
      },
      generatedAt: currentDate,
    });
  }
  
  // Signal 6: Escalation Needed (URGENT)
  if (caseData.currentState === 'investigating') {
    const investigationStartEvent = caseData.timeline.find(
      e => e.type === 'other' || e.type === 'acknowledged'
    );
    
    if (investigationStartEvent) {
      const daysInvestigating = differenceInBusinessDays(
        currentDate,
        investigationStartEvent.timestamp
      );
      
      if (daysInvestigating >= SIGNAL_CONFIG.INVESTIGATION_THRESHOLD_DAYS) {
        signals.push({
          id: `${caseData.id}-escalation-needed`,
          caseId: caseData.id,
          type: 'escalation_needed',
          severity: 'urgent',
          title: 'Escalation Recommended',
          description: `Case has been in investigation for ${daysInvestigating} business days. Consider escalation.`,
          actionable: true,
          actionText: 'Escalate to arbitration',
          context: {
            casePriority: caseData.priority,
            currentState: caseData.currentState,
            daysElapsed: daysInvestigating,
            memberName: caseData.memberName,
          },
          generatedAt: currentDate,
        });
      }
    }
  }
  
  // Signal 7: Urgent State (INFO)
  const urgentStates: CaseState[] = ['submitted', 'pending_response', 'escalated'];
  if (urgentStates.includes(caseData.currentState) && signals.length === 0) {
    signals.push({
      id: `${caseData.id}-urgent-state`,
      caseId: caseData.id,
      type: 'urgent_state',
      severity: 'info',
      title: `Case in Urgent State: ${caseData.currentState}`,
      description: `Case requires attention due to workflow state.`,
      actionable: false,
      context: {
        casePriority: caseData.priority,
        currentState: caseData.currentState,
        memberName: caseData.memberName,
      },
      generatedAt: currentDate,
    });
  }
  
  return signals;
}

/**
 * Get all signals for multiple cases
 * 
 * @param cases - Array of cases to analyze
 * @param currentDate - Current date for calculations
 * @returns Array of all detected signals
 */
export function detectAllSignals(
  cases: CaseForSignals[],
  currentDate: Date = new Date()
): Signal[] {
  const allSignals: Signal[] = [];
  
  for (const caseData of cases) {
    const caseSignals = detectSignals(caseData, currentDate);
    allSignals.push(...caseSignals);
  }
  
  // Sort by severity (critical > urgent > warning > info)
  const severityOrder: Record<SignalSeverity, number> = {
    critical: 0,
    urgent: 1,
    warning: 2,
    info: 3,
  };
  
  return allSignals.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}

/**
 * Filter signals by severity
 * 
 * @param signals - Array of signals
 * @param severity - Severity level to filter by
 * @returns Filtered signals
 */
export function filterBySeverity(
  signals: Signal[],
  severity: SignalSeverity | SignalSeverity[]
): Signal[] {
  const severities = Array.isArray(severity) ? severity : [severity];
  return signals.filter(s => severities.includes(s.severity));
}

/**
 * Filter signals by type
 * 
 * @param signals - Array of signals
 * @param type - Signal type to filter by
 * @returns Filtered signals
 */
export function filterByType(
  signals: Signal[],
  type: SignalType | SignalType[]
): Signal[] {
  const types = Array.isArray(type) ? type : [type];
  return signals.filter(s => types.includes(s.type));
}

/**
 * Get dashboard statistics from signals
 * 
 * @param signals - Array of signals
 * @returns Dashboard statistics
 */
export function getDashboardStats(signals: Signal[]): DashboardStats {
  return {
    totalCritical: filterBySeverity(signals, 'critical').length,
    totalUrgent: filterBySeverity(signals, 'urgent').length,
    totalWarning: filterBySeverity(signals, 'warning').length,
    breachedCases: filterByType(signals, 'sla_breached').length,
    atRiskCases: filterByType(signals, 'sla_at_risk').length,
    staleCases: filterByType(signals, 'case_stale').length,
    awaitingAcknowledgment: filterByType(signals, 'acknowledgment_overdue').length,
    memberWaiting: filterByType(signals, 'member_waiting').length,
  };
}

/**
 * Generate webhook payload for signal
 * 
 * @param signal - Signal to send
 * @param caseTitle - Case title
 * @param baseUrl - Base URL for case links
 * @returns Webhook payload
 */
export function generateWebhookPayload(
  signal: Signal,
  caseTitle: string,
  baseUrl: string
): WebhookPayload {
  return {
    event: 'signal.created',
    signal,
    case: {
      id: signal.caseId,
      title: caseTitle,
      url: `${baseUrl}/cases/${signal.caseId}`,
    },
    timestamp: new Date(),
  };
}

/**
 * Get actionable signals only (those requiring user action)
 * 
 * @param signals - Array of signals
 * @returns Actionable signals
 */
export function getActionableSignals(signals: Signal[]): Signal[] {
  return signals.filter(s => s.actionable);
}

/**
 * Group signals by case ID
 * 
 * @param signals - Array of signals
 * @returns Map of case ID to signals
 */
export function groupSignalsByCase(signals: Signal[]): Map<string, Signal[]> {
  const grouped = new Map<string, Signal[]>();
  
  for (const signal of signals) {
    const existing = grouped.get(signal.caseId) || [];
    existing.push(signal);
    grouped.set(signal.caseId, existing);
  }
  
  return grouped;
}

/**
 * Get highest severity signal for each case
 * 
 * @param signals - Array of signals
 * @returns Highest severity signal per case
 */
export function getHighestSeverityPerCase(signals: Signal[]): Signal[] {
  const grouped = groupSignalsByCase(signals);
  const highestPerCase: Signal[] = [];
  
  const severityOrder: Record<SignalSeverity, number> = {
    critical: 0,
    urgent: 1,
    warning: 2,
    info: 3,
  };
  
  for (const [, caseSignals] of grouped) {
    const highest = caseSignals.sort(
      (a, b) => severityOrder[a.severity] - severityOrder[b.severity]
    )[0];
    highestPerCase.push(highest);
  }
  
  return highestPerCase;
}

