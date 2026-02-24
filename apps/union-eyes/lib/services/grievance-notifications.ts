/**
 * Grievance Notification Service
 * 
 * Handles all notification logic for grievance workflows
 * Integrates with notification system for multi-channel delivery
 */

import { db } from "@/db";
import { users } from "@/db/schema/user-management-schema";
import { getNotificationService } from "./notification-service";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

// ============================================================================
// TYPES
// ============================================================================

export interface GrievanceNotificationContext {
  organizationId: string;
  grievanceId: string;
  grievanceNumber?: string;
  grievanceSubject?: string;
  grievantName?: string;
  grievantEmail?: string;
  assignedOfficerEmail?: string;
  assignedOfficerName?: string;
  currentStage?: string;
  userId: string;
}

// ============================================================================
// GRIEVANCE NOTIFICATION HANDLERS
// ============================================================================

/**
 * Send notification when grievance is filed
 */
export async function sendGrievanceFiledNotification(
  context: GrievanceNotificationContext
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Notify grievant
    if (context.grievantEmail) {
      await notificationService.send({
        organizationId: context.organizationId,
        recipientEmail: context.grievantEmail,
        type: "email",
        priority: "high",
        subject: `Grievance Filed - ${context.grievanceNumber}`,
        title: "Grievance Received",
        body: `Your grievance regarding "${context.grievanceSubject}" has been filed and is being reviewed.`,
        actionUrl: `/grievances/${context.grievanceId}`,
        actionLabel: "View Grievance",
        metadata: {
          type: "grievance_filed",
          grievanceId: context.grievanceId,
        },
        userId: context.userId,
      });
    }

    logger.info("Grievance filed notification sent", {
      grievanceId: context.grievanceId,
    });
  } catch (error) {
    logger.error("Failed to send grievance filed notification", {
      error,
      grievanceId: context.grievanceId,
    });
  }
}

/**
 * Send notification when grievance is assigned
 */
export async function sendGrievanceAssignedNotification(
  context: GrievanceNotificationContext
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Notify assigned officer
    if (context.assignedOfficerEmail) {
      await notificationService.send({
        organizationId: context.organizationId,
        recipientEmail: context.assignedOfficerEmail,
        type: "email",
        priority: "high",
        subject: `Grievance Assigned - ${context.grievanceNumber}`,
        title: "New Grievance Assignment",
        body: `You have been assigned to grievance "${context.grievanceSubject}" filed by ${context.grievantName}.`,
        actionUrl: `/grievances/${context.grievanceId}`,
        actionLabel: "Review Grievance",
        metadata: {
          type: "grievance_assigned",
          grievanceId: context.grievanceId,
        },
        userId: context.userId,
      });

      // Also send push notification for urgency
      await notificationService.queue({
        organizationId: context.organizationId,
        recipientEmail: context.assignedOfficerEmail,
        type: "push",
        priority: "high",
        title: "New Grievance Assignment",
        body: `Grievance ${context.grievanceNumber} assigned to you`,
        actionUrl: `/grievances/${context.grievanceId}`,
        metadata: {
          type: "grievance_assigned",
        },
        userId: context.userId,
      });
    }

    // Notify grievant of assignment
    if (context.grievantEmail) {
      await notificationService.send({
        organizationId: context.organizationId,
        recipientEmail: context.grievantEmail,
        type: "email",
        priority: "normal",
        subject: `Grievance Officer Assigned - ${context.grievanceNumber}`,
        title: "Officer Assigned",
        body: `${context.assignedOfficerName} has been assigned to your grievance and will be in contact soon.`,
        actionUrl: `/grievances/${context.grievanceId}`,
        actionLabel: "View Grievance",
        metadata: {
          type: "grievance_officer_assigned",
          grievanceId: context.grievanceId,
        },
        userId: context.userId,
      });
    }

    logger.info("Grievance assigned notification sent", {
      grievanceId: context.grievanceId,
    });
  } catch (error) {
    logger.error("Failed to send grievance assigned notification", {
      error,
      grievanceId: context.grievanceId,
    });
  }
}

/**
 * Send notification when grievance stage changes
 */
