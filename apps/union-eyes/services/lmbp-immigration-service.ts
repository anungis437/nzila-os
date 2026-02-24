// LMBP Immigration Service
// Canada Federal Immigration compliance: Foreign worker tracking, LMBP letters, GSS applications, mentorship KPIs

import { db } from '@/db';
import {
  foreignWorkers,
  lmbpLetters,
  gssApplications,
  mentorships,
  lmbpComplianceAlerts,
  lmbpComplianceReports,
  type NewForeignWorker,
  type _NewLMBPLetter,
  type NewGSSApplication,
  type NewMentorship,
  type _NewLMBPComplianceAlert,
} from '@/db/schema/lmbp-immigration-schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';

/**
 * LMBP Immigration Service
 * 
 * Canada Federal Immigration compliance:
 * - Foreign worker tracking (work permits, LMIA/GSS)
 * - Labour Market Benefits Plan (LMBP) letter generation
 * - Global Skills Strategy (GSS) 2-week processing tracking
 * - Skills transfer mentorship KPIs
 * - IRCC compliance reporting
 */

export class LMBPImmigrationService {
  /**
   * Register Foreign Worker
   * Create new foreign worker record with immigration details
   */
  async registerForeignWorker(data: NewForeignWorker) {
    const [worker] = await db.insert(foreignWorkers).values(data).returning();
    
    // Check if LMBP letter required (employers with 10+ foreign workers)
    await this.checkLMBPRequirement(data.employerId);
    
    // Create compliance alerts for work permit expiry (90 days before)
    const expiryAlert = new Date(data.workPermitExpiry);
    expiryAlert.setDate(expiryAlert.getDate() - 90);
    
    await db.insert(lmbpComplianceAlerts).values({
      alertType: 'work_permit_expiry',
      severity: 'high',
      foreignWorkerId: worker.id,
      employerId: data.employerId,
      title: `Work permit expiring: ${data.firstName} ${data.lastName}`,
      description: `Work permit expires on ${data.workPermitExpiry.toISOString().split('T')[0]}. Renewal required.`,
      recommendedAction: 'Begin work permit renewal process 120 days before expiry',
      dueDate: data.workPermitExpiry,
      triggeredAt: expiryAlert,
    });
    
    return worker;
  }

  /**
   * Check LMBP Requirement
   * Employers hiring 10+ foreign workers in 12 months must provide Labour Market Benefits Plan
   */
  async checkLMBPRequirement(employerId: string) {
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    const workerCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(foreignWorkers)
      .where(
        and(
          eq(foreignWorkers.employerId, employerId),
          gte(foreignWorkers.startDate, oneYearAgo)
        )
      );
    
    const count = Number(workerCount[0]?.count || 0);
    
    if (count >= 10) {
      // Check if LMBP letter already generated
      const existingLetter = await db
        .select()
        .from(lmbpLetters)
        .where(
          and(
            eq(lmbpLetters.employerId, employerId),
            eq(lmbpLetters.complianceStatus, 'active')
          )
        )
        .limit(1);
      
      if (existingLetter.length === 0) {
        // Create alert: LMBP letter required
        await db.insert(lmbpComplianceAlerts).values({
          alertType: 'lmbp_letter_missing',
          severity: 'critical',
          employerId,
          title: 'LMBP Letter Required',
          description: `Employer has hired ${count} foreign workers in the past 12 months. Labour Market Benefits Plan (LMBP) letter required by IRCC.`,
          recommendedAction: 'Generate LMBP letter with commitments for skills transfer, Canadian hiring, and training investment.',
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        });
      }
    }
  }

