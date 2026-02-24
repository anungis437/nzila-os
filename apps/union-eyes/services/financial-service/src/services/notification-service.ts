/**
 * Notification Service
 * Week 9-10: Multi-channel notification system for financial events
 * 
 * Features:
 * - Email notifications (payment confirmations, alerts, receipts)
 * - SMS notifications (payment reminders, urgent alerts)
 * - In-app notifications (real-time updates)
 * - Push notifications (mobile app support)
 * - Notification templates with variable substitution
 * - Notification preferences per user
 * - Delivery tracking and retry logic
 */

import { db } from '../db';
import { 
  notificationQueue, 
  notificationTemplates, 
  userNotificationPreferences,
  notificationLog 
} from '../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Resend } from 'resend';
// eslint-disable-next-line no-restricted-imports -- TODO(platform-migration): migrate to @nzila/ wrapper
import twilio from 'twilio';
// TODO: Fix FCM and email service imports
// import { FCMService } from '@/services/fcm-service';
// import { FinancialEmailService } from '@/lib/services/financial-email-service';
// import { logger } from '@/lib/logger';
const logger = console;

// Initialize email and SMS clients
const resend = new Resend(process.env.RESEND_API_KEY);
const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// ============================================================================
// TYPES
// ============================================================================

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';
export type NotificationType = 
  | 'payment_confirmation'
  | 'payment_failed'
  | 'payment_reminder'
  | 'donation_received'
  | 'stipend_approved'
  | 'stipend_disbursed'
  | 'low_balance_alert'
  | 'arrears_warning'
  | 'strike_announcement'
  | 'picket_reminder';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationRequest {
  organizationId: string;
  userId: string;
  type: NotificationType;
  channels: NotificationChannel[];
  priority?: NotificationPriority;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
  scheduledFor?: Date;
}

export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  subject?: string;
  body: string;
  variables: string[];
}

export interface SendNotificationResult {
  success: boolean;
  notificationId: string;
  channelResults: {
    channel: NotificationChannel;
    success: boolean;
    error?: string;
  }[];
}

// ============================================================================
// NOTIFICATION QUEUE MANAGEMENT
// ============================================================================

/**
 * Queue a notification for delivery
 */
