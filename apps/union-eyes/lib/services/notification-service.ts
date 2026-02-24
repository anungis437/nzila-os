/**
 * Notification Service Framework
 * 
 * Centralized notification system with provider abstraction
 * Supports Email (SendGrid), SMS (Twilio), Push Notifications (Firebase)
 * Implements retry logic, auditing, and delivery tracking
 */

import { db } from "@/db";
import { v4 as uuid } from "uuid";
import { Resend } from "resend";
import { logger } from "@/lib/logger";
import { createAuditLog } from "./audit-service";
import {
  notificationQueue,
  notificationDeliveryLog,
  notificationTemplates,
} from "@/db/schema/domains/communications";
import { eq, and, or, lt } from "drizzle-orm";

let firebaseAdmin: typeof import('firebase-admin') | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseApp: any = null;

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
export type NotificationStatus = "pending" | "sent" | "failed" | "delivered" | "bounced";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  templateData?: Record<string, any>;
  
  actionUrl?: string;
  actionLabel?: string;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
  userId?: string; // User who triggered notification
}

export interface NotificationResponse {
  id: string;
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
}

export interface NotificationProvider {
  name: string;
  send(payload: NotificationPayload): Promise<NotificationResponse>;
  trackDelivery?(messageId: string): Promise<NotificationStatus>;
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
  return html
    .replace(/<style[^>]*>.*<\/style>/gm, '')
    .replace(/<[^>]+>/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export class ResendEmailProvider implements NotificationProvider {
  name = "resend";
  private apiKey: string;
  private client: Resend;

  constructor(apiKey: string = process.env.RESEND_API_KEY || "") {
    if (!apiKey) {
      throw new Error("Resend API key not configured");
    }
    this.apiKey = apiKey;
    this.client = new Resend(this.apiKey);
  }

  async send(payload: NotificationPayload): Promise<NotificationResponse> {
    try {
      if (!payload.recipientEmail) {
        throw new Error("Recipient email not provided");
      }

      const fromEmail = process.env.EMAIL_FROM || 'noreply@unioneyes.app';
      const replyTo = process.env.EMAIL_REPLY_TO;
      const subject = payload.subject || 'Notification';
      const htmlBody = payload.htmlBody || `<p>${payload.body}</p>`;

      const { data, error } = await this.client.emails.send({
        from: fromEmail,
        to: [payload.recipientEmail],
        subject,
        html: htmlBody,
        text: stripHtml(htmlBody),
        replyTo,
      });

      if (error) {
        throw new Error(error.message || 'Resend send error');
      }

      const messageId = data?.id || `rs-${uuid()}`;

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
          name: process.env.SENDGRID_FROM_NAME || 'Union Eyes',
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await response.json() as any;
      const messageId = data.sid || `sms-${uuid()}`;

      logger.info("SMS notification sent via Twilio", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        to: payload.recipientPhone as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: payload.body.substring(0, 50) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messageId: messageId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: data.status as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      return {
        id: messageId,
        status: "sent",
        sentAt: new Date(),
      };
    } catch (error) {
      logger.error("Failed to send SMS notification", { 
        error: error instanceof Error ? error.message : 'Unknown error',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        phone: payload.recipientPhone as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        body: payload.body.substring(0, 50) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
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

      const fcmMessage = {
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageId = await messaging.send(fcmMessage as any);

      logger.info("Push notification sent via Firebase", {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token: payload.recipientFirebaseToken?.substring(0, 20) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        title: payload.title as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        messageId: messageId as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      return {
        id: messageId,
        status: "sent",
        sentAt: new Date(),
      };
    } catch (error) {
      logger.error("Failed to send push notification", { 
        error: error instanceof Error ? error.message : 'Unknown error',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        token: payload.recipientFirebaseToken?.substring(0, 20) as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        title: payload.title as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
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
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
          throw new Error("RESEND_API_KEY environment variable not set");
        }
        this.providers.set("email", new ResendEmailProvider(apiKey));
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
      const provider = this.providers.get(payload.type);

      if (!provider) {
        throw new Error(`No provider configured for notification type: ${payload.type}`);
      }

      const response = await provider.send(payload);

      // Store notification in queue table (acts as notification delivery log)
      try {
        await db.insert(notificationQueue).values({
          id: response.id,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          organizationId: payload.organizationId as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: 'completed' as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          priority: (payload.priority || 'normal') as any,
          payload: {
            ...payload,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          attemptCount: '1' as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          maxAttempts: '1' as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          processedAt: new Date() as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          completedAt: response.sentAt as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resultNotificationId: response.id as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).catch((err: any) => logger.warn("Failed to store notification in queue", {
          error: err instanceof Error ? err.message : String(err)
        }));

        // Also log delivery event
        await db.insert(notificationDeliveryLog).values({
          id: uuid(),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          organizationId: payload.organizationId as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          notificationId: response.id as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          event: response.status === 'sent' ? 'sent' : 'failed' as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eventTimestamp: response.sentAt || new Date() as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          providerId: provider.name as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          externalEventId: response.id as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          statusCode: response.status === 'sent' ? '200' : '500' as any,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          errorMessage: response.failureReason as any,
          details: {
            type: payload.type,
            channel: payload.type,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).catch((err: any) => logger.warn("Failed to log delivery event", {
          error: err instanceof Error ? err.message : String(err)
        }));
      } catch (dbError) {
        logger.warn("Database persistence failed but notification was sent", { dbError, responseId: response.id });
      }

      // Create audit log
      if (payload.userId) {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }).catch((err: any) => logger.warn("Failed to create audit log for notification", {
          error: err instanceof Error ? err.message : String(err)
        }));
      }

      return response;
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

    // Store in queue table for persistence
    try {
      await db.insert(notificationQueue).values({
        id: notificationId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        organizationId: payload.organizationId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: 'pending' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        priority: (payload.priority || 'normal') as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: payload as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attemptCount: '0' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        maxAttempts: '3' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nextRetryAt: new Date() as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createdAt: new Date() as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updatedAt: new Date() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }).catch((err: any) => logger.warn("Failed to queue notification in database", {
        error: err instanceof Error ? err.message : String(err)
      }));
    } catch (dbError) {
      logger.error("Failed to queue notification", { dbError });
      throw dbError;
    }

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        organizationId: payload.organizationId as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        status: 'retrying' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        priority: (payload.priority || 'normal') as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        payload: payload as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        attemptCount: `${attemptNumber}` as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        maxAttempts: `${maxRetries}` as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        nextRetryAt: nextRetryTime as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createdAt: new Date() as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updatedAt: new Date() as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }).catch((err: any) => logger.warn("Failed to schedule retry", {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    templateData?: Record<string, any>,
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const renderTemplate = (str: string | null | undefined, data: Record<string, any> = {}): string => {
        if (!str) return '';
        return str.replace(/{{(\w+)}}/g, (match, key) => {
          return data[key]?.toString() ?? match;
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            lt(notificationQueue.attemptCount as any, maxRetries),
            eq(notificationQueue.organizationId, organizationId)
          ]
        : [
            or(
              eq(notificationQueue.status, 'failed'),
              eq(notificationQueue.status, 'retrying')
            ),
            lt(notificationQueue.nextRetryAt || now, now),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            lt(notificationQueue.attemptCount as any, maxRetries)
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
          const payload = queuedItem.payload as unknown as NotificationPayload;
          if (!payload) continue;

          const currentAttempt = parseInt(queuedItem.attemptCount?.toString() || '0', 10);
          
          // Send the notification
          const response = await this.send(payload);
          
          // Update queue entry with new status
          if (response.status === 'sent' || response.status === 'delivered') {
            await db.update(notificationQueue).set({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              status: 'completed' as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              processedAt: new Date() as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              completedAt: new Date() as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              resultNotificationId: response.id as any,
            }).where(eq(notificationQueue.id, queuedItem.id));
            succeeded++;
          } else {
            // Schedule next retry with exponential backoff
            const delaySeconds = 300 * Math.pow(2, currentAttempt);
            const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);
            
            await db.update(notificationQueue).set({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              status: 'retrying' as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              attemptCount: `${currentAttempt + 1}` as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              nextRetryAt: nextRetryAt as any,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              errorMessage: response.failureReason as any,
            }).where(eq(notificationQueue.id, queuedItem.id));
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
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                status: 'failed' as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                errorMessage: error instanceof Error ? error.message : 'Unknown error' as any,
              }).where(eq(notificationQueue.id, queuedItem.id));
            } else {
              const delaySeconds = 300 * Math.pow(2, currentAttempt);
              const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);
              
              await db.update(notificationQueue).set({
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                status: 'retrying' as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                attemptCount: `${currentAttempt + 1}` as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                nextRetryAt: nextRetryAt as any,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                errorMessage: error instanceof Error ? error.message : 'Unknown error' as any,
              }).where(eq(notificationQueue.id, queuedItem.id));
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      eq(notificationQueue.status, 'pending' as any)
    ).limit(batchSize);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;

    for (const queuedItem of pendingNotifications) {
      try {
        const payload = queuedItem.payload as unknown as NotificationPayload;
        if (!payload) continue;

        const response = await notificationService.send(payload);
        
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