  /**
   * Generate LMBP Letter
   * Create Labour Market Benefits Plan letter for employer
   * Required for employers hiring 10+ foreign workers
   */
  async generateLMBPLetter(data: {
    employerId: string;
    employerName: string;
    commitments: Array<{
      type: 'skills_transfer' | 'hiring' | 'investment' | 'other';
      description: string;
      kpi: string;
      deadline?: Date;
    }>;
    foreignWorkerIds: string[];
    validityYears?: number;
  }) {
    const validFrom = new Date();
    const validUntil = new Date();
    validUntil.setFullYear(validUntil.getFullYear() + (data.validityYears || 2));
    
    // Generate letter number (format: LMBP-YYYY-NNNNNN)
    const year = validFrom.getFullYear();
    const randomNum = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const letterNumber = `LMBP-${year}-${randomNum}`;
    
    // Calculate compliance report due date (1 year from valid_from)
    const complianceReportDue = new Date(validFrom);
    complianceReportDue.setFullYear(complianceReportDue.getFullYear() + 1);
    
    const [letter] = await db.insert(lmbpLetters).values({
      employerId: data.employerId,
      employerName: data.employerName,
      letterNumber,
      generatedDate: validFrom,
      validFrom,
      validUntil,
      commitments: data.commitments,
      foreignWorkerIds: data.foreignWorkerIds,
      complianceReportDue,
      complianceStatus: 'active',
    }).returning();
    
    // Update foreign workers with LMBP letter reference
    await db
      .update(foreignWorkers)
      .set({
        requiresLMBP: true,
        lmbpLetterGenerated: true,
        lmbpLetterDate: validFrom,
      })
      .where(
        sql`${foreignWorkers.id} = ANY(${data.foreignWorkerIds})`
      );
    
    // Create alert for annual compliance report
    await db.insert(lmbpComplianceAlerts).values({
      alertType: 'compliance_report_due',
      severity: 'medium',
      lmbpLetterId: letter.id,
      employerId: data.employerId,
      title: 'LMBP Annual Compliance Report Due',
      description: `Annual compliance report for LMBP letter ${letterNumber} due on ${complianceReportDue.toISOString().split('T')[0]}`,
      recommendedAction: 'Prepare annual report documenting progress on LMBP commitments',
      dueDate: complianceReportDue,
    });
    
    return letter;
  }

  /**
   * Track GSS Application
   * Monitor Global Skills Strategy 2-week processing commitment
   * Canada promises 10 business days for GSS Category A/B applications
   */
  async trackGSSApplication(data: NewGSSApplication) {
    // Calculate expected decision date (10 business days from submission)
    const expectedDecisionDate = this.addBusinessDays(data.submissionDate, 10);
    
    const [application] = await db.insert(gssApplications).values({
      ...data,
      expectedDecisionDate,
    }).returning();
    
    // Create alert if decision not received by expected date
    await db.insert(lmbpComplianceAlerts).values({
      alertType: 'gss_delay',
      severity: 'medium',
      gssApplicationId: application.id,
      foreignWorkerId: data.foreignWorkerId,
      employerId: data.employerId,
      title: 'GSS Application Decision Pending',
      description: `GSS application ${data.applicationNumber} submitted on ${data.submissionDate.toISOString().split('T')[0]}. Expected decision by ${expectedDecisionDate.toISOString().split('T')[0]}.`,
      recommendedAction: 'Contact IRCC if decision not received within 2 weeks',
      dueDate: expectedDecisionDate,
    });
    
    return application;
  }

  /**
   * Update GSS Application Status
   * Record decision and calculate processing time
   */
  async updateGSSApplicationStatus(
    applicationId: string,
    status: 'approved' | 'denied' | 'withdrawn',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    decisionDetails?: any
  ) {
    const application = await db
      .select()
      .from(gssApplications)
      .where(eq(gssApplications.id, applicationId))
      .limit(1);
    
    if (!application[0]) {
      throw new Error('GSS application not found');
    }
    
    const actualDecisionDate = new Date();
    const submissionDate = application[0].submissionDate;
    const processingDays = this.calculateBusinessDays(submissionDate, actualDecisionDate);
    const met2WeekTarget = processingDays <= 10;
    
    await db
      .update(gssApplications)
      .set({
        status,
        actualDecisionDate,
        processingDays,
        met2WeekTarget,
        decisionDetails,
      })
      .where(eq(gssApplications.id, applicationId));
    
    // Resolve pending GSS delay alert
    await db
      .update(lmbpComplianceAlerts)
      .set({
        status: 'resolved',
        resolvedAt: actualDecisionDate,
        resolution: `GSS application ${status}. Processed in ${processingDays} business days. ${met2WeekTarget ? 'Met 2-week target ✅' : 'Exceeded 2-week target ⚠️'}`,
      })
      .where(
        and(
          eq(lmbpComplianceAlerts.gssApplicationId, applicationId),
          eq(lmbpComplianceAlerts.alertType, 'gss_delay'),
          eq(lmbpComplianceAlerts.status, 'open')
        )
      );
    
    return { processingDays, met2WeekTarget };
  }

