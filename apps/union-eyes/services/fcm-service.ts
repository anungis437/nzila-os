/**
 * Firebase Cloud Messaging (FCM) Integration Service
 * Handles push notification sending via FCM with batch processing, delivery tracking, and error handling
 * Supports iOS, Android, and Web push notifications
 * 
 * NOTE: Requires firebase-admin package to be installed.
 * Install with: pnpm add firebase-admin
 */

import { db } from '@/db';
import {
  pushDevices,
  pushNotifications,
  pushDeliveries,
  type PushDevice,
  type PushNotification,
} from '@/db/schema';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// Optional import - will be checked at runtime
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let admin: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  admin = require('firebase-admin');
} catch (_error) {
  logger.warn('firebase-admin not installed. FCM push notifications will be disabled.');
}

// =============================================
// TYPES
// =============================================

export interface FCMMessage {
  token: string;
  notification?: {
    title: string;
    body: string;
    imageUrl?: string;
  };
  data?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  android?: any; // AndroidConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apns?: any; // ApnsConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpush?: any; // WebpushConfig
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fcmOptions?: any; // FcmOptions
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface BatchSendResult {
  successCount: number;
  failureCount: number;
  results: Array<{
    deviceId: string;
    success: boolean;
    messageId?: string;
    error?: {
      code: string;
      message: string;
    };
  }>;
}

export interface TopicSubscriptionResult {
  successCount: number;
  failureCount: number;
  errors: Array<{
    index: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error: any; // FirebaseError
  }>;
}

export interface DirectSendResult {
  deviceId: string;
  success: boolean;
  messageId?: string;
  error?: {
    code: string;
    message: string;
  };
}

// =============================================
// INITIALIZATION
// =============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseApp: any = null; // app.App

/**
 * Initialize Firebase Admin SDK
 */
export function initializeFirebase() {
  if (firebaseApp) {
    return firebaseApp;
  }

  try {
    // Check if service account is configured
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) {
      logger.warn('Firebase service account not configured. Push notifications will not work.');
      return null;
    }

    // Parse service account JSON
    const credentials = JSON.parse(serviceAccount);

    // Initialize Firebase Admin
    if (admin) {
      firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(credentials),
      });
    }

    logger.info('Firebase Admin SDK initialized successfully');
    return firebaseApp;
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin SDK', { error });
    return null;
  }
}

/**
 * Get Firebase Messaging instance
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMessaging(): any | null { // Messaging
  const app = firebaseApp || initializeFirebase();
  if (!app) return null;

  try {
    return admin?.messaging(app);
  } catch (error) {
    logger.error('Failed to get Firebase Messaging instance', { error });
    return null;
  }
}

// =============================================
// MESSAGE BUILDING
// =============================================

/**
 * Build FCM message from notification data
 */
export function buildFCMMessage(
  notification: PushNotification,
  device: PushDevice
): FCMMessage {
  const message: FCMMessage = {
    token: device.deviceToken,
    notification: {
      title: notification.title,
      body: notification.body,
      imageUrl: notification.imageUrl || undefined,
    },
    data: {
      notificationId: notification.id,
      clickAction: notification.clickAction || '',
      ...(notification.actionButtons && {
        actionButtons: JSON.stringify(notification.actionButtons),
      }),
    },
  };

  // Platform-specific configurations
  if (device.platform === 'android') {
    message.android = {
      priority: notification.priority === 'urgent' ? 'high' : 'normal',
      ttl: (notification.ttl || 3600) * 1000, // Convert to milliseconds
      notification: {
        icon: notification.iconUrl || undefined,
        color: '#0066cc',
        sound: notification.sound || 'default',
        channelId: 'default',
        priority: notification.priority === 'urgent' ? 'high' : 'default',
        defaultSound: true,
        defaultVibrateTimings: true,
      },
    };
  } else if (device.platform === 'ios') {
    message.apns = {
      headers: {
        'apns-priority': notification.priority === 'urgent' ? '10' : '5',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + (notification.ttl || 3600)),
      },
      payload: {
        aps: {
          alert: {
            title: notification.title,
            body: notification.body,
          },
          badge: notification.badgeCount || undefined,
          sound: notification.sound || 'default',
          contentAvailable: true,
          mutableContent: true,
        },
      },
    };
  } else if (device.platform === 'web') {
    message.webpush = {
      headers: {
        TTL: String(notification.ttl),
        Urgency: notification.priority === 'urgent' ? 'high' : 'normal',
      },
      notification: {
        title: notification.title,
        body: notification.body,
        icon: notification.iconUrl || '/icons/notification-icon.png',
        image: notification.imageUrl || undefined,
        badge: '/icons/badge.png',
        requireInteraction: notification.priority === 'urgent',
        actions: notification.actionButtons?.map((btn) => ({
          action: btn.id,
          title: btn.title,
        })),
      },
      fcmOptions: {
        link: notification.clickAction || '/',
      },
    };
  }

  return message;
}