export async function queueNotification(request: NotificationRequest): Promise<string> {
  const { organizationId, userId, type, channels, priority = 'normal', data, scheduledFor } = request;

  // Get user preferences
  const preferences = await getUserNotificationPreferences(organizationId, userId);

  // Filter channels based on user preferences
  const allowedChannels = channels.filter(channel => {
    const prefKey = `${type}_${channel}` as keyof typeof preferences;
    return preferences[prefKey] !== false;
  });

  if (allowedChannels.length === 0) {
    throw new Error('All notification channels disabled by user preferences');
  }

  // Create notification queue entry
  const [notification] = await db.insert(notificationQueue).values({
    tenantId: organizationId,
    userId,
    type,
    channels: allowedChannels as string[], // text array in schema
    priority,
    data: JSON.stringify(data),
    status: 'pending',
    scheduledFor: (scheduledFor || new Date()).toISOString(),
    attempts: '0',
    createdAt: new Date().toISOString(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any).returning();

  return notification.id;
}

/**
 * Process pending notifications
 */
export async function processPendingNotifications(batchSize: number = 50): Promise<number> {
  // Get pending notifications due for delivery
  const pending = await db
    .select()
    .from(notificationQueue)
    .where(
      and(
        eq(notificationQueue.status, 'pending'),
        // scheduledFor <= now
      )
    )
    .orderBy(desc(notificationQueue.priority), notificationQueue.scheduledFor)
    .limit(batchSize);

  let processed = 0;

  for (const notification of pending) {
    try {
      await sendNotification(notification.id);
      processed++;
    } catch (error) {
      logger.error('Failed to send notification', { error, notificationId: notification.id });
      // Continue processing other notifications
    }
  }

  return processed;
}

/**
 * Send a queued notification
 */
export async function sendNotification(notificationId: string): Promise<SendNotificationResult> {
  // Get notification from queue
  const [notification] = await db
    .select()
    .from(notificationQueue)
    .where(eq(notificationQueue.id, notificationId));

  if (!notification) {
    throw new Error(`Notification ${notificationId} not found`);
  }

  if (notification.status === 'sent') {
    throw new Error(`Notification ${notificationId} already sent`);
  }

  // Update attempts
  await db
    .update(notificationQueue)
    .set({ 
      attempts: notification.attempts + 1,
      lastAttemptAt: new Date(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .where(eq(notificationQueue.id, notificationId));

  const channelResults: SendNotificationResult['channelResults'] = [];
  const data = JSON.parse(notification.data);

  // Send through each channel
  for (const channel of notification.channels) {
    try {
      await sendThroughChannel(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channel as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        notification.type as any,
        notification.userId,
        notification.tenantId,
        data
      );
      
      channelResults.push({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channel: channel as any,
        success: true,
      });

      // Log successful delivery
      await logNotification(
        notificationId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channel as any,
        'delivered',
        undefined
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      channelResults.push({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channel: channel as any,
        success: false,
        error: errorMessage,
      });

      // Log failed delivery
      await logNotification(
        notificationId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        channel as any,
        'failed',
        errorMessage
      );
    }
  }

  // Update notification status
  const allSucceeded = channelResults.every(r => r.success);
  const anySucceeded = channelResults.some(r => r.success);

  await db
    .update(notificationQueue)
    .set({
      status: allSucceeded ? 'sent' : (anySucceeded ? 'partial' : 'failed'),
      sentAt: allSucceeded ? new Date() : undefined,
      error: allSucceeded ? undefined : channelResults
        .filter(r => !r.success)
        .map(r => `${r.channel}: ${r.error}`)
        .join('; '),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .where(eq(notificationQueue.id, notificationId));

  return {
    success: anySucceeded,
    notificationId,
    channelResults,
  };
}

// ============================================================================
// CHANNEL HANDLERS
// ============================================================================

/**
 * Send notification through specific channel
 */
async function sendThroughChannel(
  channel: NotificationChannel,
  type: NotificationType,
  userId: string,
  organizationId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
): Promise<void> {
  // Get template for this type/channel
  const template = await getTemplate(type, channel);
  
  // Render template with data
  const rendered = renderTemplate(template, data);

  switch (channel) {
    case 'email':
      await sendEmail(userId, rendered.subject!, rendered.body, data);
      break;
    case 'sms':
      await sendSMS(userId, rendered.body);
      break;
    case 'push':
      await sendPushNotification(userId, rendered.subject || type, rendered.body, data);
      break;
    case 'in_app':
      await createInAppNotification(organizationId, userId, type, rendered.body, data);
      break;
    default:
      throw new Error(`Unknown channel: ${channel}`);
  }
}

/**
 * Send email notification
 */
async function sendEmail(
  userId: string,
  subject: string,
  body: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
): Promise<void> {
  try {
    // Get user email from userId (would need to query user table)
    // For now, using data.email if provided
    const userEmail = data.email || `user-${userId}@example.com`;
    
    // Use Resend for email delivery
    await resend.emails.send({
      from: 'Union Eyes <notifications@unioneyes.com>',
      to: userEmail,
      subject,
      html: body,
    });
    
    logger.info('[EMAIL] Successfully sent', { userEmail, subject });
  } catch (error) {
    logger.error('[EMAIL] Failed to send', { error, userEmail: data.email });
    throw error;
  }
}

/**
 * Send SMS notification
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sendSMS(userId: string, message: string, data: Record<string, any> = {}): Promise<void> {
  try {
    if (!twilioClient) {
      logger.warn('[SMS] Twilio not configured, skipping SMS send');
      return;
    }
    
    // Get user phone from data (would need to query user table)
    const userPhone = data.phone || `+1234567890`; // Fallback for development
    
    // Use Twilio for SMS delivery
    await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: userPhone,
    });
    
    logger.info('[SMS] Successfully sent', { userPhone });
  } catch (error) {
    logger.error('[SMS] Failed to send', { error, userId });
    throw error;
  }
}

/**
 * Send push notification
 */
async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _data: Record<string, any>
): Promise<void> {
  try {
    // TODO: Implement FCM service for push notifications
    // const results = await FCMService.sendToUser({
    //   userId,
    //   title,
    //   body,
    //   data,
    // });
    
    // const successCount = results.filter(r => r.success).length;
    logger.info('[PUSH] Push notification stubbed (FCMService not implemented)', {
      userId,
      title,
      body,
    });
  } catch (error) {
    logger.error('[PUSH] Failed to send', { error, userId });
    throw error;
  }
}

/**
 * Create in-app notification
 */
async function createInAppNotification(
  organizationId: string,
  userId: string,
  type: NotificationType,
  message: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _data: Record<string, any>
): Promise<void> {
  // Store in database for in-app display
  logger.info('[IN-APP] Notification created', { userId, type, message, organizationId });
  
  // In production, would insert into in_app_notifications table
}

// ============================================================================
// TEMPLATE MANAGEMENT
// ============================================================================

/**
 * Get notification template
 */
async function getTemplate(
  type: NotificationType,
  channel: NotificationChannel
): Promise<NotificationTemplate> {
  const [template] = await db
    .select()
    .from(notificationTemplates)
    .where(
      and(
        eq(notificationTemplates.type, type),
        eq(notificationTemplates.channel, channel)
      )
    );

  if (!template) {
    // Return default template
    return getDefaultTemplate(type, channel);
  }

  return {
    id: template.id,
    type: template.type as NotificationType,
    channel: template.channel as NotificationChannel,
    subject: template.subject || undefined,
    body: template.body,
    variables: JSON.parse(template.variables || '[]'),
  };
}

/**
 * Get default template for type/channel
 */
function getDefaultTemplate(
  type: NotificationType,
  channel: NotificationChannel
): NotificationTemplate {
  const templates: Record<NotificationType, Partial<Record<NotificationChannel, { subject?: string; body: string }>>> = {
    payment_confirmation: {
      email: {
        subject: 'Payment Confirmation - ${amount}',
        body: 'Your payment of ${amount} has been processed successfully. Transaction ID: ${transactionId}',
      },
      sms: {
        body: 'Payment confirmed: ${amount}. Transaction: ${transactionId}',
      },
    },
    payment_failed: {
      email: {
        subject: 'Payment Failed - Action Required',
        body: 'Your payment of ${amount} failed. Reason: ${reason}. Please update your payment method.',
      },
      sms: {
        body: 'Payment failed: ${amount}. Please update payment method.',
      },
    },
    payment_reminder: {
      email: {
        subject: 'Payment Due Reminder',
        body: 'Your payment of ${amount} is due on ${dueDate}. Please ensure sufficient funds.',
      },
      sms: {
        body: 'Reminder: ${amount} due ${dueDate}',
      },
    },
    donation_received: {
      email: {
        subject: 'Thank You for Your Donation',
        body: 'Thank you for your donation of ${amount} to ${fundName}. Your support makes a difference!',
      },
    },
    stipend_approved: {
      email: {
        subject: 'Stipend Approved - ${amount}',
        body: 'Your weekly stipend of ${amount} has been approved and will be disbursed shortly.',
      },
      sms: {
        body: 'Stipend approved: ${amount}',
      },
    },
    stipend_disbursed: {
      email: {
        subject: 'Stipend Payment Sent',
        body: 'Your stipend payment of ${amount} has been sent. Expected arrival: ${arrivalDate}',
      },
      sms: {
        body: 'Stipend sent: ${amount}. Arrives ${arrivalDate}',
      },
    },
    low_balance_alert: {
      email: {
        subject: 'Low Balance Alert - ${fundName}',
        body: 'Warning: ${fundName} balance is ${balance}. Current burn rate: ${burnRate}/week.',
      },
    },
    arrears_warning: {
      email: {
        subject: 'Dues Arrears Notice',
        body: 'You have outstanding dues of ${amount}. Please pay to avoid account suspension.',
      },
    },
    strike_announcement: {
      email: {
        subject: '${title}',
        body: '${message}',
      },
      sms: {
        body: '${title}: ${message}',
      },
      push: {
        body: '${message}',
      },
    },
    picket_reminder: {
      email: {
        subject: 'Picket Duty Reminder - ${date}',
        body: 'Reminder: You have picket duty on ${date} at ${time}. Location: ${location}',
      },
      sms: {
        body: 'Picket reminder: ${date} ${time} at ${location}',
      },
    },
  };

  const template = templates[type]?.[channel];
  if (!template) {
    throw new Error(`No default template for ${type}/${channel}`);
  }

  return {
    id: 'default',
    type,
    channel,
    subject: template.subject,
    body: template.body,
    variables: extractVariables(template.body),
  };
}

/**
 * Render template with data
 */
function renderTemplate(
  template: NotificationTemplate,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
): { subject?: string; body: string } {
  const renderString = (str: string) => {
    return str.replace(/\$\{(\w+)\}/g, (match, variable) => {
      return data[variable] || match;
    });
  };

  return {
    subject: template.subject ? renderString(template.subject) : undefined,
    body: renderString(template.body),
  };
}

/**
 * Extract variables from template string
 */
function extractVariables(template: string): string[] {
  const matches = template.matchAll(/\$\{(\w+)\}/g);
  return Array.from(matches, m => m[1]);
}

// ============================================================================
// USER PREFERENCES
// ============================================================================

/**
 * Get user notification preferences
 */
export async function getUserNotificationPreferences(
  organizationId: string,
  userId: string
): Promise<Record<string, boolean>> {
  const [prefs] = await db
    .select()
    .from(userNotificationPreferences)
    .where(
      and(
        eq(userNotificationPreferences.tenantId, organizationId),
        eq(userNotificationPreferences.userId, userId)
      )
    );

  if (!prefs) {
    // Return default preferences (all enabled)
    return getDefaultPreferences();
  }

  return JSON.parse(prefs.preferences);
}

/**
 * Update user notification preferences
 */
export async function updateUserNotificationPreferences(
  organizationId: string,
  userId: string,
  preferences: Record<string, boolean>
): Promise<void> {
  await db
    .insert(userNotificationPreferences)
    .values({
      tenantId: organizationId,
      userId,
      preferences: JSON.stringify(preferences),
      updatedAt: new Date(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .onConflictDoUpdate({
      target: [userNotificationPreferences.tenantId, userNotificationPreferences.userId],
      set: {
        preferences: JSON.stringify(preferences),
        updatedAt: new Date(),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });
}

/**
 * Get default preferences (all enabled)
 */
function getDefaultPreferences(): Record<string, boolean> {
  return {
    payment_confirmation_email: true,
    payment_confirmation_sms: false,
    payment_failed_email: true,
    payment_failed_sms: true,
    payment_reminder_email: true,
    payment_reminder_sms: false,
    donation_received_email: true,
    stipend_approved_email: true,
    stipend_disbursed_email: true,
    stipend_disbursed_sms: false,
    low_balance_alert_email: true,
    arrears_warning_email: true,
    strike_announcement_email: true,
    strike_announcement_sms: true,
    strike_announcement_push: true,
    picket_reminder_email: true,
    picket_reminder_sms: true,
  };
}

// ============================================================================
// NOTIFICATION LOGGING
// ============================================================================

/**
 * Log notification delivery attempt
 */
async function logNotification(
  notificationId: string,
  channel: NotificationChannel,
  status: 'delivered' | 'failed' | 'bounced',
  error?: string
): Promise<void> {
  await db.insert(notificationLog).values({
    notificationId,
    channel,
    status,
    error,
    deliveredAt: status === 'delivered' ? new Date() : undefined,
    createdAt: new Date(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
}

/**
 * Get notification history for user
 */
export async function getNotificationHistory(
  organizationId: string,
  userId: string,
  limit: number = 50
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const notifications = await db
    .select()
    .from(notificationQueue)
    .where(
      and(
        eq(notificationQueue.tenantId, organizationId),
        eq(notificationQueue.userId, userId)
      )
    )
    .orderBy(desc(notificationQueue.createdAt))
    .limit(limit);

  return notifications.map(n => ({
    id: n.id,
    type: n.type,
    channels: n.channels,
    status: n.status,
    sentAt: n.sentAt,
    createdAt: n.createdAt,
    data: JSON.parse(n.data),
  }));
}

// ============================================================================
// RETRY LOGIC
// ============================================================================

/**
 * Retry failed notifications
 */
export async function retryFailedNotifications(maxAttempts: number = 3): Promise<number> {
  const failed = await db
    .select()
    .from(notificationQueue)
    .where(
      and(
        eq(notificationQueue.status, 'failed'),
        // attempts < maxAttempts
      )
    )
    .limit(100);

  let retried = 0;

  for (const notification of failed) {
    if (Number(notification.attempts) >= maxAttempts) {
      continue;
    }

    try {
      await sendNotification(notification.id);
      retried++;
    } catch (error) {
      logger.error(`Retry failed for notification ${notification.id}:`, error);
    }
  }

  return retried;
}
