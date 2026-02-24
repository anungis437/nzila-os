import { db } from "@/db";
import {
  provincialPrivacyConfig,
  provincialConsent,
  privacyBreaches,
  provincialDataHandling,
  dataSubjectAccessRequests,
} from "@/db/schema/provincial-privacy-schema";
import { eq, and, lte, isNull } from "drizzle-orm";
import { organizationMembers } from "@/db/schema/organization-members-schema";
import { NotificationService } from "@/lib/services/notification-service";
import { logger } from "@/lib/logger";

/**
 * Provincial Privacy Service
 * Handles PIPEDA, AB/BC PIPA, Quebec Law 25, Ontario PHIPA compliance
 */

export type Province = "AB" | "BC" | "MB" | "NB" | "NL" | "NS" | "NT" | "NU" | "ON" | "PE" | "QC" | "SK" | "YT";

export interface ConsentRequest {
  userId: string;
  province: Province;
  consentType: string;
  consentGiven: boolean;
  consentMethod: string;
  consentText: string;
  consentLanguage: "en" | "fr";
  ipAddress?: string;
  userAgent?: string;
}

export interface BreachNotification {
  breachType: string;
  severity: "low" | "medium" | "high" | "critical";
  affectedProvince?: Province;
  affectedUserCount: number;
  dataTypes: string[];
  breachDescription: string;
  discoveredAt: Date;
  reportedBy: string;
}

export class ProvincialPrivacyService {
  /**
   * Get privacy configuration for a specific province
   */
  static async getProvinceConfig(province: Province) {
    const config = await db
      .select()
      .from(provincialPrivacyConfig)
      .where(eq(provincialPrivacyConfig.province, province))
      .limit(1);

    return config[0] || this.getDefaultConfig(province);
  }

  /**
   * Default configurations for each province
   */
  private static getDefaultConfig(province: Province) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaults: Record<Province, any> = {
      QC: {
        province: "QC",
        lawName: "Law 25 (Quebec)",
        consentRequired: true,
        explicitOptIn: true, // Quebec requires explicit consent
        dataRetentionDays: "365",
        breachNotificationHours: "72",
        rightToErasure: true,
        rightToPortability: true,
        dpoRequired: true, // Privacy officer required in Quebec
        piaRequired: true, // Privacy Impact Assessment for high-risk processing
        customRules: {
          biometricConsent: "mandatory_explicit",
          minorAge: 14, // Age of consent in Quebec
          frenchLanguageRequired: true,
        },
      },
      ON: {
        province: "ON",
        lawName: "PHIPA (Ontario)",
        consentRequired: true,
        explicitOptIn: false,
        dataRetentionDays: "730", // 2 years for health data
        breachNotificationHours: "72",
        rightToErasure: true,
        rightToPortability: true,
        dpoRequired: false,
        piaRequired: true,
        customRules: {
          healthDataSpecialRules: true,
          lockedBoxRule: true, // PHIPA's "locked box" for health records
        },
      },
      BC: {
        province: "BC",
        lawName: "BC PIPA",
        consentRequired: true,
        explicitOptIn: false,
        dataRetentionDays: "365",
        breachNotificationHours: "72",
        rightToErasure: true,
        rightToPortability: false, // BC PIPA doesn't mandate portability
        dpoRequired: false,
        piaRequired: false,
        customRules: {
          impliedConsentAllowed: true,
        },
      },
      AB: {
        province: "AB",
        lawName: "AB PIPA",
        consentRequired: true,
        explicitOptIn: false,
        dataRetentionDays: "365",
        breachNotificationHours: "72",
        rightToErasure: true,
        rightToPortability: false,
        dpoRequired: false,
        piaRequired: false,
        customRules: {
          impliedConsentAllowed: true,
        },
      },
      // Federal PIPEDA applies to other provinces
      MB: this.getPipedaDefault("MB"),
      NB: this.getPipedaDefault("NB"),
      NL: this.getPipedaDefault("NL"),
      NS: this.getPipedaDefault("NS"),
      NT: this.getPipedaDefault("NT"),
      NU: this.getPipedaDefault("NU"),
      PE: this.getPipedaDefault("PE"),
      SK: this.getPipedaDefault("SK"),
      YT: this.getPipedaDefault("YT"),
    };