function buildDirectMessage(
  payload: {
    title: string;
    body: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data?: Record<string, any>;
    priority?: 'low' | 'normal' | 'high' | 'urgent';
    clickAction?: string;
  },
  device: PushDevice
): FCMMessage {
  const priority = payload.priority || 'normal';
  const dataPayload: Record<string, string> = {};

  if (payload.data) {
    Object.entries(payload.data).forEach(([key, value]) => {
      dataPayload[key] = String(value);
    });
  }

  if (payload.clickAction) {
    dataPayload.clickAction = payload.clickAction;
  }

  const message: FCMMessage = {
    token: device.deviceToken,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: dataPayload,
  };

  if (device.platform === 'android') {
    message.android = {
      priority: priority === 'urgent' ? 'high' : 'normal',
      notification: {
        channelId: 'default',
        sound: 'default',
        priority: priority === 'urgent' ? 'high' : 'default',
      },
    };
  } else if (device.platform === 'ios') {
    message.apns = {
      headers: {
        'apns-priority': priority === 'urgent' ? '10' : '5',
      },
      payload: {
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
          },
          sound: 'default',
        },
      },
    };
  } else if (device.platform === 'web') {
    message.webpush = {
      headers: {
        Urgency: priority === 'urgent' ? 'high' : 'normal',
      },
      notification: {
        title: payload.title,
        body: payload.body,
        icon: '/icons/notification-icon.png',
        badge: '/icons/badge.png',
        requireInteraction: priority === 'urgent',
      },
      fcmOptions: {
        link: payload.clickAction || '/',
      },
    };
  }

  return message;
}

// =============================================
// SENDING FUNCTIONS
// =============================================

/**
 * Send notification to a single device
 */
export async function sendToDevice(
  notificationId: string,
  deviceId: string
): Promise<SendResult> {
  const messaging = getMessaging();
  if (!messaging) {
    return {
      success: false,
      error: {
        code: 'unavailable',
        message: 'Firebase Messaging not initialized',
      },
    };
  }

  try {
    // Fetch notification and device
    const [notification] = await db
      .select()
      .from(pushNotifications)
      .where(eq(pushNotifications.id, notificationId));

    const [device] = await db
      .select()
      .from(pushDevices)
      .where(eq(pushDevices.id, deviceId));

    if (!notification || !device) {
      return {
        success: false,
        error: {
          code: 'not-found',
          message: 'Notification or device not found',
        },
      };
    }

    // Check if device is enabled
    if (!device.enabled) {
      return {
        success: false,
        error: {
          code: 'disabled',
          message: 'Device notifications are disabled',
        },
      };
    }

    // Check quiet hours
    if (device.quietHoursStart && device.quietHoursEnd) {
      const now = new Date();
      const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      if (currentTime >= device.quietHoursStart && currentTime <= device.quietHoursEnd) {
        return {
          success: false,
          error: {
            code: 'quiet-hours',
            message: 'Device is in quiet hours',
          },
        };
      }
    }

    // Build and send message
    const message = buildFCMMessage(notification, device);
    const response = await messaging.send(message);

    // Record delivery
    await db.insert(pushDeliveries).values({
      notificationId,
      deviceId,
      status: 'sent',
      fcmMessageId: response,
      sentAt: new Date(),
    });

    return {
      success: true,
      messageId: response,
    };
  } catch (error) {
    logger.error('Error sending to device', { error, deviceId, notificationId });

    // Handle specific FCM errors
    let errorCode = 'unknown';
    let errorMessage = error.message || 'Unknown error';

    if (error.code) {
      errorCode = error.code;

      // Handle invalid token
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        // Disable the device
        await db
          .update(pushDevices)
          .set({ enabled: false })
          .where(eq(pushDevices.id, deviceId));

        errorMessage = 'Invalid or expired device token';
      }
    }

    // Record failed delivery
    await db.insert(pushDeliveries).values({
      notificationId,
      deviceId,
      status: 'failed',
      errorCode,
      errorMessage,
      sentAt: new Date(),
    });

    return {
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
      },
    };
  }
}

