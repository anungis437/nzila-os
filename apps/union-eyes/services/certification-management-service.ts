import { db } from "@/db";
import {
  certificationTypes,
  staffCertifications,
  continuingEducation,
  licenseRenewals,
  certificationAlerts,
  certificationComplianceReports,
  certificationAuditLog,
} from "@/db/schema/certification-management-schema";
import { eq, and, desc } from "drizzle-orm";

/**
 * Certification & License Management Service
 * Tracks union staff certifications, renewals, and CE requirements
 */

export interface CertificationIssuance {
  userId: string;
  fullName: string;
  role: string;
  certificationTypeId: string;
  certificationNumber: string;
  issuedDate: Date;
  expiryDate?: Date;
  certificateDocument?: string;
}

export interface CECourse {
  userId: string;
  certificationId: string;
  courseTitle: string;
  courseProvider: string;
  courseDate: Date;
  ceHoursEarned: number;
  ceCategory: string;
}

export class CertificationManagementService {
  private static readonly ALERT_DAYS_90 = 90;
  private static readonly ALERT_DAYS_30 = 30;
  private static toDateString(value?: Date): string | undefined {
    return value ? value.toISOString().split('T')[0] : undefined;
  }

  /**
   * Issue new certification to staff member
   */
  static async issueCertification(issuance: CertificationIssuance, issuedBy: string) {
    // Get certification type details
    const certType = await db
      .select()
      .from(certificationTypes)
      .where(eq(certificationTypes.id, issuance.certificationTypeId))
      .limit(1);

    if (certType.length === 0) {
      throw new Error("Certification type not found");
    }

    const type = certType[0];

    // Calculate next renewal date if applicable
    let nextRenewalDue: Date | undefined;
    if (type.requiresRenewal && type.renewalFrequencyMonths) {
      nextRenewalDue = new Date(issuance.issuedDate);
      nextRenewalDue.setMonth(nextRenewalDue.getMonth() + parseInt(type.renewalFrequencyMonths));
    }

    // Create certification record
    const [certification] = await db
      .insert(staffCertifications)
      .values({
        userId: issuance.userId,
        fullName: issuance.fullName,
        role: issuance.role,
        certificationTypeId: issuance.certificationTypeId,
        certificationNumber: issuance.certificationNumber,
        issuedDate: this.toDateString(issuance.issuedDate) as string,
        expiryDate: this.toDateString(issuance.expiryDate),
        nextRenewalDue: this.toDateString(nextRenewalDue),
        status: "active",
        certificateDocument: issuance.certificateDocument,
        compliant: true,
      })
      .returning();

    // Audit log
    await this.logAuditAction({
      actionType: "certification_issued",
      actionDescription: `Certification ${type.certificationName} issued to ${issuance.fullName}`,
      certificationId: certification.id,
      userId: issuance.userId,
      performedBy: issuedBy,
      complianceImpact: "low",
    });

    // Schedule alerts if expiry date exists
    if (issuance.expiryDate) {
      await this.scheduleExpiryAlerts(certification.id, issuance.userId, issuance.expiryDate);
    }

    return certification;
  }

  /**
   * Record continuing education completion
   */
  static async recordCECompletion(ce: CECourse, verifiedBy: string) {
    const [ceRecord] = await db
      .insert(continuingEducation)
      .values({
        userId: ce.userId,
        certificationId: ce.certificationId,
        courseTitle: ce.courseTitle,
        courseProvider: ce.courseProvider,
        courseDate: typeof ce.courseDate === 'string' ? ce.courseDate : ce.courseDate.toISOString().split('T')[0],
        ceHoursEarned: ce.ceHoursEarned.toString(),
        ceCategory: ce.ceCategory,
        verifiedBy,
        verifiedAt: new Date(),
      })
      .returning();

    // Audit log
    await this.logAuditAction({
      actionType: "ce_hours_added",
      actionDescription: `${ce.ceHoursEarned} CE hours added for ${ce.courseTitle}`,
      certificationId: ce.certificationId,
      userId: ce.userId,
      performedBy: verifiedBy,
      complianceImpact: "none",
    });

    return ceRecord;
  }

  /**
   * Check CE hours compliance for certification
   */
  static async checkCECompliance(certificationId: string): Promise<{
    compliant: boolean;
    hoursRequired: number;
    hoursCompleted: number;
    hoursRemaining: number;
  }> {
    // Get certification
    const cert = await db
      .select()
      .from(staffCertifications)
      .where(eq(staffCertifications.id, certificationId))
      .limit(1);

    if (cert.length === 0) {
      throw new Error("Certification not found");
    }

    // Get certification type requirements
    const certType = await db
      .select()
      .from(certificationTypes)
      .where(eq(certificationTypes.id, cert[0].certificationTypeId))
      .limit(1);

    if (certType.length === 0 || !certType[0].continuingEducationRequired) {
      return {
        compliant: true,
        hoursRequired: 0,
        hoursCompleted: 0,
        hoursRemaining: 0,
      };
    }

    const hoursRequired = parseFloat(certType[0].ceHoursRequired || "0");

    // Get CE hours completed in current period
    const ceRecords = await db
      .select()
      .from(continuingEducation)
      .where(eq(continuingEducation.certificationId, certificationId));

    const hoursCompleted = ceRecords.reduce((sum, record) => {
      return sum + parseFloat(record.ceHoursEarned);
    }, 0);

    const hoursRemaining = Math.max(0, hoursRequired - hoursCompleted);

    return {
      compliant: hoursCompleted >= hoursRequired,
      hoursRequired,
      hoursCompleted,
      hoursRemaining,
    };
  }

