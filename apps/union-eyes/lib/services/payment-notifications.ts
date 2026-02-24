/**
 * Payment Notification Integration Example
 * 
 * Demonstrates how to send notifications when payments are processed
 * Replaces TODO comments across payment-related workflows
 */

import { getNotificationService } from "@/lib/services/notification-service";
import { db } from "@/db/db";
import { profiles as profilesSchema } from "@/db/schema/profiles-schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/logger";

// DB table may have columns (phone, firebaseToken, organizationId) not yet in drizzle schema
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const profiles = profilesSchema as any;

// ============================================================================
// PAYMENT NOTIFICATION HANDLERS
// ============================================================================

/**
 * Send payment received notification
 * Called when a payment is successfully processed
 */
export async function sendPaymentReceivedNotification(
  organizationId: string,
  recipientId: string,
  amount: number,
  paymentMethod: string,
  transactionId: string,
  userId: string
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Get recipient email
    const [recipient] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, recipientId));

    if (!recipient?.email) {
      logger.warn("Recipient email not found for payment notification", { recipientId });
      return;
    }

    // Send email notification
    await notificationService.send({
      organizationId,
      recipientId,
      recipientEmail: recipient.email,
      type: "email",
      priority: "normal",
      subject: "Payment Received",
      title: "Payment Confirmed",
      body: `We received your payment of $${amount.toFixed(2)} via ${paymentMethod}`,
      templateId: "PAYMENT_RECEIVED",
      templateData: {
        amount: amount.toFixed(2),
        paymentMethod,
        transactionId,
      },
      metadata: {
        type: "payment_received",
        transactionId,
        amount,
      },
      userId,
    });

    // Send push notification
    if (recipient.firebaseToken) {
      await notificationService.queue({
        organizationId,
        recipientId,
        recipientFirebaseToken: recipient.firebaseToken,
        type: "push",
        priority: "normal",
        title: "Payment Confirmed",
        body: `$${amount.toFixed(2)} payment received`,
        templateId: "PAYMENT_RECEIVED",
        metadata: {
          type: "payment_received",
          transactionId,
        },
        userId,
      });
    }

    logger.info("Payment received notification sent", {
      recipientId,
      amount,
      transactionId,
    });
  } catch (error) {
    logger.error("Failed to send payment received notification", {
      error,
      recipientId,
      amount,
    });
    // Don&apos;t throw - continue processing even if notification fails
  }
}

/**
 * Send payment failed notification
 * Called when a payment fails
 */
export async function sendPaymentFailedNotification(
  organizationId: string,
  recipientId: string,
  amount: number,
  failureReason: string,
  retryUrl: string,
  userId: string
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Get recipient email
    const [recipient] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, recipientId));

    if (!recipient?.email) {
      logger.warn("Recipient email not found for payment failure notification", {
        recipientId,
      });
      return;
    }

    // Send email notification with retry action
    await notificationService.send({
      organizationId,
      recipientId,
      recipientEmail: recipient.email,
      type: "email",
      priority: "high",
      subject: "Payment Failed - Action Required",
      title: "Payment Issue",
      body: `Your payment of $${amount.toFixed(2)} failed: ${failureReason}. Please try again.`,
      templateId: "PAYMENT_FAILED",
      templateData: {
        amount: amount.toFixed(2),
        failureReason,
      },
      actionUrl: retryUrl,
      actionLabel: "Retry Payment",
      metadata: {
        type: "payment_failed",
        amount,
        failureReason,
      },
      userId,
    });

    // Also send SMS for high priority
    if (recipient.phone) {
      await notificationService.queue({
        organizationId,
        recipientId,
        recipientPhone: recipient.phone,
        type: "sms",
        priority: "high",
        body: `Your $${amount.toFixed(2)} payment failed. ${failureReason}. Retry: ${retryUrl}`,
        metadata: {
          type: "payment_failed",
        },
        userId,
      });
    }

    logger.info("Payment failed notification sent", {
      recipientId,
      amount,
      failureReason,
    });
  } catch (error) {
    logger.error("Failed to send payment failed notification", {
      error,
      recipientId,
      amount,
    });
  }
}

// ============================================================================
// DUES NOTIFICATION HANDLERS
// ============================================================================

/**
 * Send dues payment reminder
 * Called when dues are coming due soon
 */
