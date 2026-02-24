/**
 * Notification Worker - Processes multi-channel notifications
 * 
 * Dispatches notifications across email, SMS, push, and in-app channels
 * based on user preferences
 */

// Only import bullmq in runtime, not during build
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Worker: any, _Job: any, IORedis: any;

if (typeof window === 'undefined' && !process.env.__NEXT_BUILDING) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bullmq = require('bullmq');
    Worker = bullmq.Worker;
    _Job = bullmq.Job;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    IORedis = require('ioredis');
  } catch (_e) {
    // Fail silently during build
  }
}

import { addEmailJob } from '../job-queue';
import { addSmsJob } from '../job-queue';
import { db } from '@/db/db';
import { notificationHistory, userNotificationPreferences, inAppNotifications, pushDevices } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { FCMService } from '@/services/fcm-service';

const shouldLogInfo = process.env.NOTIFICATION_WORKER_VERBOSE === 'true';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function logWorkerInfo(message: string, context?: Record<string, any>) {
  if (shouldLogInfo) {
    logger.info(message, context);
  }
}

// Validate Redis configuration (deferred until actual use)
let connection: IORedis | null = null;

function getRedisConnection(): IORedis {
  if (connection) return connection;
  
  if (!process.env.REDIS_HOST) {
    throw new Error('REDIS_HOST is not configured. Set environment variable before starting notification worker.');
  }

  if (!process.env.REDIS_PORT) {
    throw new Error('REDIS_PORT is not configured. Set environment variable before starting notification worker.');
  }

  connection = new IORedis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT),
    maxRetriesPerRequest: null,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
  });
  
  return connection;
}

/**
 * Get user's notification preferences
 */
async function getUserPreferences(userId: string) {
  const preferences = await db.query.userNotificationPreferences.findFirst({
    where: eq(userNotificationPreferences.userId, userId),
  });

  // Return defaults if not found
  return preferences || {
    userId,
    emailEnabled: true,
    smsEnabled: false,
    pushEnabled: true,
    inAppEnabled: true,
    digestFrequency: 'daily',
    quietHoursStart: null,
    quietHoursEnd: null,
  };
}

/**
 * Check if currently in user's quiet hours
 */
function isQuietHours(
  quietHoursStart: string | null,
  quietHoursEnd: string | null
): boolean {
  if (!quietHoursStart || !quietHoursEnd) {
    return false;
  }

  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;

  const [startHour, startMinute] = quietHoursStart.split(':').map(Number);
  const [endHour, endMinute] = quietHoursEnd.split(':').map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;

  if (startTime < endTime) {
    return currentTime >= startTime && currentTime <= endTime;
  } else {
    // Quiet hours span midnight
    return currentTime >= startTime || currentTime <= endTime;
  }
}

/**
 * Send in-app notification
 */
async function sendInAppNotification(
  userId: string,
  title: string,
  message: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: Record<string, any>,
  organizationId?: string
) {
  await db.insert(inAppNotifications).values({
    userId,
    tenantId: organizationId || 'default',
    title,
    message,
    data,
    read: false,
    createdAt: new Date(),
  });

  // Send real-time update via Redis pub/sub (WebSocket server subscribes to this)
  try {
    const redis = getRedisConnection();
    await redis.publish(
      `notifications:${organizationId || 'default'}:${userId}`,
      JSON.stringify({
        type: 'notification',
        userId,
        tenantId: organizationId || 'default',
        title,
        message,
        data,
        timestamp: new Date().toISOString(),
      })
    );
    
    logWorkerInfo('In-app notification sent with real-time pub/sub', { userId });
  } catch (error) {
    logger.warn('Failed to publish real-time notification', { userId, error: error instanceof Error ? error.message : String(error) });
    logWorkerInfo('In-app notification saved to database', { userId });
  }
}

