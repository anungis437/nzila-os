/**
 * Defensibility Pack Service
 * 
 * Generates system-of-record exports for arbitration proceedings.
 * Provides complete audit trail, timeline, SLA compliance, and integrity verification.
 * 
 * Principle: "One system. One truth. Defensible evidence."
 */

import { createHash } from 'crypto';
import { calculateCaseSlaStatus, type SlaStatus } from './sla-calculator';

/**
 * Visibility level for timeline events
 */
export type VisibilityScope = 'member' | 'staff' | 'admin' | 'system';

/**
 * Timeline event with full metadata
 */
export interface TimelineEvent {
  id: string;
  caseId: string;
  timestamp: Date;
  type: 'submitted' | 'acknowledged' | 'first_response' | 'investigation_complete' | 'other';
  description: string;
  actorId: string;
  actorRole: string;
  visibilityScope: VisibilityScope;
  metadata?: Record<string, unknown>;
}

/**
 * Audit log entry
 */
export interface AuditEntry {
  id: string;
  timestamp: Date;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  sanitizedMetadata: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Case state transition record
 */
export interface StateTransition {
  timestamp: Date;
  fromState: string;
  toState: string;
  actorRole: string;
  reason?: string;
  validationPassed: boolean;
}

/**
 * SLA compliance record
 */
export interface SlaCompliance {
  standard: string;
  required: string;
  status: SlaStatus;
  daysElapsed: number;
  daysRemaining?: number;
  breachDate?: Date;
}

/**
 * Complete defensibility pack
 */
export interface DefensibilityPack {
  // Metadata
  exportVersion: string;
  generatedAt: Date;
  generatedBy: string;
  caseId: string;
  
  // Case summary
  caseSummary: {
    title: string;
    memberId: string;
    memberName: string;
    currentState: string;
    createdAt: Date;
    lastUpdated: Date;
    grievanceType: string;
    priority: string;
  };
  
  // Timeline (dual-surface)
  memberVisibleTimeline: TimelineEvent[];
  staffVisibleTimeline: TimelineEvent[];
  
  // Audit trail
  auditTrail: AuditEntry[];
  
  // Workflow history
  stateTransitions: StateTransition[];
  
  // SLA compliance
  slaCompliance: SlaCompliance[];
  
  // Integrity verification
  integrity: {
    timelineHash: string;
    auditHash: string;
    stateTransitionHash: string;
    combinedHash: string;
  };
  