export async function sendDuesReminderNotification(
  organizationId: string,
  recipientId: string,
  amount: number,
  dueDate: Date,
  daysUntilDue: number,
  paymentUrl: string,
  userId: string
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Get recipient
    const [recipient] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, recipientId));

    if (!recipient?.email) {
      logger.warn("Recipient email not found for dues reminder", { recipientId });
      return;
    }

    // Only send SMS if due within 3 days
    if (daysUntilDue <= 3 && recipient.phone) {
      await notificationService.send({
        organizationId,
        recipientId,
        recipientPhone: recipient.phone,
        type: "sms",
        priority: daysUntilDue <= 1 ? "urgent" : "high",
        body: `Your union dues of $${amount.toFixed(2)} are due on ${dueDate.toLocaleDateString()}`,
        metadata: {
          type: "dues_reminder",
          amount,
          daysUntilDue,
        },
        userId,
      });
    }

    // Send email reminder
    await notificationService.queue({
      organizationId,
      recipientId,
      recipientEmail: recipient.email,
      type: "email",
      priority: "normal",
      subject: `Dues Payment Reminder - Due ${dueDate.toLocaleDateString()}`,
      title: "Dues Payment Reminder",
      body: `Your union dues of $${amount.toFixed(2)} are due on ${dueDate.toLocaleDateString()}`,
      templateId: "DUES_REMINDER",
      templateData: {
        amount: amount.toFixed(2),
        dueDate: dueDate.toLocaleDateString(),
        daysUntilDue,
      },
      actionUrl: paymentUrl,
      actionLabel: "Pay Now",
      metadata: {
        type: "dues_reminder",
        amount,
        daysUntilDue,
      },
      userId,
    });

    logger.info("Dues reminder notification sent", {
      recipientId,
      amount,
      daysUntilDue,
    });
  } catch (error) {
    logger.error("Failed to send dues reminder notification", {
      error,
      recipientId,
      amount,
    });
  }
}

/**
 * Send dues overdue notification
 * Called when dues payment is overdue
 */
export async function sendDuesOverdueNotification(
  organizationId: string,
  recipientId: string,
  amount: number,
  dueDate: Date,
  lateFee: number,
  paymentUrl: string,
  userId: string
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Get recipient
    const [recipient] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, recipientId));

    if (!recipient?.email) {
      logger.warn("Recipient email not found for overdue dues", { recipientId });
      return;
    }

    const totalDue = amount + lateFee;

    // Send urgent email
    await notificationService.send({
      organizationId,
      recipientId,
      recipientEmail: recipient.email,
      type: "email",
      priority: "urgent",
      subject: "URGENT: Dues Payment Overdue",
      title: "Payment Required",
      body: `Your union dues of $${amount.toFixed(2)} were due on ${dueDate.toLocaleDateString()}. A late fee of $${lateFee.toFixed(2)} has been applied. Total due: $${totalDue.toFixed(2)}`,
      templateId: "DUES_OVERDUE",
      templateData: {
        amount: amount.toFixed(2),
        dueDate: dueDate.toLocaleDateString(),
        lateFee: lateFee.toFixed(2),
        totalDue: totalDue.toFixed(2),
      },
      actionUrl: paymentUrl,
      actionLabel: "Pay Now",
      metadata: {
        type: "dues_overdue",
        amount,
        lateFee,
        totalDue,
      },
      userId,
    });

    // Send urgent SMS if phone available
    if (recipient.phone) {
      await notificationService.send({
        organizationId,
        recipientId,
        recipientPhone: recipient.phone,
        type: "sms",
        priority: "urgent",
        body: `URGENT: Dues of $${amount.toFixed(2)} were due on ${dueDate.toLocaleDateString()}. Late fee $${lateFee.toFixed(2)} applied. Total: $${totalDue.toFixed(2)}`,
        actionUrl: paymentUrl,
        metadata: {
          type: "dues_overdue",
        },
        userId,
      });
    }

    logger.info("Dues overdue notification sent", {
      recipientId,
      amount,
      lateFee,
    });
  } catch (error) {
    logger.error("Failed to send dues overdue notification", {
      error,
      recipientId,
      amount,
    });
  }
}

// ============================================================================
// STRIKE BENEFIT NOTIFICATIONS
// ============================================================================

/**
 * Send strike benefit available notification
 * Called when member becomes eligible for strike benefits
 */
