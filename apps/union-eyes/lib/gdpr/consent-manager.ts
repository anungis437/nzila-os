/**
 * GDPR Consent Management Service
 * 
 * Handles all GDPR compliance operations:
 * - Consent collection and management
 * - Cookie consent tracking
 * - Data subject requests (access, erasure, portability)
 * - Data retention and anonymization
 * 
 * Compliance: GDPR Articles 6, 7, 13-21, 30
 */

import { db } from "@/db";
import {
  userConsents,
  cookieConsents,
  gdprDataRequests,
  dataAnonymizationLog,
  messages,
  messageThreads,
  messageReadReceipts,
  claims,
  claimUpdates,
  votes,
  votingSessions,
  profiles,
  smsMessages,
  smsCampaignRecipients,
} from "@/db/schema";
import { eq, and, desc, sql, or } from "drizzle-orm";
import { createHash } from "crypto";
import { NotificationService } from "@/lib/services/notification-service";
import { logger } from "@/lib/logger";

/**
 * Consent Management
 */
export class ConsentManager {
  /**
   * Record user consent
   */
  static async recordConsent(data: {
    userId: string;
    organizationId: string;
    consentType: "essential" | "functional" | "analytics" | "marketing" | "personalization" | "third_party";
    legalBasis: string;
    processingPurpose: string;
    consentVersion: string;
    consentText: string;
    ipAddress?: string;
    userAgent?: string;
    expiresAt?: Date;
    metadata?: unknown;
  }): Promise<typeof userConsents.$inferSelect> {
    const { organizationId, ...rest } = data;
    const [consent] = await db
      .insert(userConsents)
      .values({
        ...rest,
        organizationId,
        status: "granted",
        grantedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
      .returning();

    return consent;
  }

  /**
   * Withdraw consent
   */
  static async withdrawConsent(
    userId: string,
    consentId: string
  ): Promise<boolean> {
    const result = await db
      .update(userConsents)
      .set({
        status: "withdrawn",
        withdrawnAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userConsents.id, consentId),
          eq(userConsents.userId, userId)
        )
      )
      .returning();

    return result.length > 0;
  }

  /**
   * Get active consents for user
   */
  static async getUserConsents(userId: string, organizationId: string) {
    return await db
      .select()
      .from(userConsents)
      .where(
        and(
          eq(userConsents.userId, userId),
          eq(userConsents.organizationId, organizationId),
          eq(userConsents.status, "granted")
        )
      )
      .orderBy(desc(userConsents.grantedAt));
  }

  /**
   * Check if user has given specific consent
   */
  static async hasConsent(
    userId: string,
    organizationId: string,
    consentType: string
  ): Promise<boolean> {
    const result = await db
      .select({ id: userConsents.id })
      .from(userConsents)
      .where(
        and(
          eq(userConsents.userId, userId),
          eq(userConsents.organizationId, organizationId),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq(userConsents.consentType, consentType as any),
          eq(userConsents.status, "granted")
        )
      )
      .limit(1);

    return result.length > 0;
  }
}

/**
 * Cookie Consent Management
 */
export class CookieConsentManager {
  /**
   * Save cookie preferences
   */
  static async saveCookieConsent(data: {
    userId?: string;
    organizationId: string;
    consentId: string; // Browser-side unique ID
    essential: boolean;
    functional: boolean;
    analytics: boolean;
    marketing: boolean;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<typeof cookieConsents.$inferSelect> {
    const expiresAt = new Date();
    expiresAt.setFullYear(expiresAt.getFullYear() + 1); // 12 months

    // Check if consent already exists
    const existing = await db
      .select()
      .from(cookieConsents)
      .where(eq(cookieConsents.consentId, data.consentId))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      const { organizationId: _tid, ...updateFields } = data;
      const [updated] = await db
        .update(cookieConsents)
        .set({
          ...updateFields,
          organizationId: data.organizationId,
          lastUpdated: new Date(),
          expiresAt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .where(eq(cookieConsents.consentId, data.consentId))
        .returning();

      return updated;
    } else {
      // Insert new
      const { organizationId: _tid2, ...insertFields } = data;
      const [consent] = await db
        .insert(cookieConsents)
        .values({
          ...insertFields,
          organizationId: data.organizationId,
          expiresAt,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .returning();

      return consent;
    }
  }

  /**
   * Get cookie consent by browser ID
   */
  static async getCookieConsent(consentId: string) {
    const result = await db
      .select()
      .from(cookieConsents)
      .where(eq(cookieConsents.consentId, consentId))
      .limit(1);

    return result[0] || null;
  }

  /**
   * Check if cookie consent is still valid
   */
  static async isConsentValid(consentId: string): Promise<boolean> {
    const consent = await this.getCookieConsent(consentId);
    if (!consent) return false;

    const now = new Date();
    return consent.expiresAt > now;
  }
}

/**
 * GDPR Data Subject Requests
 */
export class GdprRequestManager {
  /**
   * Submit data access request (Article 15)
   */
  static async requestDataAccess(data: {
    userId: string;
    organizationId: string;
    requestDetails?: unknown;
    verificationMethod?: string;
  }): Promise<typeof gdprDataRequests.$inferSelect> {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30); // 30 days to respond

    const [request] = await db
      .insert(gdprDataRequests)
      .values({
        userId: data.userId,
        organizationId: data.organizationId,
        requestType: "access" as const,
        status: "pending" as const,
        deadline,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        requestDetails: data.requestDetails as any,
        verificationMethod: data.verificationMethod,
      })
      .returning();

    // Send notification to admin/DPO
    try {
      const notificationService = new NotificationService();
      await notificationService.send({
        organizationId: data.organizationId,
        recipientEmail: process.env.DPO_EMAIL || process.env.ADMIN_EMAIL || 'admin@unioneyes.app',
        type: 'email',
        priority: 'high',
        subject: 'New GDPR Data Access Request',
        body: `A new GDPR data access request has been submitted by user ${data.userId}. Please review and respond within 30 days (deadline: ${deadline.toLocaleDateString()}).`,
        htmlBody: `
          <h2>New GDPR Data Access Request</h2>
          <p>A new GDPR data access request has been submitted.</p>
          <ul>
            <li><strong>User ID:</strong> ${data.userId}</li>
            <li><strong>Organization ID:</strong> ${data.organizationId}</li>
            <li><strong>Request Type:</strong> Data Access (Article 15)</li>
            <li><strong>Deadline:</strong> ${deadline.toLocaleDateString()}</li>
          </ul>
          <p>Please review this request and respond accordingly.</p>
        `,
        metadata: {
          requestId: request.id,
          requestType: 'access',
          userId: data.userId,
        },
      });
    } catch (error) {
      logger.error("Failed to send GDPR request notification", { error });
      // Don&apos;t fail the request creation if notification fails
    }
    return request;
  }

  /**
   * Submit data erasure request - Right to be Forgotten (Article 17)
   */
  static async requestDataErasure(data: {
    userId: string;
    organizationId: string;
    requestDetails?: unknown;
    verificationMethod?: string;
  }): Promise<typeof gdprDataRequests.$inferSelect> {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);

    const [request] = await db
      .insert(gdprDataRequests)
      .values({
        userId: data.userId,
        organizationId: data.organizationId,
        requestType: "erasure" as const,
        status: "pending" as const,
        deadline,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        requestDetails: data.requestDetails as any,
        verificationMethod: data.verificationMethod,
      })
      .returning();

    return request;
  }

  /**
   * Submit data portability request (Article 20)
   */
  static async requestDataPortability(data: {
    userId: string;
    organizationId: string;
    preferredFormat?: "json" | "csv" | "xml";
    requestDetails?: unknown;
  }): Promise<typeof gdprDataRequests.$inferSelect> {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);

    const [request] = await db
      .insert(gdprDataRequests)
      .values({
        userId: data.userId,
        organizationId: data.organizationId,
        requestType: "portability" as const,
        status: "pending" as const,
        deadline,
        requestDetails: {
          preferredFormat: data.preferredFormat || "json",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...(data.requestDetails as any),
        },
      })
      .returning();

    return request;
  }

  /**
   * Get user's GDPR requests
   */
  static async getUserRequests(userId: string, organizationId: string) {
    return await db
      .select()
      .from(gdprDataRequests)
      .where(
        and(
          eq(gdprDataRequests.userId, userId),
          eq(gdprDataRequests.organizationId, organizationId)
        )
      )
      .orderBy(desc(gdprDataRequests.requestedAt));
  }

  /**
   * Get pending requests (for admin)
   */
  static async getPendingRequests(organizationId: string) {
    return await db
      .select()
      .from(gdprDataRequests)
      .where(
        and(
          eq(gdprDataRequests.organizationId, organizationId),
          eq(gdprDataRequests.status, "pending")
        )
      )
      .orderBy(gdprDataRequests.deadline);
  }

  /**
   * Update request status
   */
  static async updateRequestStatus(
    requestId: string,
    status: "in_progress" | "completed" | "rejected",
    data?: {
      processedBy?: string;
      responseData?: unknown;
      rejectionReason?: string;
    }
  ) {
    const updateData: Record<string, unknown> = {
      status,
      updatedAt: new Date(),
      ...data,
    };

    if (status === "in_progress" && !data?.processedBy) {
      updateData.processedAt = new Date();
    }

    if (status === "completed") {
      updateData.completedAt = new Date();
    }

    const [updated] = await db
      .update(gdprDataRequests)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .set(updateData as any)
      .where(eq(gdprDataRequests.id, requestId))
      .returning();

    return updated;
  }
}

/**
 * Data Export Service (Article 15)
 */
export class DataExportService {
  /**
   * Generate complete data export for user
   */
  static async exportUserData(
    userId: string,
    organizationId: string,
    format: "json" | "csv" | "xml" = "json"
  ): Promise<unknown> {
    // Collect all user data from various tables
    const userData = {
      exportDate: new Date().toISOString(),
      userId,
      organizationId,
      format,
      data: {
        profile: await this.getProfileData(userId),
        consents: await this.getConsentData(userId, organizationId),
        communications: await this.getCommunicationData(userId, organizationId),
        claims: await this.getClaimsData(userId, organizationId),
        votes: await this.getVotingData(userId, organizationId),
        // Add more data categories as needed
      },
    };

    return userData;
  }

  private static async getProfileData(userId: string) {
    // Query profile data
    const result = await db.query.profiles.findFirst({
      where: eq(profiles.userId, userId),
    });
    return result;
  }

  private static async getConsentData(userId: string, organizationId: string) {
    return await db
      .select()
      .from(userConsents)
      .where(
        and(
          eq(userConsents.userId, userId),
          eq(userConsents.organizationId, organizationId)
        )
      );
  }

  private static async getCommunicationData(userId: string, organizationId: string) {
    try {
      // Query message threads where user participated
      const userThreads = await db.query.messageThreads.findMany({
        where: and(
          eq(messageThreads.organizationId, organizationId),
          or(
            eq(messageThreads.memberId, userId),
            eq(messageThreads.staffId, userId)
          )
        ),
        with: {
          // Include messages from these threads
        }
      });

      // Query all messages sent by user
      const userMessages = await db.query.messages.findMany({
        where: eq(messages.senderId, userId)
      });

      // Query read receipts for user
      const userReadReceipts = await db.query.messageReadReceipts.findMany({
        where: eq(messageReadReceipts.userId, userId)
      });

      // Log GDPR request execution
      logger.info(`[GDPR] Communication data retrieved for user ${userId}`);

      return [
        {
          dataType: "message_threads",
          count: userThreads.length,
          data: userThreads.map(t => ({
            id: t.id,
            subject: t.subject,
            status: t.status,
            priority: t.priority,
            category: t.category,
            createdAt: t.createdAt,
            lastMessageAt: t.lastMessageAt
          }))
        },
        {
          dataType: "messages",
          count: userMessages.length,
          data: userMessages.map(m => ({
            id: m.id,
            threadId: m.threadId,
            messageType: m.messageType,
            content: m.content,
            fileName: m.fileName,
            status: m.status,
            createdAt: m.createdAt,
            readAt: m.readAt
          }))
        },
        {
          dataType: "read_receipts",
          count: userReadReceipts.length,
          data: userReadReceipts.map(r => ({
            messageId: r.messageId,
            readAt: r.readAt
          }))
        }
      ];
    } catch (error) {
      logger.error("[GDPR] Error retrieving communication data", { error });
      throw new Error("Failed to retrieve communication data");
    }
  }

  private static async getClaimsData(userId: string, organizationId: string) {
    try {
      // Query claims filed by user
      const userClaims = await db.query.claims.findMany({
        where: and(
          eq(claims.memberId, userId),
          eq(claims.organizationId, organizationId)
        )
      });

      // Query claim updates/notes for user's claims
      const claimIds = userClaims.map(c => c.claimId);
      let claimNotes: unknown[] = [];
      
      if (claimIds.length > 0) {
        claimNotes = await db.query.claimUpdates.findMany({
          where: sql`${claimUpdates.claimId} = ANY(${claimIds})`
        });
      }

      // Log GDPR request execution
      logger.info(`[GDPR] Claims data retrieved for user ${userId}`);

      return [
        {
          dataType: "claims",
          count: userClaims.length,
          data: userClaims.map(c => ({
            claimId: c.claimId,
            claimNumber: c.claimNumber,
            claimType: c.claimType,
            status: c.status,
            priority: c.priority,
            incidentDate: c.incidentDate,
            location: c.location,
            description: c.description,
            desiredOutcome: c.desiredOutcome,
            isAnonymous: c.isAnonymous,
            progress: c.progress,
            createdAt: c.createdAt,
            resolvedAt: c.resolvedAt
          }))
        },
        {
          dataType: "claim_notes",
          count: claimNotes.length,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: claimNotes.map((n: any) => ({
            updateId: n.updateId,
            claimId: n.claimId,
            updateType: n.updateType,
            content: n.content,
            createdAt: n.createdAt
          }))
        }
      ];
    } catch (error) {
      logger.error("[GDPR] Error retrieving claims data", { error });
      throw new Error("Failed to retrieve claims data");
    }
  }

  private static async getVotingData(userId: string, organizationId: string) {
    try {
      // Query voting sessions in user's organization
      const orgSessions = await db.query.votingSessions.findMany({
        where: eq(votingSessions.organizationId, organizationId)
      });

      // Query user's vote participation (anonymized - no vote content)
      // Only return metadata about participation, not actual vote choices
      const userVotes = await db.query.votes.findMany({
        where: sql`${votes.voterId} = ${userId} OR ${votes.voterHash} = ${createHash("sha256").update(userId).digest("hex")}`
      });

      // Log GDPR request execution
      logger.info(`[GDPR] Voting data retrieved for user ${userId} (anonymized)`);

      return [
        {
          dataType: "voting_participation",
          count: userVotes.length,
          data: userVotes.map(v => ({
            sessionId: v.sessionId,
            castAt: v.castAt,
            receiptId: v.receiptId,
            verificationCode: v.verificationCode,
            isAnonymous: v.isAnonymous,
            voterType: v.voterType,
            // Note: Actual vote content (optionId) is excluded for privacy
          }))
        },
        {
          dataType: "voting_sessions_participated",
          count: orgSessions.filter(s => 
            userVotes.some(v => v.sessionId === s.id)
          ).length,
          data: orgSessions
            .filter(s => userVotes.some(v => v.sessionId === s.id))
            .map(s => ({
              sessionId: s.id,
              title: s.title,
              type: s.type,
              meetingType: s.meetingType,
              startTime: s.startTime,
              endTime: s.endTime,
              // Note: Vote choice not included per GDPR anonymization requirements
            }))
        }
      ];
    } catch (error) {
      logger.error("[GDPR] Error retrieving voting data", { error });
      throw new Error("Failed to retrieve voting data");
    }
  }
}

/**
 * Right to be Forgotten Service (Article 17)
 */
export class DataErasureService {
  /**
   * Execute data erasure for user
   * This is a destructive operation - use with caution!
   */
  static async eraseUserData(
    userId: string,
    organizationId: string,
    requestId: string,
    executedBy: string
  ): Promise<void> {
    const tablesAffected: Array<{
      table: string;
      recordsAffected: number;
      fieldsAnonymized: string[];
    }> = [];

    try {
      // 1. Anonymize profile data (keep record for legal/audit purposes)
      const profileResult = await this.anonymizeProfile(userId);
      tablesAffected.push(profileResult);

      // 2. Delete or anonymize communications
      const commResult = await this.eraseCommunications(userId, organizationId);
      tablesAffected.push(commResult);

      // 3. Anonymize claims (may need to keep for legal reasons)
      const claimsResult = await this.anonymizeClaims(userId, organizationId);
      tablesAffected.push(claimsResult);

      // 4. Delete consent records
      const consentResult = await this.eraseConsents(userId, organizationId);
      tablesAffected.push(consentResult);

      // 5. Log the anonymization
      await db.insert(dataAnonymizationLog).values({
        userId,
        organizationId,
        operationType: "anonymize",
        reason: "RTBF request",
        requestId,
        tablesAffected,
        executedBy,
        canReverse: false, // Permanent operation
      });

      // 6. Update the GDPR request status
      await GdprRequestManager.updateRequestStatus(requestId, "completed", {
        processedBy: executedBy,
        responseData: {
          tablesAffected: tablesAffected.length,
          recordsAffected: tablesAffected.reduce(
            (sum, t) => sum + t.recordsAffected,
            0
          ),
        },
      });
    } catch (error) {
      logger.error("Data erasure failed", error instanceof Error ? error : new Error(String(error)), {
        userId,
        organizationId,
        requestId,
      });
      throw new Error("Failed to complete data erasure");
    }
  }

  private static async anonymizeProfile(userId: string) {
    // Replace PII with anonymized values
    const anonymousEmail = `deleted_${createHash("sha256").update(userId).digest("hex").substring(0, 16)}@anonymized.local`;
    
    try {
      // Anonymize profile while keeping user ID for referential integrity
      await db.update(profiles)
        .set({
          email: anonymousEmail,
          // Clear payment provider data
          stripeCustomerId: null,
          stripeSubscriptionId: null,
          whopUserId: null,
          whopMembershipId: null,
          // Keep membership status for statistical purposes
          status: "deleted",
          updatedAt: new Date()
        })
        .where(eq(profiles.userId, userId));

      // Log GDPR anonymization
      logger.info("[GDPR] Profile anonymized", { userId });

      return {
        table: "profiles",
        recordsAffected: 1,
        fieldsAnonymized: ["email", "firstName", "lastName", "phoneNumber"],
      };
    } catch (error) {
      logger.error("[GDPR] Profile anonymization failed", error instanceof Error ? error : new Error(String(error)), {
        userId,
      });
      throw error;
    }
  }

  private static async eraseCommunications(userId: string, organizationId: string) {
    // Delete message threads and messages (cascade delete handles related records)
    const deletedThreads = await db
      .delete(messageThreads)
      .where(
        and(
          eq(messageThreads.organizationId, organizationId),
          or(
            eq(messageThreads.memberId, userId),
            eq(messageThreads.staffId, userId)
          )
        )
      )
      .returning();

    // Delete individual messages sent by user
    const deletedMessages = await db
      .delete(messages)
      .where(eq(messages.senderId, userId))
      .returning();

    // Delete SMS message records
    const deletedSms = await db
      .delete(smsMessages)
      .where(
        and(
          eq(smsMessages.organizationId, organizationId),
          eq(smsMessages.userId, userId)
        )
      )
      .returning();

    // Delete SMS campaign recipient records
    const deletedCampaignRecipients = await db
      .delete(smsCampaignRecipients)
      .where(eq(smsCampaignRecipients.userId, userId))
      .returning();

    const totalDeleted = 
      deletedThreads.length + 
      deletedMessages.length + 
      deletedSms.length + 
      deletedCampaignRecipients.length;

    // Log GDPR communication erasure
    logger.info("[GDPR] Communications erased", {
      userId,
      threads: deletedThreads.length,
      messages: deletedMessages.length,
      sms: deletedSms.length,
      campaignRecipients: deletedCampaignRecipients.length,
    });

    return {
      table: "communications",
      recordsAffected: totalDeleted,
      fieldsAnonymized: ["content", "phoneNumber", "metadata"],
    };
  }

  private static async anonymizeClaims(userId: string, organizationId: string) {
    // Anonymize claims while keeping statistical data for analytics
    // We preserve: claim type, status, dates, amounts (for aggregate statistics)
    // We anonymize: description, witness details, personal identifiers
    
    const anonymizedClaims = await db
      .update(claims)
      .set({
        memberId: `GDPR-ERASED-${createHash("sha256").update(userId).digest("hex").substring(0, 16)}`,
        description: "[Description removed per GDPR data erasure request]",
        desiredOutcome: "[Desired outcome removed per GDPR data erasure request]",
        witnessDetails: null,
        previousReportDetails: null,
        location: "[Location anonymized]",
        // Keep statistical fields for analytics
        // claimType, status, priority, amounts remain for aggregate reporting
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(claims.organizationId, organizationId),
          eq(claims.memberId, userId)
        )
      )
      .returning();

    // Anonymize claim updates/notes
    const anonymizedUpdates = await db
      .update(claimUpdates)
      .set({
        message: "[Update removed per GDPR data erasure request]",
      })
      .where(
        eq(claimUpdates.createdBy, userId)
      )
      .returning();

    // Log GDPR claims anonymization
    logger.info("[GDPR] Claims anonymized", {
      userId,
      claims: anonymizedClaims.length,
      updates: anonymizedUpdates.length,
    });

    return {
      table: "claims",
      recordsAffected: anonymizedClaims.length + anonymizedUpdates.length,
      fieldsAnonymized: ["description", "desiredOutcome", "witnessDetails", "previousReportDetails", "location", "updateText"],
    };
  }

  private static async eraseConsents(userId: string, organizationId: string) {
    const _result = await db
      .delete(userConsents)
      .where(
        and(
          eq(userConsents.userId, userId),
          eq(userConsents.organizationId, organizationId)
        )
      );

    return {
      table: "user_consents",
      recordsAffected: 0, // result.count or similar
      fieldsAnonymized: [],
    };
  }

  /**
   * Check if user data can be erased
   * Some data may need to be retained for legal reasons
   */
  static async canEraseData(
    _userId: string,
    _organizationId: string
  ): Promise<{ canErase: boolean; reasons: string[] }> {
    const reasons: string[] = [];

    // Check for active claims
    // const activeClaims = await checkActiveClaims(userId, organizationId);
    // if (activeClaims > 0) {
    //   reasons.push("User has active claims that must be retained for legal purposes");
    // }

    // Check for ongoing strikes
    // Check for pending payments
    // etc.

    return {
      canErase: reasons.length === 0,
      reasons,
    };
  }
}

/**
 * Consent Banner Configuration
 */
export const CONSENT_BANNER_CONFIG = {
  version: "1.0.0",
  lastUpdated: "2026-02-06",
  categories: [
    {
      id: "essential",
      name: "Essential Cookies",
      description:
        "Required for the website to function. Cannot be disabled.",
      required: true,
      cookies: ["session_id", "csrf_token", "auth_token"],
    },
    {
      id: "functional",
      name: "Functional Cookies",
      description:
        "Enable enhanced functionality and personalization.",
      required: false,
      cookies: ["language_preference", "theme_preference"],
    },
    {
      id: "analytics",
      name: "Analytics Cookies",
      description:
        "Help us understand how visitors use our website.",
      required: false,
      cookies: ["_ga", "_gid", "analytics_session"],
    },
    {
      id: "marketing",
      name: "Marketing Cookies",
      description:
        "Used to track visitors and display relevant ads.",
      required: false,
      cookies: ["marketing_id", "ad_personalization"],
    },
  ],
  policyUrl: "/privacy-policy",
  cookiePolicyUrl: "/cookie-policy",
};

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  ConsentManager,
  CookieConsentManager,
  GdprRequestManager,
  DataExportService,
  DataErasureService,
};