export async function sendGrievanceStageChangeNotification(
  context: GrievanceNotificationContext & {
    previousStage: string;
    newStage: string;
  }
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Notify grievant
    if (context.grievantEmail) {
      await notificationService.send({
        organizationId: context.organizationId,
        recipientEmail: context.grievantEmail,
        type: "email",
        priority: "normal",
        subject: `Grievance Status Update - ${context.grievanceNumber}`,
        title: "Status Update",
        body: `Your grievance has progressed from ${context.previousStage} to ${context.newStage}.`,
        actionUrl: `/grievances/${context.grievanceId}`,
        actionLabel: "View Details",
        metadata: {
          type: "grievance_stage_change",
          grievanceId: context.grievanceId,
          previousStage: context.previousStage,
          newStage: context.newStage,
        },
        userId: context.userId,
      });
    }

    // Notify assigned officer
    if (context.assignedOfficerEmail) {
      await notificationService.send({
        organizationId: context.organizationId,
        recipientEmail: context.assignedOfficerEmail,
        type: "email",
        priority: "normal",
        subject: `Grievance Progressed - ${context.grievanceNumber}`,
        title: "Stage Change",
        body: `Grievance has moved to ${context.newStage}. Review required actions.`,
        actionUrl: `/grievances/${context.grievanceId}`,
        actionLabel: "Review Grievance",
        metadata: {
          type: "grievance_stage_change_officer",
          grievanceId: context.grievanceId,
        },
        userId: context.userId,
      });
    }

    logger.info("Grievance stage change notification sent", {
      grievanceId: context.grievanceId,
      newStage: context.newStage,
    });
  } catch (error) {
    logger.error("Failed to send grievance stage change notification", {
      error,
      grievanceId: context.grievanceId,
    });
  }
}

/**
 * Send notification when grievance deadline is approaching
 */
export async function sendGrievanceDeadlineReminder(
  context: GrievanceNotificationContext & {
    deadlineDate: Date;
    daysRemaining: number;
  }
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Notify assigned officer
    if (context.assignedOfficerEmail) {
      await notificationService.send({
        organizationId: context.organizationId,
        recipientEmail: context.assignedOfficerEmail,
        type: "email",
        priority: context.daysRemaining <= 2 ? "urgent" : "high",
        subject: `REMINDER: Grievance Deadline - ${context.grievanceNumber}`,
        title: "Deadline Approaching",
        body: `Grievance "${context.grievanceSubject}" has a deadline in ${context.daysRemaining} day(s) - ${context.deadlineDate.toLocaleDateString()}`,
        actionUrl: `/grievances/${context.grievanceId}`,
        actionLabel: "Take Action",
        metadata: {
          type: "grievance_deadline_reminder",
          grievanceId: context.grievanceId,
          daysRemaining: context.daysRemaining,
        },
        userId: context.userId,
      });

      // Send SMS if deadline is within 2 days
      if (context.daysRemaining <= 2 && context.assignedOfficerEmail) {
        try {
          // Get phone number from officer profile
          const [officer] = await db
            .select({
              phone: users.phone,
              name: users.displayName,
            })
            .from(users)
            .where(eq(users.email, context.assignedOfficerEmail))
            .limit(1);

          if (officer?.phone) {
            await notificationService.send({
              organizationId: context.organizationId,
              recipientPhone: officer.phone,
              type: "sms",
              priority: "urgent",
              title: "Urgent Grievance Deadline",
              body: `URGENT: Grievance ${context.grievanceNumber} deadline in ${context.daysRemaining} day(s). Action required.`,
              metadata: {
                type: "grievance_deadline_urgent",
                grievanceId: context.grievanceId,
                daysRemaining: context.daysRemaining,
              },
              userId: context.userId,
            });

            logger.info("Urgent SMS deadline reminder sent to officer", {
              grievanceId: context.grievanceId,
              daysRemaining: context.daysRemaining,
              phone: officer.phone.replace(/./g, "*").slice(-4), // Log masked phone
            });
          } else {
            logger.warn("Officer phone number not found for SMS reminder", {
              grievanceId: context.grievanceId,
              officerEmail: context.assignedOfficerEmail,
            });
          }
        } catch (smsError) {
          logger.error("Failed to send urgent SMS deadline reminder", {
            error: smsError,
            grievanceId: context.grievanceId,
          });
          // Continue even if SMS fails - email was already sent
        }
      }
    }

    logger.info("Grievance deadline reminder sent", {
      grievanceId: context.grievanceId,
      daysRemaining: context.daysRemaining,
    });
  } catch (error) {
    logger.error("Failed to send grievance deadline reminder", {
      error,
      grievanceId: context.grievanceId,
    });
  }
}

