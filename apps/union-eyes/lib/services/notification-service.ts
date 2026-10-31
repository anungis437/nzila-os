/**
 * Notification Service Framework
 * 
 * Centralized notification system with provider abstraction
 * Supports Email (SendGrid), SMS (Twilio), Push Notifications (Firebase)
 * Implements retry logic, auditing, and delivery tracking
 */

import { db } from "@/db";
import { v4 as uuid } from "uuid";
import { logger } from "@/lib/logger";
import { stripMarkup } from "@/lib/utils/strip-markup";
import { getFromEmail, sendResendEmail } from "@/lib/email-service";
import { createAuditLog } from "./audit-service";
import {
  notificationQueue,
  notificationDeliveryLog,
  notificationTemplates,
  userNotificationPreferences,
} from "@/db/schema/domains/communications";
import { organizationMembers } from "@/db/schema";
import { eq, and, or, lt, isNull } from "drizzle-orm";
import {
  decideDeliveryRetry,
  isDeliveryClaimConflict,
  loadDeliveryFacts,
} from "./delivery-reconciliation";

let firebaseAdmin: typeof import('firebase-admin') | null = null;
let firebaseApp: import('firebase-admin').app.App | null = null;

async function getFirebaseMessaging() {
  if (typeof window !== 'undefined') {
    return null;
  }

  if (!firebaseAdmin) {
    try {
      firebaseAdmin = await import('firebase-admin');
    } catch (_error) {
      logger.warn('firebase-admin not installed. Push notifications will be disabled.');
      return null;
    }
  }

  if (!firebaseApp) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT not configured');
    }

    const credentials = JSON.parse(serviceAccount);

    if (firebaseAdmin.apps?.length) {
      firebaseApp = firebaseAdmin.app();
    } else {
      firebaseApp = firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(credentials),
      });
    }
  }

  return firebaseAdmin.messaging(firebaseApp);
}

// ============================================================================
// TYPES
// ============================================================================

export type NotificationType = "email" | "sms" | "push" | "in_app";
export type NotificationStatus = "pending" | "sent" | "failed" | "delivered" | "bounced" | "uncertain";
export type NotificationPriority = "low" | "normal" | "high" | "urgent";

export interface NotificationPayload {
  organizationId: string;
  recipientId?: string; // User ID
  recipientEmail?: string;
  recipientPhone?: string;
  recipientFirebaseToken?: string;
  
  type: NotificationType;
  priority?: NotificationPriority;
  subject?: string;
  title?: string;
  body: string;
  htmlBody?: string;
  
  templateId?: string;
  templateData?: Record<string, unknown>;
  
  actionUrl?: string;
  actionLabel?: string;
  
  metadata?: Record<string, unknown>;
  userId?: string; // User who triggered notification
  /** Stable across retries. A second send with the same key must not call the provider again after acceptance or an uncertain attempt. */
  idempotencyKey?: string;
}

export interface NotificationResponse {
  id: string;
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  /** Provider receipt. Present when the provider accepted the submission, including when that acceptance was not recorded. */
  providerMessageId?: string;
}

export interface NotificationProvider {
  name: string;
  send(payload: NotificationPayload): Promise<NotificationResponse>;
  trackDelivery?(messageId: string): Promise<NotificationStatus>;
}

type DeliveryLedgerEvent =
  | "queued"
  | "attempted"
  | "accepted"
  | "failed"
  | "retried"
  | "delivered"
  | "suppressed"
  | "bounced"
  | "uncertain";

/** Provider status `sent` is submission acceptance. Confirmed delivery stays `delivered`. */
function providerSubmissionEvent(status: NotificationStatus): DeliveryLedgerEvent {
  if (status === "delivered") return "delivered";
  if (status === "bounced") return "bounced";
  if (status === "sent") return "accepted";
  return "failed";
}