    return defaults[province];
  }

  private static getPipedaDefault(province: Province) {
    return {
      province,
      lawName: "PIPEDA (Federal)",
      consentRequired: true,
      explicitOptIn: false,
      dataRetentionDays: "365",
      breachNotificationHours: "72",
      rightToErasure: true,
      rightToPortability: true,
      dpoRequired: false,
      piaRequired: false,
      customRules: {
        impliedConsentAllowed: true,
        federalJurisdiction: true,
      },
    };
  }

  /**
   * Record user consent
   */
  static async recordConsent(request: ConsentRequest) {
    const config = await this.getProvinceConfig(request.province);

    // Validate Quebec explicit consent requirement
    if (config.explicitOptIn && request.consentMethod === "implied_action") {
      throw new Error("Quebec Law 25 requires explicit consent, not implied consent");
    }

    // Calculate expiry for Quebec (1 year for marketing consent)
    let expiresAt: Date | null = null;
    if (request.province === "QC" && request.consentType === "marketing") {
      expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    const [consent] = await db
      .insert(provincialConsent)
      .values({
        userId: request.userId,
        province: request.province,
        consentType: request.consentType,
        consentGiven: request.consentGiven,
        consentMethod: request.consentMethod,
        consentText: request.consentText,
        consentLanguage: request.consentLanguage,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        expiresAt,
      })
      .returning();

    return consent;
  }

  /**
   * Check if user has valid consent for a specific action
   */
  static async hasValidConsent(userId: string, province: Province, consentType: string): Promise<boolean> {
    const consents = await db
      .select()
      .from(provincialConsent)
      .where(
        and(
          eq(provincialConsent.userId, userId),
          eq(provincialConsent.province, province),
          eq(provincialConsent.consentType, consentType),
          eq(provincialConsent.consentGiven, true)
        )
      )
      .orderBy(provincialConsent.createdAt);

    if (consents.length === 0) return false;

    const latestConsent = consents[consents.length - 1];

    // Check if consent has been revoked
    if (latestConsent.revokedAt) return false;

    // Check if consent has expired (Quebec Law 25)
    if (latestConsent.expiresAt && new Date() > latestConsent.expiresAt) {
      return false;
    }

    return true;
  }

  /**
   * Revoke user consent
   */
  static async revokeConsent(userId: string, province: Province, consentType: string) {
    await db
      .update(provincialConsent)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(provincialConsent.userId, userId),
          eq(provincialConsent.province, province),
          eq(provincialConsent.consentType, consentType)
        )
      );
  }

  /**
   * Report a privacy breach (72-hour notification deadline)
   */
  static async reportBreach(breach: BreachNotification) {
    // Calculate 72-hour deadline
    const notificationDeadline = new Date(breach.discoveredAt);
    notificationDeadline.setHours(notificationDeadline.getHours() + 72);

    // Determine if regulator notification is required
    const regulatorNotificationRequired =
      breach.severity === "high" ||
      breach.severity === "critical" ||
      breach.affectedUserCount > 500 ||
      breach.dataTypes.some((type) =>
        ["sin", "health", "biometric", "financial", "password"].includes(type)
      );

    const [breachRecord] = await db
      .insert(privacyBreaches)
      .values({
        breachType: breach.breachType,
        severity: breach.severity,
        affectedProvince: breach.affectedProvince,
        affectedUserCount: breach.affectedUserCount.toString(),
        dataTypes: breach.dataTypes,
        breachDescription: breach.breachDescription,
        discoveredAt: breach.discoveredAt,
        notificationDeadline,
        reportedBy: breach.reportedBy,
        userNotificationRequired: breach.affectedUserCount > 0,
        regulatorNotificationRequired,
      })
      .returning();

    // Auto-trigger notifications if deadline is approaching
    const hoursUntilDeadline =
      (notificationDeadline.getTime() - Date.now()) / (1000 * 60 * 60);
    if (hoursUntilDeadline < 24) {
      // Trigger urgent notification workflow
      await this.triggerUrgentBreachNotification(breachRecord.id);
    }

    return breachRecord;
  }

  /**
   * Mark breach notifications as sent
   */
  static async markBreachNotificationSent(
    breachId: string,
    notificationType: "users" | "regulator"
  ) {
    const now = new Date();
    const updateData =
      notificationType === "users"
        ? { usersNotifiedAt: now }
        : { regulatorNotifiedAt: now };

    await db
      .update(privacyBreaches)
      .set(updateData)
      .where(eq(privacyBreaches.id, breachId));

    // Check if deadline was met
    const breach = await db
      .select()
      .from(privacyBreaches)
      .where(eq(privacyBreaches.id, breachId))
      .limit(1);

    if (breach[0]) {
      const deadlineMet = now <= breach[0].notificationDeadline;
      await db
        .update(privacyBreaches)
        .set({ deadlineMet })
        .where(eq(privacyBreaches.id, breachId));
    }
  }

  /**
   * Log data handling action for audit trail
   */
  static async logDataHandling(params: {
    userId: string;
    province: Province;
    actionType: string;
    dataCategory: string;
    purpose: string;
    legalBasis: string;
    performedBy: string;
    sharedWith?: string;
    ipAddress?: string;
  }) {
    await db.insert(provincialDataHandling).values({
      userId: params.userId,
      province: params.province,
      actionType: params.actionType,
      dataCategory: params.dataCategory,
      purpose: params.purpose,
      legalBasis: params.legalBasis,
      performedBy: params.performedBy,
      sharedWith: params.sharedWith,
      ipAddress: params.ipAddress,
    });
  }

  /**
   * Create Data Subject Access Request (DSAR)
   */
  static async createDSAR(params: {
    userId: string;
    requestType: "access" | "rectification" | "erasure" | "portability" | "restriction";
    province: Province;
    requestDescription?: string;
    requestedDataTypes?: string[];
  }) {
    // 30-day response deadline (standard across provinces)
    const responseDeadline = new Date();
    responseDeadline.setDate(responseDeadline.getDate() + 30);

    const [dsar] = await db
      .insert(dataSubjectAccessRequests)
      .values({
        userId: params.userId,
        requestType: params.requestType,
        province: params.province,
        requestDescription: params.requestDescription,
        requestedDataTypes: params.requestedDataTypes,
        responseDeadline,
        status: "pending",
      })
      .returning();

    return dsar;
  }

  /**
   * Update DSAR status
   */
  static async updateDSARStatus(
    dsarId: string,
    status: "in_progress" | "completed" | "denied",
    assignedTo?: string
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = { status, updatedAt: new Date() };
    if (assignedTo) updateData.assignedTo = assignedTo;

    if (status === "completed") {
      updateData.respondedAt = new Date();

      // Check if deadline was met
      const dsar = await db
        .select()
        .from(dataSubjectAccessRequests)
        .where(eq(dataSubjectAccessRequests.id, dsarId))
        .limit(1);

      if (dsar[0]) {
        updateData.deadlineMet = new Date() <= dsar[0].responseDeadline;
      }
    }

    await db
      .update(dataSubjectAccessRequests)
      .set(updateData)
      .where(eq(dataSubjectAccessRequests.id, dsarId));
  }

  /**
   * Get overdue DSARs (approaching 30-day deadline)
   */
  static async getOverdueDSARs() {
    const now = new Date();
    return await db
      .select()
      .from(dataSubjectAccessRequests)
      .where(
        and(
          eq(dataSubjectAccessRequests.status, "pending"),
          lte(dataSubjectAccessRequests.responseDeadline, now)
        )
      );
  }

  /**
   * Get breaches approaching 72-hour deadline
   */
  static async getBreachesApproachingDeadline() {
    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    return await db
      .select()
      .from(privacyBreaches)
      .where(
        and(
            isNull(privacyBreaches.usersNotifiedAt),
          lte(privacyBreaches.notificationDeadline, in24Hours)
        )
      );
  }

  /**
   * Trigger urgent breach notification (internal - integrated with notification system)
   */
  private static async triggerUrgentBreachNotification(breachId: string) {
    logger.warn('URGENT: Breach approaching 72-hour notification deadline', { breachId });
    
    try {
      // Get breach details
      const [breach] = await db
        .select()
        .from(privacyBreaches)
        .where(eq(privacyBreaches.id, breachId))
        .limit(1);
      
      if (breach) {
        const orgMember = await db
          .select({ organizationId: organizationMembers.organizationId })
          .from(organizationMembers)
          .where(eq(organizationMembers.userId, breach.reportedBy))
          .limit(1);

        const organizationId = orgMember[0]?.organizationId;
        if (!organizationId) {
          logger.warn('No organization found for breach reporter', { breachId, reportedBy: breach.reportedBy });
          return;
        }

        const notificationService = new NotificationService();
        
        // Notify privacy officer/DPO
        await notificationService.send({
          organizationId,
          recipientEmail: process.env.PRIVACY_OFFICER_EMAIL || process.env.DPO_EMAIL || process.env.ADMIN_EMAIL || 'admin@unioneyes.app',
          type: 'email',
          priority: 'urgent',
          subject: '⚠️ URGENT: Privacy Breach Notification Deadline Approaching',
          body: `URGENT: Privacy breach ${breachId} is approaching the 72-hour notification deadline.\n\nBreach Type: ${breach.breachType}\nSeverity: ${breach.severity}\nDiscovered: ${breach.discoveredAt?.toLocaleString()}\nDeadline: ${breach.notificationDeadline?.toLocaleString()}\n\nImmediate action required to comply with notification requirements.`,
          htmlBody: `
            <h2 style="color: red;">⚠️ URGENT: Privacy Breach Notification Deadline Approaching</h2>
            <p><strong>A privacy breach is approaching the 72-hour notification deadline.</strong></p>
            <ul>
              <li><strong>Breach ID:</strong> ${breachId}</li>
              <li><strong>Breach Type:</strong> ${breach.breachType}</li>
              <li><strong>Severity:</strong> ${breach.severity}</li>
              <li><strong>Discovered:</strong> ${breach.discoveredAt?.toLocaleString()}</li>
              <li><strong>Notification Deadline:</strong> ${breach.notificationDeadline?.toLocaleString()}</li>
              <li><strong>Affected Records:</strong> ${breach.affectedUserCount}</li>
            </ul>
            <p><strong style="color: red;">IMMEDIATE ACTION REQUIRED</strong> to comply with notification requirements under provincial privacy legislation.</p>
          `,
          metadata: {
            breachId,
            breachType: breach.breachType,
            severity: breach.severity,
            notificationDeadline: breach.notificationDeadline?.toISOString(),
          },
        });
      }
    } catch (error) {
      logger.error('Failed to send urgent breach notification', { error, breachId });
      // Log but don't throw - this is a background notification
    }
  }
}