/**
 * Send notification when grievance is resolved
 */
export async function sendGrievanceResolvedNotification(
  context: GrievanceNotificationContext & {
    resolutionType: "settled" | "denied" | "withdrawn";
    resolutionSummary?: string;
  }
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Notify grievant
    if (context.grievantEmail) {
      const resolutionTitles = {
        settled: "Grievance Settled",
        denied: "Grievance Denied",
        withdrawn: "Grievance Withdrawn",
      };

      await notificationService.send({
        organizationId: context.organizationId,
        recipientEmail: context.grievantEmail,
        type: "email",
        priority: "high",
        subject: `${resolutionTitles[context.resolutionType]} - ${context.grievanceNumber}`,
        title: resolutionTitles[context.resolutionType],
        body: `Your grievance "${context.grievanceSubject}" has been ${context.resolutionType}. ${context.resolutionSummary || ""}`,
        actionUrl: `/grievances/${context.grievanceId}`,
        actionLabel: "View Resolution",
        metadata: {
          type: "grievance_resolved",
          grievanceId: context.grievanceId,
          resolutionType: context.resolutionType,
        },
        userId: context.userId,
      });
    }

    // Notify assigned officer
    if (context.assignedOfficerEmail) {
      await notificationService.send({
        organizationId: context.organizationId,
        recipientEmail: context.assignedOfficerEmail,
        type: "email",
        priority: "normal",
        subject: `Grievance Resolved - ${context.grievanceNumber}`,
        title: "Case Closed",
        body: `Grievance has been ${context.resolutionType}. Case is now closed.`,
        actionUrl: `/grievances/${context.grievanceId}`,
        actionLabel: "View Final Details",
        metadata: {
          type: "grievance_resolved_officer",
          grievanceId: context.grievanceId,
        },
        userId: context.userId,
      });
    }

    logger.info("Grievance resolved notification sent", {
      grievanceId: context.grievanceId,
      resolutionType: context.resolutionType,
    });
  } catch (error) {
    logger.error("Failed to send grievance resolved notification", {
      error,
      grievanceId: context.grievanceId,
    });
  }
}

/**
 * Send notification when new document is added to grievance
 */
export async function sendGrievanceDocumentAddedNotification(
  context: GrievanceNotificationContext & {
    documentName: string;
    uploadedBy: string;
  }
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Notify assigned officer (if document was uploaded by grievant)
    if (context.assignedOfficerEmail && context.uploadedBy !== context.assignedOfficerEmail) {
      await notificationService.send({
        organizationId: context.organizationId,
        recipientEmail: context.assignedOfficerEmail,
        type: "email",
        priority: "normal",
        subject: `New Document - ${context.grievanceNumber}`,
        title: "Document Added",
        body: `A new document "${context.documentName}" has been added to grievance ${context.grievanceNumber}.`,
        actionUrl: `/grievances/${context.grievanceId}/documents`,
        actionLabel: "View Document",
        metadata: {
          type: "grievance_document_added",
          grievanceId: context.grievanceId,
        },
        userId: context.userId,
      });
    }

    // Notify grievant (if document was uploaded by officer)
    if (context.grievantEmail && context.uploadedBy !== context.grievantEmail) {
      await notificationService.send({
        organizationId: context.organizationId,
        recipientEmail: context.grievantEmail,
        type: "email",
        priority: "normal",
        subject: `New Document - ${context.grievanceNumber}`,
        title: "Document Added",
        body: `A new document "${context.documentName}" has been added to your grievance.`,
        actionUrl: `/grievances/${context.grievanceId}/documents`,
        actionLabel: "View Document",
        metadata: {
          type: "grievance_document_added",
          grievanceId: context.grievanceId,
        },
        userId: context.userId,
      });
    }

    logger.info("Grievance document added notification sent", {
      grievanceId: context.grievanceId,
      documentName: context.documentName,
    });
  } catch (error) {
    logger.error("Failed to send grievance document added notification", {
      error,
      grievanceId: context.grievanceId,
    });
  }
}