async function recordDeliveryEvent(input: {
  organizationId: string;
  notificationId: string;
  event: DeliveryLedgerEvent;
  providerId?: string;
  externalEventId?: string;
  statusCode?: string;
  errorMessage?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await db.insert(notificationDeliveryLog).values({
    id: uuid(),
    organizationId: input.organizationId,
    notificationId: input.notificationId,
    event: input.event,
    eventTimestamp: new Date(),
    providerId: input.providerId,
    externalEventId: input.externalEventId,
    statusCode: input.statusCode,
    errorMessage: input.errorMessage,
    details: input.details,
  });
}

async function channelSuppression(payload: NotificationPayload): Promise<string | null> {
  if (!payload.recipientId) return null;
  const rows = await db
    .select({
      emailEnabled: userNotificationPreferences.emailEnabled,
      smsEnabled: userNotificationPreferences.smsEnabled,
      pushEnabled: userNotificationPreferences.pushEnabled,
      inAppEnabled: userNotificationPreferences.inAppEnabled,
    })
    .from(userNotificationPreferences)
    .where(
      and(
        eq(userNotificationPreferences.userId, payload.recipientId),
        eq(userNotificationPreferences.organizationId, payload.organizationId),
      ),
    )
    .limit(1);
  const prefs = Array.isArray(rows) ? rows[0] : undefined;
  if (!prefs || typeof prefs.emailEnabled !== "boolean") return null;
  const enabled = {
    email: prefs.emailEnabled,
    sms: prefs.smsEnabled,
    push: prefs.pushEnabled,
    in_app: prefs.inAppEnabled,
  }[payload.type];
  if (enabled === false) return `suppressed: ${payload.type} disabled by user preference`;
  return null;
}

interface TwilioMessageResponse {
  sid?: string;
  status?: string;
}

// ============================================================================
// NOTIFICATION DATABASE
// ============================================================================

// ✅ Notifications table schema exists in db/schema/notifications-schema.ts
// Available tables:
// - notifications: Scheduled notifications with deadlines/reminders
// - notificationTracking: Detailed delivery tracking
// - inAppNotifications: In-app notification system
// - notificationHistory: Audit log for all notifications
// - userNotificationPreferences: User-specific channel preferences
//
// Import from: import { notifications } from '@/db/schema/domains/communications';
/*
Schema reference for notifications table:
export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: text('tenant_id').notNull(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  priority: text('priority').default('medium'),
  relatedEntityType: text('related_entity_type'),
  relatedEntityId: text('related_entity_id'),
  scheduledFor: timestamp('scheduled_for'),
  status: notificationScheduleStatusEnum('status').notNull().default('scheduled'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  sentAt: timestamp('sent_at'),
  deliveredAt: timestamp('delivered_at'),
  failureReason: text('failure_reason'),
  failureCount: integer('failure_count').default(0),
  lastFailureAt: timestamp('last_failure_at'),
  
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
*/

// ============================================================================
// EMAIL PROVIDER (SendGrid)
// ============================================================================

function stripHtml(html: string): string {
  // Plain-text conversion for the email fallback; the result never contains markup.
  return stripMarkup(html).replace(/\s+/g, ' ').trim();
}

export class ResendEmailProvider implements NotificationProvider {
  name = "resend";

  constructor() {
    // Uses canonical getResendClient() — no local Resend instantiation
  }

  async send(payload: NotificationPayload): Promise<NotificationResponse> {
    try {
      if (!payload.recipientEmail) {
        throw new Error("Recipient email not provided");
      }

      const fromEmail = getFromEmail();
      const replyTo = process.env.EMAIL_REPLY_TO;
      const subject = payload.subject || 'Notification';
      const htmlBody = payload.htmlBody || `<p>${payload.body}</p>`;

      const result = await sendResendEmail({
        from: fromEmail,
        to: [payload.recipientEmail],
        subject,
        html: htmlBody,
        text: stripHtml(htmlBody),
        replyTo,
      }, {
        feature: 'notification_service',
        organizationId: payload.organizationId,
      });

      if (!result.success) {
        throw new Error(result.error || 'Resend send error');
      }

      const messageId = result.messageId || `rs-${uuid()}`;

      logger.info("Email notification sent via Resend", {
        to: payload.recipientEmail,
        subject,
        messageId,
        priority: payload.priority,
      });

      return {
        id: messageId,
        status: "sent",
        sentAt: new Date(),
      };
    } catch (error) {
      logger.error("Failed to send email notification via Resend", {
        error: error instanceof Error ? error.message : "Unknown error",
        to: payload.recipientEmail,
        subject: payload.subject,
      });
      return {
        id: uuid(),
        status: "failed",
        failureReason: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

export class SendGridEmailProvider implements NotificationProvider {
  name = "sendgrid";
  private apiKey: string;

  constructor(apiKey: string = process.env.SENDGRID_API_KEY || "") {
    if (!apiKey) {
      throw new Error("SendGrid API key not configured");
    }
    this.apiKey = apiKey;
  }

  async send(payload: NotificationPayload): Promise<NotificationResponse> {
    try {
      if (!payload.recipientEmail) {
        throw new Error("Recipient email not provided");
      }

      // Implement SendGrid API call using direct HTTP
      const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'noreply@unioneyes.app';
      
      // Prepare the email message
      const message = {
        personalizations: [
          {
            to: [{ email: payload.recipientEmail }],
            subject: payload.subject || 'Notification',
          },
        ],
        from: {
          email: fromEmail,
          name: process.env.SENDGRID_FROM_NAME || 'UnionEyes',
        },
        subject: payload.subject || 'Notification',
        content: [
          {
            type: 'text/plain',
            value: payload.body,
          },
          {
            type: 'text/html',
            value: payload.htmlBody || `<p>${payload.body}</p>`,
          },
        ],
        reply_to: process.env.SENDGRID_REPLY_TO_EMAIL ? {
          email: process.env.SENDGRID_REPLY_TO_EMAIL,
        } : undefined,
        categories: ['union-eyes', `priority-${payload.priority || 'normal'}`],
        custom_args: payload.metadata ? payload.metadata as Record<string, string> : {},
        tracking_settings: payload.actionUrl ? {
          click_tracking: {
            enable: true,
            enable_text: false,
          },
        } : undefined,
      };

      // Remove undefined properties
      if (!message.reply_to) delete message.reply_to;
      if (!message.tracking_settings) delete message.tracking_settings;

      // Call SendGrid API
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
      }

      // SendGrid returns 202 on success and no body, extract message ID from headers or generate one
      const messageId = `sg-${uuid()}`;

      logger.info("Email notification sent via SendGrid API", {
        to: payload.recipientEmail,
        subject: payload.subject,
        messageId,
        priority: payload.priority,
      });

      return {
        id: messageId,
        status: "sent",
        sentAt: new Date(),
      };
    } catch (error) {
      logger.error("Failed to send email notification via SendGrid", { 
        error: error instanceof Error ? error.message : "Unknown error",
        to: payload.recipientEmail,
        subject: payload.subject,
      });
      return {
        id: uuid(),
        status: "failed",
        failureReason: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ============================================================================
// SMS PROVIDER (Twilio)
// ============================================================================

export class TwilioSMSProvider implements NotificationProvider {
  name = "twilio";
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(
    accountSid: string = process.env.TWILIO_ACCOUNT_SID || "",
    authToken: string = process.env.TWILIO_AUTH_TOKEN || "",
    fromNumber: string = process.env.TWILIO_PHONE_NUMBER || ""
  ) {
    if (!accountSid || !authToken || !fromNumber) {
      throw new Error("Twilio credentials not configured");
    }
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  async send(payload: NotificationPayload): Promise<NotificationResponse> {
    try {
      if (!payload.recipientPhone) {
        throw new Error("Recipient phone number not provided");
      }

      // Build basic auth header
      const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');

      // Call Twilio Messaging API
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          'From': this.fromNumber,
          'To': payload.recipientPhone,
          'Body': payload.body,
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twilio API error (${response.status}): ${errorText}`);
      }

      const data = (await response.json()) as TwilioMessageResponse;
      const messageId = data.sid || `sms-${uuid()}`;

      logger.info("SMS notification sent via Twilio", {
        to: payload.recipientPhone,
        body: payload.body.substring(0, 50),
        messageId,
        status: data.status,
      });

      return {
        id: messageId,
        status: "sent",
        sentAt: new Date(),
      };
    } catch (error) {
      logger.error("Failed to send SMS notification", { 
        error: error instanceof Error ? error.message : 'Unknown error',
        phone: payload.recipientPhone,
        body: payload.body.substring(0, 50),
      });
      return {
        id: uuid(),
        status: "failed",
        failureReason: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ============================================================================
// PUSH NOTIFICATION PROVIDER (Firebase Cloud Messaging)
// ============================================================================

export class FirebasePushProvider implements NotificationProvider {
  name = "firebase";
  constructor() {}

  async send(payload: NotificationPayload): Promise<NotificationResponse> {
    try {
      if (!payload.recipientFirebaseToken) {
        throw new Error("Recipient Firebase token not provided");
      }

      const messaging = await getFirebaseMessaging();
      if (!messaging) {
        throw new Error('Firebase messaging not initialized');
      }

      const fcmMessage: import('firebase-admin').messaging.Message = {
        token: payload.recipientFirebaseToken,
        notification: {
          title: payload.title || 'Notification',
          body: payload.body,
        },
        data: payload.metadata ? Object.entries(payload.metadata).reduce((acc, [key, value]) => {
          acc[key] = String(value);
          return acc;
        }, {} as Record<string, string>) : {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            channelId: 'default',
          },
        },
        apns: {
          headers: {
            'apns-priority': '10',
          },
        },
      };

      const messageId = await messaging.send(fcmMessage);

      logger.info("Push notification sent via Firebase", {
        token: payload.recipientFirebaseToken?.substring(0, 20),
        title: payload.title,
        messageId,
      });

      return {
        id: messageId,
        status: "sent",
        sentAt: new Date(),
      };
    } catch (error) {
      logger.error("Failed to send push notification", { 
        error: error instanceof Error ? error.message : 'Unknown error',
        token: payload.recipientFirebaseToken?.substring(0, 20),
        title: payload.title,
      });
      return {
        id: uuid(),
        status: "failed",
        failureReason: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
}

// ============================================================================
// NOTIFICATION SERVICE
// ============================================================================

export class NotificationService {
  private providers: Map<NotificationType, NotificationProvider>;
  private isProcessing = false;

  constructor() {
    this.providers = new Map();

    // Initialize providers
    try {
      const providerType = process.env.EMAIL_PROVIDER || (process.env.RESEND_API_KEY ? 'resend' : 'sendgrid');

      if (providerType === 'resend') {
        this.providers.set("email", new ResendEmailProvider());
        logger.info("Resend email provider initialized successfully");
      } else if (providerType === 'sendgrid') {
        const apiKey = process.env.SENDGRID_API_KEY;
        if (!apiKey) {
          throw new Error("SENDGRID_API_KEY environment variable not set");
        }
        this.providers.set("email", new SendGridEmailProvider(apiKey));
        logger.info("SendGrid email provider initialized successfully");
      } else {
        throw new Error(`Unsupported EMAIL_PROVIDER: ${providerType}`);
      }
    } catch (error) {
      logger.warn("Email provider not available - email notifications will fail", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }

    try {
      this.providers.set("sms", new TwilioSMSProvider());
      logger.info("Twilio SMS provider initialized");
    } catch (error) {
      logger.warn("Twilio provider not available", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }

    try {
      this.providers.set("push", new FirebasePushProvider());
      logger.info("Firebase push provider initialized");
    } catch (error) {
      logger.warn("Firebase provider not available", {
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  /**
   * Send notification immediately
   */
  async send(payload: NotificationPayload): Promise<NotificationResponse> {
    try {
      const idempotencyKey = payload.idempotencyKey;
      let retryingConfirmedFailure = false;
      if (idempotencyKey) {
        const prior = await loadDeliveryFacts(payload.organizationId, idempotencyKey);
        const decision = decideDeliveryRetry(prior);
        if (decision.action === "skip") {
          return {
            id: idempotencyKey,
            status: decision.status,
            failureReason: decision.reason,
            providerMessageId: decision.providerMessageId,
          };
        }
        retryingConfirmedFailure = decision.retry;
        if (prior.length === 0) {
          try {
            await db.insert(notificationQueue).values({
              id: idempotencyKey,
              organizationId: payload.organizationId,
              status: "processing",
              priority: payload.priority || "normal",
              payload,
              attemptCount: "0",
              maxAttempts: "3",
              nextRetryAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          } catch (error) {
            if (!isDeliveryClaimConflict(error)) throw error;
            const claimed = await db
              .update(notificationQueue)
              .set({ status: "processing", updatedAt: new Date() })
              .where(and(
                eq(notificationQueue.id, idempotencyKey),
                eq(notificationQueue.organizationId, payload.organizationId),
                or(
                  eq(notificationQueue.status, "pending"),
                  eq(notificationQueue.status, "failed"),
                  eq(notificationQueue.status, "retrying"),
                ),
              ))
              .returning({ id: notificationQueue.id });
            if (Array.isArray(claimed) && claimed.length === 0) {
              return {
                id: idempotencyKey,
                status: "uncertain",
                failureReason: "another worker claimed this delivery",
              };
            }
          }
        } else {
          const claimed = await db
            .update(notificationQueue)
            .set({ status: "processing", updatedAt: new Date() })
            .where(and(
              eq(notificationQueue.id, idempotencyKey),
              eq(notificationQueue.organizationId, payload.organizationId),
              or(
                eq(notificationQueue.status, "pending"),
                eq(notificationQueue.status, "failed"),
                eq(notificationQueue.status, "retrying"),
              ),
            ))
            .returning({ id: notificationQueue.id });
          if (Array.isArray(claimed) && claimed.length === 0) {
            return {
              id: idempotencyKey,
              status: "uncertain",
              failureReason: "another worker is retrying this delivery",
            };
          }
        }
      }

      const recipientActive = await isNotificationRecipientActive(payload);
      if (!recipientActive) {
        const id = idempotencyKey ?? uuid();
        await recordDeliveryEvent({
          organizationId: payload.organizationId,
          notificationId: id,
          event: "suppressed",
          errorMessage: "Recipient is not active in organization",
          details: { type: payload.type, channel: payload.type, idempotencyKey: id },
        });
        return {
          id,
          status: "failed",
          failureReason: "Recipient is not active in organization",
        };
      }

      const suppression = await channelSuppression(payload);
      if (suppression) {
        const id = idempotencyKey ?? uuid();
        await recordDeliveryEvent({
          organizationId: payload.organizationId,
          notificationId: id,
          event: "suppressed",
          errorMessage: suppression,
          details: { type: payload.type, channel: payload.type, idempotencyKey: id },
        });
        return {
          id,
          status: "failed",
          failureReason: suppression,
        };
      }

      const provider = this.providers.get(payload.type);

      if (!provider) {
        throw new Error(`No provider configured for notification type: ${payload.type}`);
      }

      const attemptId = idempotencyKey ?? uuid();
      if (retryingConfirmedFailure) {
        await recordDeliveryEvent({
          organizationId: payload.organizationId,
          notificationId: attemptId,
          event: "retried",
          providerId: provider.name,
          details: { type: payload.type, channel: payload.type, idempotencyKey: attemptId },
        });
      }
      await recordDeliveryEvent({
        organizationId: payload.organizationId,
        notificationId: attemptId,
        event: "attempted",
        providerId: provider.name,
        details: { type: payload.type, channel: payload.type, idempotencyKey: attemptId },
      });

      const response = await provider.send(payload);
      const ledgerEvent = providerSubmissionEvent(response.status);
      const providerAccepted = response.status === "sent" || response.status === "delivered";
      try {
        await recordDeliveryEvent({
          organizationId: payload.organizationId,
          notificationId: attemptId,
          event: ledgerEvent,
          providerId: provider.name,
          externalEventId: response.id,
          statusCode: providerAccepted ? "202" : "500",
          errorMessage: response.failureReason,
          details: {
            type: payload.type,
            channel: payload.type,
            providerStatus: response.status,
            idempotencyKey: attemptId,
            providerMessageId: response.id,
          },
        });
      } catch (error) {
        if (!providerAccepted) throw error;
        try {
          await recordDeliveryEvent({
            organizationId: payload.organizationId,
            notificationId: attemptId,
            event: "uncertain",
            providerId: provider.name,
            externalEventId: response.id,
            errorMessage: "provider accepted the message but the acceptance was not recorded",
            details: {
              type: payload.type,
              channel: payload.type,
              idempotencyKey: attemptId,
              providerMessageId: response.id,
            },
          });
        } catch (uncertainError) {
          logger.error("Provider accepted a message and neither acceptance nor the uncertain marker was recorded", {
            uncertainError,
            idempotencyKey: attemptId,
            providerMessageId: response.id,
          });
        }
        return {
          id: attemptId,
          status: "uncertain",
          providerMessageId: response.id,
          failureReason: "provider accepted the message but the acceptance was not recorded",
        };
      }

      if (!idempotencyKey) {
        try {
          await db.insert(notificationQueue).values({
            id: response.id,
            organizationId: payload.organizationId,
            status: ledgerEvent === "failed" || ledgerEvent === "bounced" ? "failed" : "completed",
            priority: payload.priority || "normal",
            payload: {
              ...payload,
            },
            attemptCount: "1",
            maxAttempts: "1",
            processedAt: new Date(),
            completedAt: response.sentAt,
            resultNotificationId: response.id,
            errorMessage: response.failureReason,
          });
        } catch (dbError) {
          logger.warn("Queue mirror failed after the delivery ledger was written", { dbError, responseId: response.id });
        }
      }

      // Create audit log
      if (payload.userId && (response.status === "sent" || response.status === "delivered")) {
        await createAuditLog({
          organizationId: payload.organizationId,
          userId: payload.userId,
          action: "NOTIFICATION_SENT",
          resourceType: "notification",
          resourceId: response.id,
          description: `Sent ${payload.type} notification to ${payload.recipientEmail || payload.recipientPhone || payload.recipientId}`,
          metadata: {
            type: payload.type,
            status: response.status,
          },
        }).catch((err: unknown) => logger.warn("Failed to create audit log for notification", {
          error: err instanceof Error ? err.message : String(err)
        }));
      }

      return {
        ...response,
        providerMessageId: response.id,
      };
    } catch (error) {
      logger.error("Failed to send notification", { error, payload });
      throw error;
    }
  }

  /**
   * Queue notification for asynchronous processing
   */
  async queue(payload: NotificationPayload): Promise<string> {
    const notificationId = uuid();

    await db.insert(notificationQueue).values({
      id: notificationId,
      organizationId: payload.organizationId,
      status: 'pending',
      priority: payload.priority || 'normal',
      payload,
      attemptCount: '0',
      maxAttempts: '3',
      nextRetryAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await recordDeliveryEvent({
      organizationId: payload.organizationId,
      notificationId,
      event: 'queued',
      details: { type: payload.type, channel: payload.type },
    });

    return notificationId;
  }

  /**
   * Process queued notifications (legacy - use processPendingNotifications instead)
   */
  private async processQueue(): Promise<void> {
    // This method is preserved for backward compatibility but all processing
    // should use processPendingNotifications() and the queue jobs instead
    return;
  }

  /**
   * Schedule retry with exponential backoff
   */
  private async scheduleRetry(payload: NotificationPayload, attemptNumber: number): Promise<void> {
    const maxRetries = 3;
    if (attemptNumber >= maxRetries) {
      logger.error("Max retries exceeded for notification", { payload, attemptNumber });
      return;
    }

    // Exponential backoff: 300s * 2^attemptNumber = 5min, 10min, 20min
    const delaySeconds = 300 * Math.pow(2, attemptNumber);
    const nextRetryTime = new Date(Date.now() + delaySeconds * 1000);

    try {
      // Update queue entry with new retry time
      const queueId = uuid();
      await db.insert(notificationQueue).values({
        id: queueId,
        organizationId: payload.organizationId,
        status: 'retrying',
        priority: payload.priority || 'normal',
        payload,
        attemptCount: `${attemptNumber}`,
        maxAttempts: `${maxRetries}`,
        nextRetryAt: nextRetryTime,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).catch((err: unknown) => logger.warn("Failed to schedule retry", {
        error: err instanceof Error ? err.message : String(err)
      }));

      logger.info("Notification retry scheduled", {
        nextRetryAt: nextRetryTime,
        delaySeconds,
        attemptNumber,
      });
    } catch (dbError) {
      logger.warn("Failed to persist retry schedule", { dbError });
    }
  }

  /**
   * Send bulk notifications
   */
  async sendBulk(payloads: NotificationPayload[]): Promise<NotificationResponse[]> {
    const results = await Promise.all(payloads.map((p) => this.send(p).catch((err) => {
      logger.error("Bulk notification error", err);
      return {
        id: uuid(),
        status: "failed" as NotificationStatus,
        failureReason: err instanceof Error ? err.message : "Unknown error",
      };
    })));

    return results;
  }

  /**
   * Send notification by template
   */
  async sendFromTemplate(
    organizationId: string,
    templateKey: string,
    recipientEmail?: string,
    recipientPhone?: string,
    templateData?: Record<string, unknown>,
    userId?: string
  ): Promise<NotificationResponse> {
    try {
      // Load template from database
      const templates = await db.select().from(notificationTemplates).where(
        eq(notificationTemplates.templateKey, templateKey)
      ).limit(1);

      if (!templates || templates.length === 0) {
        throw new Error(`Template not found: ${templateKey}`);
      }

      const template = templates[0];

      // Render template with provided data
      const renderTemplate = (str: string | null | undefined, data: Record<string, unknown> = {}): string => {
        if (!str) return '';
        return str.replace(/{{(\w+)}}/g, (match, key) => {
          const value = data[key];
          return value != null ? String(value) : match;
        });
      };

      const subject = template.subject ? renderTemplate(template.subject, templateData) : templateKey;
      const body = renderTemplate(template.bodyTemplate, templateData);
      const htmlBody = template.htmlBodyTemplate ? renderTemplate(template.htmlBodyTemplate, templateData) : `<p>${body}</p>`;

      // Determine notification type based on channels
      let notificationType: NotificationType = 'email';
      if (template.channels?.includes('sms')) {
        notificationType = 'sms';
      } else if (template.channels?.includes('push')) {
        notificationType = 'push';
      }

      // Create and send notification payload
      const payload: NotificationPayload = {
        organizationId,
        recipientEmail,
        recipientPhone,
        type: notificationType,
        priority: 'normal',
        subject,
        body,
        htmlBody,
        templateId: template.id,
        templateData,
        userId,
        metadata: {
          templateKey,
          channels: template.channels,
        },
      };

      // Send the notification
      const response = await this.send(payload);

      logger.info("Template notification sent", {
        templateKey,
        templateId: template.id,
        type: notificationType,
        recipientEmail: recipientEmail ? recipientEmail.substring(0, 10) + '***' : undefined,
        status: response.status,
      });

      return response;
    } catch (error) {
      logger.error("Failed to send template notification", { error, templateKey, organizationId });
      return {
        id: uuid(),
        status: 'failed',
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Retry failed notifications from queue
   */
  async retryFailed(organizationId?: string, maxRetries: number = 3): Promise<{ retried: number; succeeded: number; failed: number }> {
    try {
      // Query failed/retrying notifications where nextRetryAt <= now and attemptCount < maxAttempts
      const now = new Date();
      const whereConditions = organizationId
        ? [
            or(
              eq(notificationQueue.status, 'failed'),
              eq(notificationQueue.status, 'retrying')
            ),
            lt(notificationQueue.nextRetryAt || now, now),
            lt(notificationQueue.attemptCount, String(maxRetries)),
            eq(notificationQueue.organizationId, organizationId)
          ]
        : [
            or(
              eq(notificationQueue.status, 'failed'),
              eq(notificationQueue.status, 'retrying')
            ),
            lt(notificationQueue.nextRetryAt || now, now),
            lt(notificationQueue.attemptCount, String(maxRetries))
          ];
      
      const failedNotifications = await db.select().from(notificationQueue).where(
        and(...whereConditions)
      ).limit(50);

      let retried = 0;
      let succeeded = 0;
      let failedCount = 0;

      // Retry each failed notification
      for (const queuedItem of failedNotifications) {
        try {
          const payload = queuedItem.payload as NotificationPayload;
          if (!payload) continue;

          const currentAttempt = parseInt(queuedItem.attemptCount?.toString() || '0', 10);
          const response = await this.send({
            ...payload,
            idempotencyKey: payload.idempotencyKey ?? queuedItem.id,
          });

          if (response.status === 'uncertain' || response.status === 'bounced') {
            await db.update(notificationQueue).set({
              status: 'failed',
              errorMessage: response.failureReason ?? response.status,
              nextRetryAt: null,
            }).where(and(eq(notificationQueue.id, queuedItem.id), eq(notificationQueue.organizationId, queuedItem.organizationId ?? payload.organizationId)));
            failedCount++;
            retried++;
            continue;
          }
          
          // Update queue entry with new status
          if (response.status === 'sent' || response.status === 'delivered') {
            await db.update(notificationQueue).set({
              status: 'completed',
              processedAt: new Date(),
              completedAt: new Date(),
              resultNotificationId: response.id,
            }).where(and(eq(notificationQueue.id, queuedItem.id), eq(notificationQueue.organizationId, queuedItem.organizationId)));
            succeeded++;
          } else {
            // Schedule next retry with exponential backoff
            const delaySeconds = 300 * Math.pow(2, currentAttempt);
            const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);
            
            await db.update(notificationQueue).set({
              status: 'retrying',
              attemptCount: `${currentAttempt + 1}`,
              nextRetryAt: nextRetryAt,
              errorMessage: response.failureReason,
            }).where(and(eq(notificationQueue.id, queuedItem.id), eq(notificationQueue.organizationId, queuedItem.organizationId)));
            failedCount++;
          }
          retried++;
        } catch (error) {
          logger.error("Failed to retry notification", { error, itemId: queuedItem.id });
          failedCount++;
          retried++;

          // Update queue entry with error
          try {
            const currentAttempt = parseInt(queuedItem.attemptCount?.toString() || '0', 10);
            if (currentAttempt >= maxRetries) {
              await db.update(notificationQueue).set({
                status: 'failed',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
              }).where(and(eq(notificationQueue.id, queuedItem.id), eq(notificationQueue.organizationId, queuedItem.organizationId)));
            } else {
              const delaySeconds = 300 * Math.pow(2, currentAttempt);
              const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);
              
              await db.update(notificationQueue).set({
                status: 'retrying',
                attemptCount: `${currentAttempt + 1}`,
                nextRetryAt: nextRetryAt,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
              }).where(and(eq(notificationQueue.id, queuedItem.id), eq(notificationQueue.organizationId, queuedItem.organizationId)));
            }
          } catch (updateError) {
            logger.error("Failed to update queue entry on error", { updateError });
          }
        }
      }

      logger.info("Retry failed notifications completed", {
        retried,
        succeeded,
        failed: failedCount,
      });

      return { retried, succeeded, failed: failedCount };
    } catch (error) {
      logger.error("Error in retryFailed", { error });
      return { retried: 0, succeeded: 0, failed: 0 };
    }
  }
}

async function isNotificationRecipientActive(payload: NotificationPayload): Promise<boolean> {
  if (!payload.recipientId) {
    return true;
  }

  const [membership] = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.userId, payload.recipientId),
        eq(organizationMembers.organizationId, payload.organizationId),
        eq(organizationMembers.status, "active"),
        isNull(organizationMembers.deletedAt),
      ),
    )
    .limit(1);

  return Boolean(membership);
}

// ============================================================================
// NOTIFICATION TEMPLATES
// ============================================================================

export const NotificationTemplates = {
  // Payment notifications
  PAYMENT_RECEIVED: {
    subject: "Payment Received",
    title: "Payment Confirmed",
    body: "We received your payment of {{amount}}. Thank you!",
  },

  PAYMENT_FAILED: {
    subject: "Payment Failed",
    title: "Payment Issue",
    body: "Your payment of {{amount}} failed. Please try again.",
  },

  // Dues notifications
  DUES_REMINDER: {
    subject: "Dues Payment Reminder",
    title: "Dues Due Soon",
    body: "Your dues of {{amount}} are due on {{dueDate}}",
  },

  DUES_OVERDUE: {
    subject: "Dues Overdue",
    title: "Payment Required",
    body: "Your dues of {{amount}} were due on {{dueDate}}. Please pay now.",
  },

  // Strike notifications
  STRIKE_STARTED: {
    subject: "Strike Payment Available",
    title: "Receive Strike Benefits",
    body: "You&apos;re now eligible to receive {{amount}} in strike benefits",
  },

  // Voting notifications
  VOTING_OPEN: {
    subject: "Voting is Now Open",
    title: "Cast Your Vote",
    body: "Voting for {{electionName}} is now open until {{closingTime}}",
  },

  VOTING_REMINDER: {
    subject: "Don&apos;t Forget to Vote",
    title: "Voting Closes Soon",
    body: "Remember to vote for {{electionName}} before {{closingTime}}",
  },

  // Certification notifications
  CERTIFICATION_AVAILABLE: {
    subject: "Certification Available",
    title: "New Certification",
    body: "Your {{certificationType}} certification is now available",
  },

  // General notifications
  ACCOUNT_ALERT: {
    subject: "Account Alert",
    title: "Account Activity",
    body: "{{alertMessage}}",
  },

  // Correspondence pipeline notifications
  CORRESPONDENCE_REVIEW_REQUESTED: {
    subject: "Correspondence Awaiting Your Review",
    title: "Review Requested",
    body: "{{drafterName}} has submitted {{referenceNumber}} — \"{{subject}}\" — for your review and signature.",
  },

  CORRESPONDENCE_APPROVED: {
    subject: "Correspondence Approved",
    title: "Ready for Signature",
    body: "{{referenceNumber}} — \"{{subject}}\" — has been approved and is ready for your signature.",
  },

  CORRESPONDENCE_SIGNED: {
    subject: "Correspondence Signed",
    title: "Signed — Ready to Dispatch",
    body: "{{signerName}} has signed {{referenceNumber}} — \"{{subject}}\". It is ready to be dispatched.",
  },

  CORRESPONDENCE_DISPATCHED: {
    subject: "Correspondence Dispatched",
    title: "Dispatched",
    body: "{{referenceNumber}} — \"{{subject}}\" — has been dispatched via {{dispatchMethod}}.",
  },

  CORRESPONDENCE_REVISION_REQUESTED: {
    subject: "Correspondence Revision Requested",
    title: "Revision Needed",
    body: "{{reviewerName}} has requested revisions to {{referenceNumber}} — \"{{subject}}\": {{reason}}",
  },
};

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let notificationService: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!notificationService) {
    notificationService = new NotificationService();
  }
  return notificationService;
}

/**
 * Process pending notifications from queue (for cron jobs/background tasks)
 */
export async function processPendingNotifications(batchSize: number = 50): Promise<{ processed: number; succeeded: number; failed: number }> {
  try {
    const notificationService = getNotificationService();
    
    // Query pending notifications
    const pendingNotifications = await db.select().from(notificationQueue).where(
      eq(notificationQueue.status, 'pending')
    ).limit(batchSize);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const queuedItem of pendingNotifications) {
      try {
        const payload = queuedItem.payload as NotificationPayload;
        if (!payload) continue;

        const response = await notificationService.send({
          ...payload,
          idempotencyKey: payload.idempotencyKey ?? queuedItem.id,
        });
        
        if (response.status === 'sent' || response.status === 'delivered') {
          succeeded++;
        } else {
          failed++;
        }
        processed++;
      } catch (error) {
        logger.error("Failed to process pending notification", { error, itemId: queuedItem.id });
        failed++;
        processed++;
      }
    }

    logger.info("Process pending notifications completed", {
      batch: batchSize,
      processed,
      succeeded,
      failed,
    });

    return { processed, succeeded, failed };
  } catch (error) {
    logger.error("Error in processPendingNotifications", { error });
    return { processed: 0, succeeded: 0, failed: 0 };
  }
}

/**
 * Cron job handler for retrying failed notifications
 */
export async function retryFailedNotificationsJob(): Promise<{ retried: number; succeeded: number; failed: number }> {
  try {
    const notificationService = getNotificationService();
    return await notificationService.retryFailed(undefined, 3);
  } catch (error) {
    logger.error("Error in retryFailedNotificationsJob", { error });
    return { retried: 0, succeeded: 0, failed: 0 };
  }
}

export default NotificationService; 