/**
 * Send notification to multiple devices (batch)
 */
export async function sendToDevices(
  notificationId: string,
  deviceIds: string[]
): Promise<BatchSendResult> {
  const messaging = getMessaging();
  if (!messaging) {
    return {
      successCount: 0,
      failureCount: deviceIds.length,
      results: deviceIds.map((deviceId) => ({
        deviceId,
        success: false,
        error: {
          code: 'unavailable',
          message: 'Firebase Messaging not initialized',
        },
      })),
    };
  }

  const batchSize = 500; // FCM batch limit
  const results: BatchSendResult['results'] = [];

  // Process in batches
  for (let i = 0; i < deviceIds.length; i += batchSize) {
    const batchDeviceIds = deviceIds.slice(i, i + batchSize);

    // Send to each device in the batch
    const batchResults = await Promise.all(
      batchDeviceIds.map((deviceId) => sendToDevice(notificationId, deviceId))
    );

    // Collect results
    batchDeviceIds.forEach((deviceId, index) => {
      results.push({
        deviceId,
        ...batchResults[index],
      });
    });
  }

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  return {
    successCount,
    failureCount,
    results,
  };
}

/**
 * Send notification to all devices for a profile
 */
export async function sendToProfile(
  notificationId: string,
  profileId: string,
  organizationId: string
): Promise<BatchSendResult> {
  // Get all enabled devices for the profile
  const devices = await db
    .select({ id: pushDevices.id })
    .from(pushDevices)
    .where(
      and(
        eq(pushDevices.organizationId, organizationId),
        eq(pushDevices.profileId, profileId),
        eq(pushDevices.enabled, true)
      )
    );

  const deviceIds = devices.map((d) => d.id);

  if (deviceIds.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      results: [],
    };
  }

  return sendToDevices(notificationId, deviceIds);
}

/**
 * Send a direct push notification to all enabled devices for a user.
 * This is used by the notification worker for ad-hoc notifications.
 */
export async function sendToUser(payload: {
  userId: string;
  title: string;
  body: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  clickAction?: string;
}): Promise<DirectSendResult[]> {
  const messaging = getMessaging();
  if (!messaging) {
    return [];
  }

  const devices = await db
    .select()
    .from(pushDevices)
    .where(
      and(
        eq(pushDevices.profileId, payload.userId),
        eq(pushDevices.enabled, true)
      )
    );

  if (devices.length === 0) {
    return [];
  }

  const results = await Promise.all(
    devices.map(async (device) => {
      try {
        const message = buildDirectMessage(payload, device);
        const response = await messaging.send(message);

        return {
          deviceId: device.id,
          success: true,
          messageId: response,
        } as DirectSendResult;
      } catch (error) {
        const errorCode = error?.code || 'unknown';
        const errorMessage = error?.message || 'Unknown error';

        if (
          errorCode === 'messaging/invalid-registration-token' ||
          errorCode === 'messaging/registration-token-not-registered'
        ) {
          await db
            .update(pushDevices)
            .set({ enabled: false })
            .where(eq(pushDevices.id, device.id));
        }

        return {
          deviceId: device.id,
          success: false,
          error: {
            code: errorCode,
            message: errorMessage,
          },
        } as DirectSendResult;
      }
    })
  );

  return results;
}

/**
 * Send notification to a topic
 */
export async function sendToTopic(
  notification: PushNotification,
  topic: string
): Promise<SendResult> {
  const messaging = getMessaging();
  if (!messaging) {
    return {
      success: false,
      error: {
        code: 'unavailable',
        message: 'Firebase Messaging not initialized',
      },
    };
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const message: any = { // TopicMessage
      topic,
      notification: {
        title: notification.title,
        body: notification.body,
        imageUrl: notification.imageUrl || undefined,
      },
      data: {
        notificationId: notification.id,
        clickAction: notification.clickAction || '',
      },
      android: {
        priority: notification.priority === 'urgent' ? 'high' : 'normal',
        ttl: (notification.ttl || 3600) * 1000,
      },
      apns: {
        headers: {
          'apns-priority': notification.priority === 'urgent' ? '10' : '5',
        },
        payload: {
          aps: {
            badge: notification.badgeCount || undefined,
            sound: notification.sound || 'default',
          },
        },
      },
    };

    const response = await messaging.send(message);

    return {
      success: true,
      messageId: response,
    };
  } catch (error) {
    logger.error('Error sending to topic', { error, topic });

    return {
      success: false,
      error: {
        code: error.code || 'unknown',
        message: error.message || 'Unknown error',
      },
    };
  }
}

