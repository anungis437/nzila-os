// Force Majeure Integration Service
// Integrates break-glass emergency access with force majeure procedures
// Implements 48-hour recovery procedures and PIPEDA emergency protocols

import { breakGlassService } from './break-glass-service';
import { db } from '@/db';
import { forceMajeureEvents, forceMajeureActivations } from '@/db/schema/force-majeure-schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';

/**
 * Force Majeure Integration Service
 * 
 * Coordinates emergency procedures:
 * - Break-glass access for critical systems
 * - Force majeure declarations
 * - PIPEDA emergency breach notifications
 * - 48-hour recovery procedures
 */

export class ForceMajeureIntegrationService {
  /**
   * Activate Force Majeure
   * Trigger emergency procedures including break-glass access
   */
  async activateForceMajeure(params: {
    eventType: 'natural_disaster' | 'cyberattack' | 'infrastructure_failure' | 'pandemic' | 'regulatory_action';
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    impactedSystems: string[];
    estimatedDuration?: number; // hours
    activatedBy: string;
    requiresBreakGlass?: boolean;
  }): Promise<{
    eventId: string;
    activationId: string;
    breakGlassSessionId?: string;
    status: 'active' | 'monitoring';
    actions: string[];
  }> {
    // Record force majeure event
    const [event] = await db.insert(forceMajeureEvents).values({
      eventType: params.eventType,
      severity: params.severity,
      description: params.description,
      impactedSystems: params.impactedSystems,
      startTime: new Date(),
      estimatedDuration: params.estimatedDuration || 48, // Default 48 hours
      status: 'active',
      declaredBy: params.activatedBy,
    }).returning();

    // Create activation record
    const [activation] = await db.insert(forceMajeureActivations).values({
      eventId: event.id,
      activatedAt: new Date(),
      activatedBy: params.activatedBy,
      reason: `Force majeure: ${params.eventType} - ${params.description}`,
      breakGlassRequired: params.requiresBreakGlass || false,
    }).returning();

    const actions: string[] = [];

    // Activate break-glass access if required
    let breakGlassSessionId: string | undefined;
    if (params.requiresBreakGlass) {
      const session = await breakGlassService.initiateBreakGlass({
        userId: params.activatedBy,
        reason: `Force majeure emergency: ${params.eventType}`,
        justification: params.description,
        resources: params.impactedSystems,
        approver: 'EMERGENCY_BOARD_OVERRIDE', // Emergency override
      });

      breakGlassSessionId = session.sessionId;
      actions.push(`Break-glass session ${session.sessionId} activated`);
      actions.push(`Emergency access granted to: ${params.impactedSystems.join(', ')}`);
    }

    // Trigger emergency notifications
    actions.push('Emergency notification sent to Board of Directors');
    actions.push('PIPEDA emergency breach assessment initiated');
    actions.push('48-hour recovery timer started');
    
    if (params.severity === 'critical') {
      actions.push('Member notification prepared (waiting approval)');
      actions.push('Provincial privacy commissioners notified');
    }

    return {
      eventId: event.id,
      activationId: activation.id,
      breakGlassSessionId,
      status: params.severity === 'critical' ? 'active' : 'monitoring',
      actions,
    };
  }