/**
 * Send notification when comment/note is added to grievance
 */
export async function sendGrievanceCommentNotification(
  context: GrievanceNotificationContext & {
    commentAuthor: string;
    commentPreview: string;
  }
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Notify other parties (not the comment author)
    const recipients = [
      context.grievantEmail,
      context.assignedOfficerEmail,
    ].filter((email) => email && email !== context.commentAuthor);

    await Promise.all(
      recipients.map((email) =>
        notificationService.send({
          organizationId: context.organizationId,
          recipientEmail: email!,
          type: "email",
          priority: "low",
          subject: `New Comment - ${context.grievanceNumber}`,
          title: "New Comment",
          body: `${context.commentAuthor} added a comment: "${context.commentPreview}"`,
          actionUrl: `/grievances/${context.grievanceId}#comments`,
          actionLabel: "View Comment",
          metadata: {
            type: "grievance_comment",
            grievanceId: context.grievanceId,
          },
          userId: context.userId,
        })
      )
    );

    logger.info("Grievance comment notification sent", {
      grievanceId: context.grievanceId,
    });
  } catch (error) {
    logger.error("Failed to send grievance comment notification", {
      error,
      grievanceId: context.grievanceId,
    });
  }
}

/**
 * Send bulk notifications when grievance is escalated
 */
export async function sendGrievanceEscalationNotification(
  context: GrievanceNotificationContext & {
    escalatedTo: string[];
    escalationReason: string;
  }
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Notify escalation recipients
    await Promise.all(
      context.escalatedTo.map((email) =>
        notificationService.send({
          organizationId: context.organizationId,
          recipientEmail: email,
          type: "email",
          priority: "urgent",
          subject: `ESCALATION: Grievance ${context.grievanceNumber}`,
          title: "Grievance Escalated",
          body: `Grievance "${context.grievanceSubject}" has been escalated. Reason: ${context.escalationReason}`,
          actionUrl: `/grievances/${context.grievanceId}`,
          actionLabel: "Review Grievance",
          metadata: {
            type: "grievance_escalation",
            grievanceId: context.grievanceId,
          },
          userId: context.userId,
        })
      )
    );

    logger.info("Grievance escalation notifications sent", {
      grievanceId: context.grievanceId,
      recipientCount: context.escalatedTo.length,
    });
  } catch (error) {
    logger.error("Failed to send grievance escalation notifications", {
      error,
      grievanceId: context.grievanceId,
    });
  }
}

/**
 * Send settlement proposal notification
 */
export async function sendSettlementProposalNotification(
  context: GrievanceNotificationContext & {
    proposedBy: string;
    settlementSummary: string;
  }
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Notify grievant
    if (context.grievantEmail) {
      await notificationService.send({
        organizationId: context.organizationId,
        recipientEmail: context.grievantEmail,
        type: "email",
        priority: "high",
        subject: `Settlement Proposal - ${context.grievanceNumber}`,
        title: "Settlement Proposed",
        body: `A settlement has been proposed for your grievance: ${context.settlementSummary}`,
        actionUrl: `/grievances/${context.grievanceId}/settlement`,
        actionLabel: "Review Proposal",
        metadata: {
          type: "settlement_proposal",
          grievanceId: context.grievanceId,
        },
        userId: context.userId,
      });
    }

    logger.info("Settlement proposal notification sent", {
      grievanceId: context.grievanceId,
    });
  } catch (error) {
    logger.error("Failed to send settlement proposal notification", {
      error,
      grievanceId: context.grievanceId,
    });
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  sendGrievanceFiledNotification,
  sendGrievanceAssignedNotification,
  sendGrievanceStageChangeNotification,
  sendGrievanceDeadlineReminder,
  sendGrievanceResolvedNotification,
  sendGrievanceDocumentAddedNotification,
  sendGrievanceCommentNotification,
  sendGrievanceEscalationNotification,
  sendSettlementProposalNotification,
};