  /**
   * Create Mentorship Program
   * Pair foreign worker with Canadian mentor for skills transfer (LMBP requirement)
   */
  async createMentorship(data: NewMentorship) {
    const [mentorship] = await db.insert(mentorships).values(data).returning();
    
    // Update foreign worker with mentorship details
    await db
      .update(foreignWorkers)
      .set({
        skillsTransferPlan: {
          mentorId: data.mentorId,
          goals: data.skillsToTransfer,
          timeline: `${data.startDate.toISOString().split('T')[0]} to ${data.endDate?.toISOString().split('T')[0] || 'ongoing'}`,
        },
        mentorshipStartDate: data.startDate,
        mentorshipEndDate: data.endDate,
      })
      .where(eq(foreignWorkers.id, data.menteeId));
    
    return mentorship;
  }

  /**
   * Track Skills Transfer KPIs
   * Monitor mentorship progress for LMBP compliance
   */
  async trackSkillsTransferKPIs(mentorshipId: string, updates: {
    totalMeetings?: number;
    lastMeetingDate?: Date;
    completionPercentage?: number;
    canadianWorkerTrained?: boolean;
    knowledgeTransferDocumented?: boolean;
  }) {
    await db
      .update(mentorships)
      .set(updates)
      .where(eq(mentorships.id, mentorshipId));
    
    // Check for mentorship completion
    if (updates.completionPercentage === 100) {
      await db
        .update(mentorships)
        .set({
          status: 'completed',
          actualEndDate: new Date(),
        })
        .where(eq(mentorships.id, mentorshipId));
      
      // Update foreign worker compliance status
      const mentorship = await db
        .select()
        .from(mentorships)
        .where(eq(mentorships.id, mentorshipId))
        .limit(1);
      
      if (mentorship[0]) {
        await db
          .update(foreignWorkers)
          .set({
            complianceStatus: 'compliant',
            lastComplianceCheck: new Date(),
            complianceNotes: 'Skills transfer mentorship completed successfully',
          })
          .where(eq(foreignWorkers.id, mentorship[0].menteeId));
      }
    }
  }

  /**
   * Flag LMBP Non-Compliance
   * Create alert for missing or incomplete LMBP requirements
   */
  async flagLMBPNonCompliance(data: {
    employerId?: string;
    foreignWorkerId?: string;
    lmbpLetterId?: string;
    mentorshipId?: string;
    issue: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    recommendedAction: string;
    dueDate?: Date;
  }) {
    const alert = await db.insert(lmbpComplianceAlerts).values({
      alertType: 'mentorship_incomplete',
      severity: data.severity,
      employerId: data.employerId,
      foreignWorkerId: data.foreignWorkerId,
      lmbpLetterId: data.lmbpLetterId,
      mentorshipId: data.mentorshipId,
      title: 'LMBP Compliance Issue',
      description: data.issue,
      recommendedAction: data.recommendedAction,
      dueDate: data.dueDate,
    }).returning();
    
    return alert;
  }