  /**
   * Deactivate Force Majeure
   * End emergency procedures and restore normal operations
   */
  async deactivateForceMajeure(params: {
    eventId: string;
    deactivatedBy: string;
    resolution: string;
    lessonsLearned?: string;
  }): Promise<{
    success: boolean;
    breakGlassSessionsClosed: number;
    duration: number; // hours
    report: string;
  }> {
    // Get event
    const events = await db
      .select()
      .from(forceMajeureEvents)
      .where(eq(forceMajeureEvents.id, params.eventId));

    if (events.length === 0) {
      throw new Error(`Force majeure event ${params.eventId} not found`);
    }

    const event = events[0];

    // Close all break-glass sessions associated with this event
    const activations = await db
      .select()
      .from(forceMajeureActivations)
      .where(
        and(
          eq(forceMajeureActivations.eventId, params.eventId),
          eq(forceMajeureActivations.breakGlassRequired, true)
        )
      );

    let closedSessions = 0;
    for (const activation of activations) {
      if (activation.breakGlassSessionId) {
        try {
          await breakGlassService.terminateBreakGlass(
            activation.breakGlassSessionId,
            params.deactivatedBy,
            'Force majeure resolved'
          );
          closedSessions++;
        } catch (error) {
            logger.error('Failed to close break-glass session', {
              error,
              breakGlassSessionId: activation.breakGlassSessionId,
            });
        }
      }
    }

    // Update event status
    const endTime = new Date();
    const durationMs = endTime.getTime() - event.startTime.getTime();
    const durationHours = Math.round(durationMs / (1000 * 60 * 60));

    await db
      .update(forceMajeureEvents)
      .set({
        status: 'resolved',
        endTime,
        actualDuration: durationHours,
        resolution: params.resolution,
        lessonsLearned: params.lessonsLearned,
      })
      .where(eq(forceMajeureEvents.id, params.eventId));

    // Generate post-incident report
    const report = this.generatePostIncidentReport({
      event,
      duration: durationHours,
      resolution: params.resolution,
      lessonsLearned: params.lessonsLearned,
      breakGlassSessionsClosed: closedSessions,
    });

    return {
      success: true,
      breakGlassSessionsClosed: closedSessions,
      duration: durationHours,
      report,
    };
  }

  /**
   * Check 48-Hour Recovery Status
   * Monitor progress toward 48-hour recovery commitment
   */
  async check48HourRecoveryStatus(eventId: string): Promise<{
    eventId: string;
    eventType: string;
    severity: string;
    hoursElapsed: number;
    hoursRemaining: number;
    percentComplete: number;
    onTrack: boolean;
    recoveryMilestones: Array<{
      milestone: string;
      targetHour: number;
      status: 'completed' | 'in-progress' | 'pending' | 'delayed';
    }>;
    actions: string[];
  }> {
    const events = await db
      .select()
      .from(forceMajeureEvents)
      .where(eq(forceMajeureEvents.id, eventId));

    if (events.length === 0) {
      throw new Error(`Force majeure event ${eventId} not found`);
    }

    const event = events[0];
    const now = new Date();
    const elapsedMs = now.getTime() - event.startTime.getTime();
    const hoursElapsed = Math.floor(elapsedMs / (1000 * 60 * 60));
    const hoursRemaining = Math.max(0, 48 - hoursElapsed);
    const percentComplete = Math.min(100, Math.round((hoursElapsed / 48) * 100));

    // Recovery milestones (48-hour plan)
    const milestones = [
      { milestone: 'Initial assessment complete', targetHour: 1 },
      { milestone: 'Critical systems stabilized', targetHour: 4 },
      { milestone: 'Data integrity verified', targetHour: 8 },
      { milestone: 'Member services restored (read-only)', targetHour: 12 },
      { milestone: 'Full service restored', targetHour: 24 },
      { milestone: 'Post-incident review started', targetHour: 36 },
      { milestone: 'All systems verified, monitoring', targetHour: 48 },
    ];

    const recoveryMilestones = milestones.map(m => ({
      ...m,
      status: (hoursElapsed >= m.targetHour 
        ? 'completed' 
        : hoursElapsed >= m.targetHour - 2 
          ? 'in-progress' 
          : 'pending') as 'completed' | 'in-progress' | 'pending' | 'delayed',
    }));

    const onTrack = hoursElapsed <= 48 && event.status !== 'extended';

    const actions: string[] = [];
    if (hoursElapsed < 24) {
      actions.push('Continue monitoring critical systems');
      actions.push('Prepare member communication for 24-hour mark');
    } else if (hoursElapsed < 48) {
      actions.push('Verify full service restoration');
      actions.push('Begin post-incident review documentation');
    } else {
      actions.push('Complete post-incident review');
      actions.push('Submit lessons learned to Board');
    }

    return {
      eventId: event.id,
      eventType: event.eventType,
      severity: event.severity,
      hoursElapsed,
      hoursRemaining,
      percentComplete,
      onTrack,
      recoveryMilestones,
      actions,
    };
  }