  // Export metadata
  exportMetadata: {
    purpose: 'arbitration' | 'audit' | 'member_request' | 'compliance';
    requestedBy: string;
    exportFormat: 'json' | 'pdf';
    includeSensitiveData: boolean;
  };
}

/**
 * Calculate SHA-256 hash of data for integrity verification
 */
function calculateHash(data: unknown): string {
  const json = JSON.stringify(data, null, 0); // Canonical format (no whitespace)
  return createHash('sha256').update(json).digest('hex');
}

/**
 * Generate defensibility pack for a case
 * 
 * @param caseId - Case identifier
 * @param timeline - Complete case timeline events
 * @param auditTrail - Complete audit log
 * @param stateTransitions - All state changes
 * @param options - Export configuration
 * @returns Complete defensibility pack
 * 
 * @example
 * ```typescript
 * const pack = await generateDefensibilityPack('case-123', timeline, auditTrail, transitions, {
 *   purpose: 'arbitration',
 *   requestedBy: 'officer-456',
 *   exportFormat: 'json',
 *   includeSensitiveData: false, // Redact for arbitration
 * });
 * 
 * // Verify integrity
 * logger.info('Timeline integrity', { hash: pack.integrity.timelineHash });
 * logger.info('Combined hash', { hash: pack.integrity.combinedHash });
 * ```
 */
export async function generateDefensibilityPack(
  caseId: string,
  timeline: TimelineEvent[],
  auditTrail: AuditEntry[],
  stateTransitions: StateTransition[],
  options: {
    purpose: DefensibilityPack['exportMetadata']['purpose'];
    requestedBy: string;
    exportFormat: 'json' | 'pdf';
    includeSensitiveData?: boolean;
    caseSummary: DefensibilityPack['caseSummary'];
    generatedBy: string;
  }
): Promise<DefensibilityPack> {
  // Filter timeline by visibility scope
  const memberVisibleTimeline = timeline.filter(
    (e) => e.visibilityScope === 'member' || e.visibilityScope === 'staff'
  );
  
  const staffVisibleTimeline = timeline.filter(
    (e) => e.visibilityScope !== 'system' // Staff sees member + staff + admin
  );
  
  // Calculate SLA compliance (only if timeline has events)
  const currentDate = new Date();
  const slaCompliance: SlaCompliance[] = [];
  
  if (timeline.length > 0) {
    const slaAssessment = calculateCaseSlaStatus(
      caseId,
      timeline.map((e) => ({ timestamp: e.timestamp, type: e.type })),
      currentDate
    );
  
  if (slaAssessment.acknowledgment) {
    slaCompliance.push({
      standard: 'Acknowledgment of Receipt',
      required: '2 business days',
      status: slaAssessment.acknowledgment.status,
      daysElapsed: slaAssessment.acknowledgment.daysElapsed,
      daysRemaining: slaAssessment.acknowledgment.daysRemaining,
      breachDate: slaAssessment.acknowledgment.breachDate ?? undefined,
    });
  }
  
  if (slaAssessment.firstResponse) {
    slaCompliance.push({
      standard: 'First Response to Member',
      required: '5 business days',
      status: slaAssessment.firstResponse.status,
      daysElapsed: slaAssessment.firstResponse.daysElapsed,
      daysRemaining: slaAssessment.firstResponse.daysRemaining,
      breachDate: slaAssessment.firstResponse.breachDate ?? undefined,
    });
  }
  
  if (slaAssessment.investigation) {
    slaCompliance.push({
      standard: 'Investigation Complete',
      required: '15 business days',
      status: slaAssessment.investigation.status,
      daysElapsed: slaAssessment.investigation.daysElapsed,
      daysRemaining: slaAssessment.investigation.daysRemaining,
      breachDate: slaAssessment.investigation.breachDate ?? undefined,
    });
  }
  } // End if (timeline.length > 0)
  
  // Calculate integrity hashes
  const timelineHash = calculateHash(staffVisibleTimeline);
  const auditHash = calculateHash(auditTrail);
  const stateTransitionHash = calculateHash(stateTransitions);
  const combinedHash = calculateHash({
    timeline: timelineHash,
    audit: auditHash,
    transitions: stateTransitionHash,
  });
  
  const pack: DefensibilityPack = {
    exportVersion: '1.0.0',
    generatedAt: new Date(),
    generatedBy: options.generatedBy,
    caseId,
    
    caseSummary: options.caseSummary,
    
    memberVisibleTimeline,
    staffVisibleTimeline,
    
    auditTrail,
    
    stateTransitions,
    
    slaCompliance,
    
    integrity: {
      timelineHash,
      auditHash,
      stateTransitionHash,
      combinedHash,
    },
    
    exportMetadata: {
      purpose: options.purpose,
      requestedBy: options.requestedBy,
      exportFormat: options.exportFormat,
      includeSensitiveData: options.includeSensitiveData ?? false,
    },
  };
  
  return pack;
}

/**
 * Verify integrity of a defensibility pack
 * 
 * @param pack - Defensibility pack to verify
 * @returns Verification result
 * 
 * @example
 * ```typescript
 * const verification = verifyPackIntegrity(pack);
 * if (!verification.valid) {
 *   logger.error('Integrity check failed', { failures: verification.failures });
 * }
 * ```
 */
export function verifyPackIntegrity(pack: DefensibilityPack): {
  valid: boolean;
  failures: string[];
} {
  const failures: string[] = [];
  
  // Recalculate hashes
  const expectedTimelineHash = calculateHash(pack.staffVisibleTimeline);
  const expectedAuditHash = calculateHash(pack.auditTrail);
  const expectedStateTransitionHash = calculateHash(pack.stateTransitions);
  const expectedCombinedHash = calculateHash({
    timeline: expectedTimelineHash,
    audit: expectedAuditHash,
    transitions: expectedStateTransitionHash,
  });
  
  // Verify each hash
  if (pack.integrity.timelineHash !== expectedTimelineHash) {
    failures.push('Timeline integrity check failed');
  }
  
  if (pack.integrity.auditHash !== expectedAuditHash) {
    failures.push('Audit trail integrity check failed');
  }
  
  if (pack.integrity.stateTransitionHash !== expectedStateTransitionHash) {
    failures.push('State transition integrity check failed');
  }
  
  if (pack.integrity.combinedHash !== expectedCombinedHash) {
    failures.push('Combined integrity check failed');
  }
  
  return {
    valid: failures.length === 0,
    failures,
  };
}

/**
 * Generate human-readable summary for arbitration proceedings
 * 
 * @param pack - Defensibility pack
 * @returns Formatted summary text
 * 
 * @example
 * ```typescript
 * const summary = generateArbitrationSummary(pack);
 * logger.info('Arbitration summary generated', { summary });
 * ```
 */
export function generateArbitrationSummary(pack: DefensibilityPack): string {
  const { caseSummary, slaCompliance, stateTransitions, memberVisibleTimeline } = pack;
  
  let summary = `GRIEVANCE CASE SUMMARY\n`;
  summary += `=${'='.repeat(79)}\n\n`;
  
  // Case information
  summary += `Case ID: ${pack.caseId}\n`;
  summary += `Title: ${caseSummary.title}\n`;
  summary += `Member: ${caseSummary.memberName}\n`;
  summary += `Type: ${caseSummary.grievanceType}\n`;
  summary += `Priority: ${caseSummary.priority}\n`;
  summary += `Current State: ${caseSummary.currentState}\n`;
  summary += `Created: ${caseSummary.createdAt.toISOString()}\n`;
  summary += `Last Updated: ${caseSummary.lastUpdated.toISOString()}\n\n`;
  
  // SLA compliance
  summary += `SLA COMPLIANCE\n`;
  summary += `${'-'.repeat(79)}\n`;
  slaCompliance.forEach((sla) => {
    summary += `${sla.standard}: ${sla.status.toUpperCase()} `;
    summary += `(${sla.daysElapsed} of ${sla.required} elapsed)\n`;
  });
  summary += `\n`;
  
  // State transitions
  summary += `WORKFLOW PROGRESSION\n`;
  summary += `${'-'.repeat(79)}\n`;
  stateTransitions.forEach((transition, idx) => {
    summary += `${idx + 1}. ${transition.timestamp.toISOString()}: `;
    summary += `${transition.fromState} → ${transition.toState} `;
    summary += `(${transition.actorRole})`;
    if (transition.reason) {
      summary += ` - ${transition.reason}`;
    }
    summary += `\n`;
  });
  summary += `\n`;
  
  // Timeline
  summary += `MEMBER-VISIBLE TIMELINE\n`;
  summary += `${'-'.repeat(79)}\n`;
  memberVisibleTimeline.forEach((event, idx) => {
    summary += `${idx + 1}. ${event.timestamp.toISOString()}: ${event.description}\n`;
  });
  summary += `\n`;
  
  // Integrity verification
  summary += `INTEGRITY VERIFICATION\n`;
  summary += `${'-'.repeat(79)}\n`;
  summary += `Timeline Hash: ${pack.integrity.timelineHash}\n`;
  summary += `Audit Hash: ${pack.integrity.auditHash}\n`;
  summary += `Combined Hash: ${pack.integrity.combinedHash}\n\n`;
  
  // Export metadata
  summary += `EXPORT INFORMATION\n`;
  summary += `${'-'.repeat(79)}\n`;
  summary += `Generated: ${pack.generatedAt.toISOString()}\n`;
  summary += `Generated By: ${pack.generatedBy}\n`;
  summary += `Purpose: ${pack.exportMetadata.purpose}\n`;
  summary += `Export Version: ${pack.exportVersion}\n`;
  
  return summary;
}

/**
 * Export defensibility pack to JSON file
 * 
 * @param pack - Defensibility pack
 * @returns JSON string
 */
export function exportToJson(pack: DefensibilityPack): string {
  return JSON.stringify(pack, null, 2);
}

/**
 * Filter timeline events for specific audience
 * 
 * @param timeline - Complete timeline
 * @param audience - Target audience
 * @returns Filtered timeline
 */
export function filterTimelineForAudience(
  timeline: TimelineEvent[],
  audience: 'member' | 'staff' | 'admin'
): TimelineEvent[] {
  switch (audience) {
    case 'member':
      return timeline.filter((e) => e.visibilityScope === 'member');
    case 'staff':
      return timeline.filter((e) => 
        e.visibilityScope === 'member' || 
        e.visibilityScope === 'staff'
      );
    case 'admin':
      return timeline.filter((e) => e.visibilityScope !== 'system');
    default:
      return [];
  }
}