// =============================================
// TOPIC MANAGEMENT
// =============================================

/**
 * Subscribe devices to a topic
 */
export async function subscribeToTopic(
  deviceTokens: string[],
  topic: string
): Promise<TopicSubscriptionResult> {
  const messaging = getMessaging();
  if (!messaging) {
    return {
      successCount: 0,
      failureCount: deviceTokens.length,
      errors: [],
    };
  }

  try {
    const response = await messaging.subscribeToTopic(deviceTokens, topic);

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      errors: response.errors,
    };
  } catch (error) {
    logger.error('Error subscribing to topic', { error, topic });

    return {
      successCount: 0,
      failureCount: deviceTokens.length,
      errors: [],
    };
  }
}

/**
 * Unsubscribe devices from a topic
 */
export async function unsubscribeFromTopic(
  deviceTokens: string[],
  topic: string
): Promise<TopicSubscriptionResult> {
  const messaging = getMessaging();
  if (!messaging) {
    return {
      successCount: 0,
      failureCount: deviceTokens.length,
      errors: [],
    };
  }

  try {
    const response = await messaging.unsubscribeFromTopic(deviceTokens, topic);

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      errors: response.errors,
    };
  } catch (error) {
    logger.error('Error unsubscribing from topic', { error, topic });

    return {
      successCount: 0,
      failureCount: deviceTokens.length,
      errors: [],
    };
  }
}

// =============================================
// TOKEN MANAGEMENT
// =============================================

/**
 * Verify a device token is valid
 */
export async function verifyToken(token: string): Promise<boolean> {
  const messaging = getMessaging();
  if (!messaging) return false;

  try {
    // Try sending a dry-run message
    await messaging.send({
      token,
      data: { test: 'true' },
    }, true);

    return true;
  } catch (_error) {
    return false;
  }
}

/**
 * Clean up invalid tokens
 */
export async function cleanupInvalidTokens(organizationId: string): Promise<number> {
  const devices = await db
    .select()
    .from(pushDevices)
    .where(
      and(eq(pushDevices.organizationId, organizationId), eq(pushDevices.enabled, true))
    );

  let disabledCount = 0;

  for (const device of devices) {
    const isValid = await verifyToken(device.deviceToken);
    if (!isValid) {
      await db
        .update(pushDevices)
        .set({ enabled: false })
        .where(eq(pushDevices.id, device.id));
      disabledCount++;
    }
  }

  return disabledCount;
}

// =============================================
// DELIVERY TRACKING
// =============================================

/**
 * Update delivery status based on FCM callback
 */
export async function updateDeliveryStatus(
  fcmMessageId: string,
  status: 'delivered' | 'failed' | 'clicked' | 'dismissed',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventData?: any
): Promise<void> {
  const now = new Date();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: any = {
    status,
    eventData: eventData || undefined,
  };

  if (status === 'delivered') {
    updateData.deliveredAt = now;
  } else if (status === 'clicked') {
    updateData.clickedAt = now;
  } else if (status === 'dismissed') {
    updateData.dismissedAt = now;
  }

  await db
    .update(pushDeliveries)
    .set(updateData)
    .where(eq(pushDeliveries.fcmMessageId, fcmMessageId));
}

/**
 * Retry failed deliveries
 */
export async function retryFailedDeliveries(
  notificationId: string,
  maxRetries = 3
): Promise<BatchSendResult> {
  // Get failed deliveries with retry count < maxRetries
  const failedDeliveries = await db
    .select()
    .from(pushDeliveries)
    .where(
      and(
        eq(pushDeliveries.notificationId, notificationId),
        eq(pushDeliveries.status, 'failed'),
        sql`${pushDeliveries.retryCount} < ${maxRetries}`
      )
    );

  const deviceIds = failedDeliveries.map((d) => d.deviceId);

  if (deviceIds.length === 0) {
    return {
      successCount: 0,
      failureCount: 0,
      results: [],
    };
  }

  // Increment retry count
  await db
    .update(pushDeliveries)
    .set({ retryCount: sql`${pushDeliveries.retryCount} + 1` })
    .where(
      inArray(
        pushDeliveries.id,
        failedDeliveries.map((d) => d.id)
      )
    );

  // Retry sending
  return sendToDevices(notificationId, deviceIds);
}

// Initialize Firebase on module load
initializeFirebase();