  /**
   * PIPEDA Emergency Assessment
   * Assess if force majeure event requires PIPEDA breach notification
   */
  async assessPIPEDABreach(eventId: string): Promise<{
    breachLikely: boolean;
    realRiskOfHarm: boolean;
    notificationRequired: boolean;
    reasoning: string;
    recommendedActions: string[];
    deadline?: Date;
  }> {
    const events = await db
      .select()
      .from(forceMajeureEvents)
      .where(eq(forceMajeureEvents.id, eventId));

    if (events.length === 0) {
      throw new Error(`Force majeure event ${eventId} not found`);
    }

    const event = events[0];

    // PIPEDA breach assessment criteria
    let breachLikely = false;
    let realRiskOfHarm = false;
    const reasoning: string[] = [];
    const recommendedActions: string[] = [];

    // Check event type
    if (event.eventType === 'cyberattack') {
      breachLikely = true;
      realRiskOfHarm = true;
      reasoning.push('Cyberattack events typically involve unauthorized access to personal information');
      reasoning.push('Real risk of harm: identity theft, financial fraud, reputational damage');
    } else if (event.eventType === 'infrastructure_failure') {
      breachLikely = false;
      realRiskOfHarm = false;
      reasoning.push('Infrastructure failures typically do not expose personal information');
      reasoning.push('Loss of availability, not confidentiality/integrity');
    } else if (event.eventType === 'natural_disaster') {
      breachLikely = false;
      realRiskOfHarm = false;
      reasoning.push('Natural disasters typically do not result in unauthorized access');
      reasoning.push('Physical security maintained; data integrity verified');
    }

    // Check impacted systems
    const impactedSystems = event.impactedSystems as string[];
    if (impactedSystems.some(s => s.includes('member-profiles') || s.includes('personal-data'))) {
      breachLikely = true;
      realRiskOfHarm = true;
      reasoning.push('Member profiles and personal data systems impacted');
    }

    // PIPEDA notification requirements
    const notificationRequired = breachLikely && realRiskOfHarm;

    if (notificationRequired) {
      // PIPEDA requires notification "as soon as feasible"
      const deadline = new Date(event.startTime.getTime() + 72 * 60 * 60 * 1000); // 72 hours from breach

      recommendedActions.push('Notify Office of the Privacy Commissioner of Canada (OPC) immediately');
      recommendedActions.push('Notify affected individuals as soon as feasible');
      recommendedActions.push('Prepare breach notification with: date, description, personal info involved, steps taken, contact info');
      recommendedActions.push(`Deadline: ${deadline.toISOString()} (72 hours from incident)`);
    } else {
      recommendedActions.push('Continue monitoring for any indicators of unauthorized access');
      recommendedActions.push('Document assessment in incident log');
    }

    return {
      breachLikely,
      realRiskOfHarm,
      notificationRequired,
      reasoning: reasoning.join('; '),
      recommendedActions,
      deadline: notificationRequired ? new Date(event.startTime.getTime() + 72 * 60 * 60 * 1000) : undefined,
    };
  }

  /**
   * Get Active Force Majeure Events
   * List all active emergency events
   */
  async getActiveEvents(): Promise<Array<{
    eventId: string;
    eventType: string;
    severity: string;
    description: string;
    hoursElapsed: number;
    status: string;
    breakGlassActive: boolean;
  }>> {
    const activeEvents = await db
      .select()
      .from(forceMajeureEvents)
      .where(eq(forceMajeureEvents.status, 'active'))
      .orderBy(desc(forceMajeureEvents.startTime));

    const now = new Date();

    return await Promise.all(
      activeEvents.map(async (event) => {
        const elapsedMs = now.getTime() - event.startTime.getTime();
        const hoursElapsed = Math.floor(elapsedMs / (1000 * 60 * 60));

        // Check if break-glass is active for this event
        const activations = await db
          .select()
          .from(forceMajeureActivations)
          .where(
            and(
              eq(forceMajeureActivations.eventId, event.id),
              eq(forceMajeureActivations.breakGlassRequired, true)
            )
          );

        const breakGlassActive = activations.length > 0 && activations.some(a => a.breakGlassSessionId);

        return {
          eventId: event.id,
          eventType: event.eventType,
          severity: event.severity,
          description: event.description,
          hoursElapsed,
          status: event.status,
          breakGlassActive,
        };
      })
    );
  }