  /**
   * Generate LMBP Compliance Report
   * Annual report to IRCC documenting progress on LMBP commitments
   */
  async generateLMBPComplianceReport(data: {
    lmbpLetterId: string;
    reportingPeriodStart: Date;
    reportingPeriodEnd: Date;
  }) {
    const letter = await db
      .select()
      .from(lmbpLetters)
      .where(eq(lmbpLetters.id, data.lmbpLetterId))
      .limit(1);
    
    if (!letter[0]) {
      throw new Error('LMBP letter not found');
    }
    
    // Calculate metrics for reporting period
    const totalForeignWorkers = (letter[0].foreignWorkerIds as string[]).length;
    
    const mentorshipsData = await db
      .select()
      .from(mentorships)
      .where(
        and(
          eq(mentorships.employerId, letter[0].employerId),
          gte(mentorships.startDate, data.reportingPeriodStart),
          lte(mentorships.startDate, data.reportingPeriodEnd)
        )
      );
    
    const totalMentorships = mentorshipsData.length;
    const mentorshipsCompleted = mentorshipsData.filter(m => m.status === 'completed').length;
    
    // Create report
    const [report] = await db.insert(lmbpComplianceReports).values({
      lmbpLetterId: data.lmbpLetterId,
      employerId: letter[0].employerId,
      reportingPeriodStart: data.reportingPeriodStart,
      reportingPeriodEnd: data.reportingPeriodEnd,
      commitmentProgress: [], // To be filled by employer
      totalForeignWorkers,
      totalMentorships,
      mentorshipsCompleted,
      canadianWorkersHired: 0, // To be filled by employer
      trainingInvestment: '0',
    }).returning();
    
    return report;
  }

  /**
   * Get Compliance Dashboard
   * Overview of LMBP/GSS compliance for employer
   */
  async getComplianceDashboard(employerId: string) {
    const workers = await db
      .select()
      .from(foreignWorkers)
      .where(eq(foreignWorkers.employerId, employerId));
    
    const letters = await db
      .select()
      .from(lmbpLetters)
      .where(eq(lmbpLetters.employerId, employerId));
    
    const gssApps = await db
      .select()
      .from(gssApplications)
      .where(eq(gssApplications.employerId, employerId));
    
    const mentorshipsData = await db
      .select()
      .from(mentorships)
      .where(eq(mentorships.employerId, employerId));
    
    const alerts = await db
      .select()
      .from(lmbpComplianceAlerts)
      .where(
        and(
          eq(lmbpComplianceAlerts.employerId, employerId),
          eq(lmbpComplianceAlerts.status, 'open')
        )
      );
    
    // Calculate GSS 2-week target performance
    const completedGSSApps = gssApps.filter(app => app.actualDecisionDate);
    const met2WeekTarget = completedGSSApps.filter(app => app.met2WeekTarget).length;
    const gss2WeekPerformance = completedGSSApps.length > 0
      ? Math.round((met2WeekTarget / completedGSSApps.length) * 100)
      : 100;
    
    return {
      totalForeignWorkers: workers.length,
      activeWorkPermits: workers.filter(w => w.workPermitExpiry > new Date()).length,
      expiringWorkPermits: workers.filter(w => {
        const daysUntilExpiry = Math.floor((w.workPermitExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysUntilExpiry <= 90 && daysUntilExpiry > 0;
      }).length,
      lmbpLetters: {
        total: letters.length,
        active: letters.filter(l => l.complianceStatus === 'active').length,
        expired: letters.filter(l => l.validUntil < new Date()).length,
      },
      gssApplications: {
        total: gssApps.length,
        pending: gssApps.filter(app => !app.actualDecisionDate).length,
        approved: gssApps.filter(app => app.status === 'approved').length,
        met2WeekTarget: gss2WeekPerformance,
      },
      mentorships: {
        total: mentorshipsData.length,
        active: mentorshipsData.filter(m => m.status === 'active').length,
        completed: mentorshipsData.filter(m => m.status === 'completed').length,
        avgCompletionRate: Math.round(
          mentorshipsData.reduce((sum, m) => sum + (m.completionPercentage || 0), 0) / (mentorshipsData.length || 1)
        ),
      },
      complianceAlerts: {
        total: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
      },
    };
  }

  // Helper: Add business days to date
  private addBusinessDays(date: Date, days: number): Date {
    const result = new Date(date);
    let addedDays = 0;
    
    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      // Skip weekends
      if (result.getDay() !== 0 && result.getDay() !== 6) {
        addedDays++;
      }
    }
    
    return result;
  }

  // Helper: Calculate business days between dates
  private calculateBusinessDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    
    while (current < end) {
      if (current.getDay() !== 0 && current.getDay() !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  }
}

// Export singleton instance
export const lmbpImmigrationService = new LMBPImmigrationService();