  /**
   * Initiate certification renewal
   */
  static async initiateRenewal(certificationId: string, initiatedBy: string) {
    const cert = await db
      .select()
      .from(staffCertifications)
      .where(eq(staffCertifications.id, certificationId))
      .limit(1);

    if (cert.length === 0) {
      throw new Error("Certification not found");
    }

    const certification = cert[0];

    // Check CE compliance
    const ceCompliance = await this.checkCECompliance(certificationId);

    // Create renewal record
    const renewalYear = new Date().getFullYear().toString();
    const renewalDueDate = certification.nextRenewalDue || new Date();

    const [renewal] = await db
      .insert(licenseRenewals)
      .values({
        certificationId,
        renewalYear,
        renewalDueDate: this.toDateString(renewalDueDate) as string,
        renewalStatus: "pending",
        ceRequirementsMet: ceCompliance.compliant,
        feePaid: false,
        applicationComplete: false,
      })
      .returning();

    // Audit log
    await this.logAuditAction({
      actionType: "renewal_initiated",
      actionDescription: `Renewal initiated for certification ${certification.certificationNumber}`,
      certificationId,
      userId: certification.userId,
      performedBy: initiatedBy,
      complianceImpact: "medium",
    });

    return renewal;
  }

  /**
   * Complete certification renewal
   */
  static async completeRenewal(
    renewalId: string,
    newExpiryDate: Date,
    approvedBy: string
  ) {
    // Get renewal record
    const renewal = await db
      .select()
      .from(licenseRenewals)
      .where(eq(licenseRenewals.id, renewalId))
      .limit(1);

    if (renewal.length === 0) {
      throw new Error("Renewal not found");
    }

    const renewalRecord = renewal[0];

    // Update renewal status
    const today = new Date().toISOString().split('T')[0];
    await db
      .update(licenseRenewals)
      .set({
        renewalStatus: "approved",
        renewalApprovedDate: today,
        updatedAt: new Date(),
      })
      .where(eq(licenseRenewals.id, renewalId));

    // Update certification
    const cert = await db
      .select()
      .from(staffCertifications)
      .where(eq(staffCertifications.id, renewalRecord.certificationId))
      .limit(1);

    if (cert.length > 0) {
      const certType = await db
        .select()
        .from(certificationTypes)
        .where(eq(certificationTypes.id, cert[0].certificationTypeId))
        .limit(1);

      // Calculate next renewal date
      let nextRenewalDue: Date | undefined;
      if (certType.length > 0 && certType[0].requiresRenewal && certType[0].renewalFrequencyMonths) {
        nextRenewalDue = new Date(newExpiryDate);
        nextRenewalDue.setMonth(nextRenewalDue.getMonth() + parseInt(certType[0].renewalFrequencyMonths));
      }

      const todayDate = new Date().toISOString().split('T')[0];
      await db
        .update(staffCertifications)
        .set({
          status: "active",
          expiryDate: typeof newExpiryDate === 'string' ? newExpiryDate : newExpiryDate.toISOString().split('T')[0],
          lastRenewalDate: todayDate,
          nextRenewalDue: nextRenewalDue ? (typeof nextRenewalDue === 'string' ? nextRenewalDue : nextRenewalDue.toISOString().split('T')[0]) : undefined,
          compliant: true,
          updatedAt: new Date(),
        })
        .where(eq(staffCertifications.id, renewalRecord.certificationId));

      // Schedule new alerts
      await this.scheduleExpiryAlerts(renewalRecord.certificationId, cert[0].userId, newExpiryDate);

      // Audit log
      await this.logAuditAction({
        actionType: "certification_renewed",
        actionDescription: `Certification renewed until ${newExpiryDate.toISOString().split('T')[0]}`,
        certificationId: renewalRecord.certificationId,
        userId: cert[0].userId,
        performedBy: approvedBy,
        complianceImpact: "low",
      });
    }
  }