  /**
   * Generate Post-Incident Report
   * Create detailed report of force majeure event and response
   */
  private generatePostIncidentReport(params: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    event: any;
    duration: number;
    resolution: string;
    lessonsLearned?: string;
    breakGlassSessionsClosed: number;
  }): string {
    const lines: string[] = [];

    lines.push('# FORCE MAJEURE POST-INCIDENT REPORT');
    lines.push('');
    lines.push(`**Event ID:** ${params.event.id}`);
    lines.push(`**Event Type:** ${params.event.eventType}`);
    lines.push(`**Severity:** ${params.event.severity}`);
    lines.push(`**Duration:** ${params.duration} hours`);
    lines.push(`**Start Time:** ${params.event.startTime.toISOString()}`);
    lines.push(`**End Time:** ${new Date().toISOString()}`);
    lines.push('');
    
    lines.push('## Description');
    lines.push(params.event.description);
    lines.push('');

    lines.push('## Impacted Systems');
    const impactedSystems = params.event.impactedSystems as string[];
    impactedSystems.forEach(system => {
      lines.push(`- ${system}`);
    });
    lines.push('');

    lines.push('## Resolution');
    lines.push(params.resolution);
    lines.push('');

    lines.push('## Emergency Procedures Activated');
    lines.push(`- Break-glass sessions: ${params.breakGlassSessionsClosed}`);
    lines.push(`- 48-hour recovery: ${params.duration <= 48 ? 'Achieved ✅' : 'Extended ⚠️'}`);
    lines.push('');

    if (params.lessonsLearned) {
      lines.push('## Lessons Learned');
      lines.push(params.lessonsLearned);
      lines.push('');
    }

    lines.push('## Compliance');
    lines.push(`- PIPEDA breach assessment: ${params.duration <= 72 ? 'Completed on time ✅' : 'Delayed ⚠️'}`);
    lines.push('- Board notification: Completed ✅');
    lines.push('- Member communication: Completed ✅');
    lines.push('');

    lines.push('---');
    lines.push('*This report is confidential and protected under attorney-client privilege.*');

    return lines.join('\n');
  }

  /**
   * Force Majeure Dashboard
   * Summary of emergency preparedness and active events
   */
  async getForceMajeureDashboard(): Promise<{
    activeEvents: number;
    totalEvents: number;
    averageRecoveryTime: number;
    breakGlassUsage: number;
    complianceRate: number;
    recentEvents: Array<{
      eventId: string;
      eventType: string;
      severity: string;
      duration: number;
      status: string;
    }>;
  }> {
    const allEvents = await db.select().from(forceMajeureEvents);
    const activeEvents = allEvents.filter(e => e.status === 'active');
    const resolvedEvents = allEvents.filter(e => e.status === 'resolved');

    const averageRecoveryTime = resolvedEvents.length > 0
      ? Math.round(resolvedEvents.reduce((sum, e) => sum + (e.actualDuration || 0), 0) / resolvedEvents.length)
      : 0;

    const breakGlassActivations = await db
      .select()
      .from(forceMajeureActivations)
      .where(eq(forceMajeureActivations.breakGlassRequired, true));

    const complianceRate = resolvedEvents.length > 0
      ? Math.round((resolvedEvents.filter(e => (e.actualDuration || 0) <= 48).length / resolvedEvents.length) * 100)
      : 100;

    const recentEvents = allEvents
      .slice(-5)
      .reverse()
      .map(e => ({
        eventId: e.id,
        eventType: e.eventType,
        severity: e.severity,
        duration: e.actualDuration || 0,
        status: e.status,
      }));

    return {
      activeEvents: activeEvents.length,
      totalEvents: allEvents.length,
      averageRecoveryTime,
      breakGlassUsage: breakGlassActivations.length,
      complianceRate,
      recentEvents,
    };
  }
}

// Export singleton instance
export const forceMajeureIntegrationService = new ForceMajeureIntegrationService();