/**
 * Process notification job
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processNotification(job: any) {
  const { userId, title, message, data, channels } = job.data;

  logWorkerInfo('Processing notification job', { jobId: job.id, userId });

  await job.updateProgress(10);

  // Get user preferences
  const preferences = await getUserPreferences(userId);
  const inQuietHours = isQuietHours(
    preferences.quietHoursStart,
    preferences.quietHoursEnd
  );

  await job.updateProgress(20);

  // Determine which channels to use
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const enabledChannels = channels.filter((channel: any) => {
    switch (channel) {
      case 'email':
        return preferences.emailEnabled && !inQuietHours;
      case 'sms':
        return preferences.smsEnabled && !inQuietHours;
      case 'push':
        return preferences.pushEnabled && !inQuietHours;
      case 'in-app':
        return preferences.inAppEnabled;
      default:
        return false;
    }
  });

  if (enabledChannels.length === 0) {
    logWorkerInfo('No enabled channels for user', { userId, inQuietHours });
    return { success: true, sent: 0, channels: [] };
  }

  logWorkerInfo('Sending notification', { userId, channels: enabledChannels });

  await job.updateProgress(40);

  // Send to each enabled channel
  const results = await Promise.allSettled(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    enabledChannels.map(async (channel: any) => {
      switch (channel) {
        case 'email':
          // Get user email
          const userEmail = ('email' in preferences ? preferences.email : null) || (await getUserEmail(userId));
          if (userEmail) {
            await addEmailJob({
              to: userEmail,
              subject: title,
              template: 'notification',
              data: { title, message, ...data },
            });
            return { channel, success: true };
          }
          throw new Error('User email not found');

        case 'sms':
          // Get user phone
          const userPhone = 'phone' in preferences ? preferences.phone : null;
          if (userPhone) {
            await addSmsJob({
              to: userPhone,
              message: `${title}: ${message}`,
            });
            return { channel, success: true };
          }
          throw new Error('User phone not found');

        case 'push':
          // Send push notification via FCM
          try {
            // Get user's registered devices
            const devices = await db
              .select()
              .from(pushDevices)
              .where(
                and(
                  eq(pushDevices.profileId, userId),
                  eq(pushDevices.enabled, true)
                )
              );

            if (devices.length === 0) {
              logger.warn('No active push devices found for user', { userId });
              return { channel, success: false, error: 'No active devices' };
            }

            // Send push notification to all user's devices
            const pushResults = await FCMService.sendToUser({
              userId,
              title,
              body: message,
              data: {
                ...data,
                notificationId: job.id || '',
              },
              priority: data?.priority || 'normal',
              clickAction: data?.actionUrl || undefined,
            });

            const successCount = pushResults.filter(r => r.success).length;
            logger.info('Push notifications sent', { 
              userId, 
              title, 
              devicesCount: devices.length,
              successCount 
            });

            return { 
              channel, 
              success: successCount > 0,
              sentTo: successCount,
              totalDevices: devices.length
            };
          } catch (error) {
            logger.error('Push notification failed', error instanceof Error ? error : new Error(String(error)), { userId, title });
            throw error;
          }

        case 'in-app':
          await sendInAppNotification(userId, title, message, data, data?.organizationId);
          return { channel, success: true };

        default:
          throw new Error(`Unknown channel: ${channel}`);
      }
    })
  );

  await job.updateProgress(80);

  // Log to history
  const successfulChannels = results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.status === 'fulfilled')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((r: any) => (r as PromiseFulfilledResult<any>).value.channel);

  const failedChannels = results
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((r: any) => r.status === 'rejected')
    .map((r, i) => ({
      channel: enabledChannels[i],
      error: (r as PromiseRejectedResult).reason,
    }));

  await db.insert(notificationHistory).values({
    userId,
    channel: 'multi',
    recipient: userId,
    subject: title,
    template: 'notification',
    status: failedChannels.length === 0 ? 'sent' : 'partial',
    error: failedChannels.length > 0 
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? `Failed channels: ${failedChannels.map((f: any) => f.channel).join(', ')}`
      : undefined,
    sentAt: new Date(),
    metadata: {
      channels: successfulChannels,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      failedChannels: failedChannels.map((f: any) => f.channel),
    },
  });

  await job.updateProgress(100);

  return {
    success: failedChannels.length === 0,
    sent: successfulChannels.length,
    failed: failedChannels.length,
    channels: successfulChannels,
  };
}

/**
 * Get user email from Clerk
 */
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const { createClerkClient } = await import('@clerk/backend');
    
    const clerkClient = createClerkClient({
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    // Fetch user from Clerk
    const user = await clerkClient.users.getUser(userId);
    
    // Get primary email address
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const primaryEmail = user.emailAddresses?.find((email: any) => email.id === user.primaryEmailAddressId);
    
    if (primaryEmail?.emailAddress) {
      logger.info('Retrieved primary email for user', { userId });
      return primaryEmail.emailAddress;
    }

    // Fallback to first email if no primary email found
    const firstEmail = user.emailAddresses?.[0]?.emailAddress;
    if (firstEmail) {
      logger.info('Retrieved fallback email for user', { userId });
      return firstEmail;
    }

    logger.warn('No email found for user', { userId });
    return null;
  } catch (error) {
    logger.error('Error fetching user email from Clerk', error instanceof Error ? error : new Error(String(error)), { userId });
    return null;
  }
}

// Create worker
export const notificationWorker = new Worker(
  'notifications',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (job: any) => {
    return await processNotification(job);
  },
  {
    connection,
    concurrency: 10,
  }
);

// Event handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
notificationWorker.on('completed', (job: any) => {
  logWorkerInfo('Notification job completed', { jobId: job.id });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
notificationWorker.on('failed', (job: any, err: any) => {
  logger.error('Notification job failed', err instanceof Error ? err : new Error(String(err)), { jobId: job?.id });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
notificationWorker.on('error', (err: any) => {
  logger.error('Notification worker error', err instanceof Error ? err : new Error(String(err)));
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down notification worker');
  await notificationWorker.close();
  await connection.quit();
  logger.info('Notification worker stopped');
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