export async function sendStrikeBenefitNotification(
  organizationId: string,
  recipientId: string,
  amount: number,
  strikeStartDate: Date,
  claimUrl: string,
  userId: string
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    // Get recipient
    const [recipient] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.id, recipientId));

    if (!recipient?.email) {
      logger.warn("Recipient email not found for strike benefit notification", {
        recipientId,
      });
      return;
    }

    // Send email notification
    await notificationService.send({
      organizationId,
      recipientId,
      recipientEmail: recipient.email,
      type: "email",
      priority: "high",
      subject: "Strike Benefits Available",
      title: "Receive Strike Benefits",
      body: `You&apos;re now eligible to receive $${amount.toFixed(2)} in strike benefits from the strike that began on ${strikeStartDate.toLocaleDateString()}`,
      templateId: "STRIKE_STARTED",
      templateData: {
        amount: amount.toFixed(2),
        strikeStartDate: strikeStartDate.toLocaleDateString(),
      },
      actionUrl: claimUrl,
      actionLabel: "Claim Benefits",
      metadata: {
        type: "strike_benefits",
        amount,
      },
      userId,
    });

    // Send push notification
    if (recipient.firebaseToken) {
      await notificationService.queue({
        organizationId,
        recipientId,
        recipientFirebaseToken: recipient.firebaseToken,
        type: "push",
        priority: "high",
        title: "Strike Benefits Available",
        body: `Claim your $${amount.toFixed(2)} strike benefits now`,
        actionUrl: claimUrl,
        metadata: {
          type: "strike_benefits",
        },
        userId,
      });
    }

    logger.info("Strike benefit notification sent", {
      recipientId,
      amount,
    });
  } catch (error) {
    logger.error("Failed to send strike benefit notification", {
      error,
      recipientId,
      amount,
    });
  }
}

// ============================================================================
// BULK NOTIFICATION OPERATIONS
// ============================================================================

/**
 * Send bulk notification (e.g., election or announcement)
 * Used for system-wide communications
 */
export async function sendBulkNotification(
  organizationId: string,
  recipientIds: string[],
  subject: string,
  message: string,
  type: "email" | "sms" | "push" = "email",
  priority: "normal" | "high" | "urgent" = "normal",
  userId: string
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    logger.info(`Sending bulk ${type} notification to ${recipientIds.length} recipients`, {
      organizationId,
      subject,
    });

    // Get all recipient contact info
    const recipients = await db
      .select()
      .from(profiles)
      .where(eq(profiles.organizationId, organizationId));

    const recipientMap = new Map(recipients.map((r) => [r.id, r]));

    // Build payload for each recipient
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payloads: any[] = [];

    for (const recipientId of recipientIds) {
      const recipient = recipientMap.get(recipientId);
      if (!recipient) continue;

      const basePayload = {
        organizationId,
        recipientId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type: type as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        priority: priority as any,
        subject,
        body: message,
        userId,
      };

      if (type === "email" && recipient.email) {
        payloads.push({
          ...basePayload,
          recipientEmail: recipient.email,
        });
      } else if (type === "sms" && recipient.phone) {
        payloads.push({
          ...basePayload,
          recipientPhone: recipient.phone,
        });
      } else if (type === "push" && recipient.firebaseToken) {
        payloads.push({
          ...basePayload,
          recipientFirebaseToken: recipient.firebaseToken,
        });
      }
    }

    // Send bulk notifications
    await notificationService.sendBulk(payloads);

    logger.info("Bulk notification sent successfully", {
      organizationId,
      sent: payloads.length,
      failed: recipientIds.length - payloads.length,
    });
  } catch (error) {
    logger.error("Failed to send bulk notification", { error, organizationId });
  }
}

// ============================================================================
// NOTIFICATION RETRY
// ============================================================================

/**
 * Retry failed notifications
 * Called periodically (e.g., hourly) to retry failed messages
 */
export async function retryFailedNotifications(
  organizationId: string,
  maxAttempts: number = 3
): Promise<void> {
  try {
    const notificationService = getNotificationService();

    logger.info("Retrying failed notifications", {
      organizationId,
      maxAttempts,
    });

    const result = await notificationService.retryFailed(organizationId, maxAttempts);

    logger.info("Retry completed", result);
  } catch (error) {
    logger.error("Failed to retry notifications", { error, organizationId });
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  sendPaymentReceivedNotification,
  sendPaymentFailedNotification,
  sendDuesReminderNotification,
  sendDuesOverdueNotification,
  sendStrikeBenefitNotification,
  sendBulkNotification,
  retryFailedNotifications,
};