  /**
   * Schedule expiry alerts (90 days, 30 days, expired)
   */
  private static async scheduleExpiryAlerts(
    certificationId: string,
    userId: string,
    expiryDate: Date
  ) {
    const today = new Date();
    const daysUntilExpiry = Math.floor((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    // 90-day alert
    const expiryDateStr = typeof expiryDate === 'string' ? expiryDate : expiryDate.toISOString().split('T')[0];
    if (daysUntilExpiry <= this.ALERT_DAYS_90 && daysUntilExpiry > this.ALERT_DAYS_30) {
      await db.insert(certificationAlerts).values({
        certificationId,
        userId,
        alertType: "90_day_warning",
        expiryDate: expiryDateStr,
        daysUntilExpiry: daysUntilExpiry.toString(),
        notificationSent: false,
      });
    }

    // 30-day alert
    if (daysUntilExpiry <= this.ALERT_DAYS_30 && daysUntilExpiry > 0) {
      await db.insert(certificationAlerts).values({
        certificationId,
        userId,
        alertType: "30_day_warning",
        expiryDate: expiryDateStr,
        daysUntilExpiry: daysUntilExpiry.toString(),
        notificationSent: false,
      });
    }

    // Expired alert
    if (daysUntilExpiry <= 0) {
      await db.insert(certificationAlerts).values({
        certificationId,
        userId,
        alertType: "expired",
        expiryDate: expiryDateStr,
        daysUntilExpiry: "0",
        notificationSent: false,
      });

      // Mark certification as expired
      await db
        .update(staffCertifications)
        .set({
          status: "expired",
          compliant: false,
          updatedAt: new Date(),
        })
        .where(eq(staffCertifications.id, certificationId));
    }
  }

  /**
   * Get expired certifications
   */
  static async getExpiredCertifications() {
    return await db
      .select()
      .from(staffCertifications)
      .where(eq(staffCertifications.status, "expired"))
      .orderBy(desc(staffCertifications.expiryDate));
  }

  /**
   * Get certifications expiring soon (within 90 days)
   */
  static async getExpiringSoon() {
    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + this.ALERT_DAYS_90);

    const certs = await db
      .select()
      .from(staffCertifications)
      .where(eq(staffCertifications.status, "active"));

    return certs.filter((cert) => {
      if (!cert.expiryDate) return false;
      const expiry = new Date(cert.expiryDate);
      return expiry <= ninetyDaysFromNow;
    });
  }

  /**
   * Generate compliance report
   */
  static async generateComplianceReport(reportPeriod: string, generatedBy: string) {
    const allCerts = await db.select().from(staffCertifications);

    const totalStaff = new Set(allCerts.map((c) => c.userId)).size;
    const totalCertificationsRequired = allCerts.length;
    const totalCertificationsCurrent = allCerts.filter((c) => c.status === "active").length;
    const totalCertificationsExpired = allCerts.filter((c) => c.status === "expired").length;
    const totalCertificationsPendingRenewal = allCerts.filter((c) => c.status === "pending_renewal").length;

    const complianceRate = totalCertificationsRequired > 0
      ? ((totalCertificationsCurrent / totalCertificationsRequired) * 100).toFixed(2)
      : "0.00";

    const expiredCertifications = allCerts
      .filter((c) => c.status === "expired")
      .map((c) => c.id);

    const upcomingRenewals = await this.getExpiringSoon();

    const reportDate = new Date().toISOString().split('T')[0];
    const [report] = await db
      .insert(certificationComplianceReports)
      .values({
        reportDate,
        reportPeriod,
        totalStaff: totalStaff.toString(),
        totalCertificationsRequired: totalCertificationsRequired.toString(),
        totalCertificationsCurrent: totalCertificationsCurrent.toString(),
        totalCertificationsExpired: totalCertificationsExpired.toString(),
        totalCertificationsPendingRenewal: totalCertificationsPendingRenewal.toString(),
        complianceRate,
        expiredCertifications,
        upcomingRenewals: upcomingRenewals.map((c) => c.id),
        generatedBy,
      })
      .returning();

    return report;
  }

  /**
   * Log audit action
   */
  private static async logAuditAction(params: {
    actionType: string;
    actionDescription: string;
    certificationId?: string;
    userId?: string;
    performedBy: string;
    performedByRole?: string;
    complianceImpact?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
  }) {
    await db.insert(certificationAuditLog).values({
      actionType: params.actionType,
      actionDescription: params.actionDescription,
      certificationId: params.certificationId,
      userId: params.userId,
      performedBy: params.performedBy,
      performedByRole: params.performedByRole,
      complianceImpact: params.complianceImpact,
      metadata: params.metadata,
    });
  }

  /**
   * Get all certifications for user
   */
  static async getUserCertifications(userId: string) {
    return await db
      .select()
      .from(staffCertifications)
      .where(eq(staffCertifications.userId, userId))
      .orderBy(desc(staffCertifications.issuedDate));
  }

  /**
   * Get all alerts for user
   */
  static async getUserAlerts(userId: string, resolved: boolean = false) {
    return await db
      .select()
      .from(certificationAlerts)
      .where(
        and(
          eq(certificationAlerts.userId, userId),
          eq(certificationAlerts.resolved, resolved)
        )
      )
      .orderBy(desc(certificationAlerts.createdAt));
  }
}
