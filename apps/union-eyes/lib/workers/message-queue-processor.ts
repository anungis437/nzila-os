/**
 * Message Queue Processor
 * 
 * Background worker that processes queued messages from message_log table
 * and sends them via EmailService or SMSService.
 * 
 * Phase 4: Communications & Organizing
 * 
 * Integration Options:
 * 1. Vercel Cron: Create /api/cron/process-messages endpoint
 * 2. Node.js Cron: Run this as scheduled task
 * 3. Redis Queue (Bull/BullMQ): For production scale
 * 4. Temporal/Inngest: Enterprise workflow engine
 * 
 * Usage:
 * ```typescript
 * import { processMessageQueue } from '@/lib/workers/message-queue-processor';
 * await processMessageQueue();
 * ```
 */

import { db } from '@/database';
import { 
  message_log, 
  campaigns, 
  communicationPreferences 
} from '@/db/schema/phase-4-messaging-schema';
import { eq, and, lte, sql } from 'drizzle-orm';
import { getEmailService } from '@/lib/services/messaging/email-service';
import { getSMSService } from '@/lib/services/messaging/sms-service';
import { logger } from '@/lib/logger';

// Configuration
const BATCH_SIZE = 100; // Process 100 messages at a time
const MAX_RETRIES = 3;  // Retry failed messages up to 3 times
const RETRY_DELAYS = [5 * 60 * 1000, 30 * 60 * 1000, 2 * 60 * 60 * 1000]; // 5min, 30min, 2hr
const RATE_LIMIT_PER_SECOND = 10; // Max 10 messages per second

interface ProcessingStats {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * Main queue processor - processes all queued messages
 */
export async function processMessageQueue(): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    logger.info('Starting message queue processing');

    // Fetch queued messages that are ready to send
    const queuedMessages = await fetchQueuedMessages();
    
    if (queuedMessages.length === 0) {
      logger.info('No messages in queue');
      return stats;
    }

    logger.info('Found messages to process', { count: queuedMessages.length });

    // Process in batches
    for (let i = 0; i < queuedMessages.length; i += BATCH_SIZE) {
      const batch = queuedMessages.slice(i, i + BATCH_SIZE);
      const batchStats = await processBatch(batch);
      
      // Aggregate stats
      stats.processed += batchStats.processed;
      stats.sent += batchStats.sent;
      stats.failed += batchStats.failed;
      stats.skipped += batchStats.skipped;
      stats.errors.push(...batchStats.errors);

      // Rate limiting: wait between batches
      if (i + BATCH_SIZE < queuedMessages.length) {
        const delay = (BATCH_SIZE / RATE_LIMIT_PER_SECOND) * 1000;
        await sleep(delay);
      }
    }

    logger.info('Processing complete', stats);
    return stats;
  } catch (error) {
    logger.error('Fatal error in message queue processing', error);
    stats.errors.push(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return stats;
  }
}

/**
 * Fetch messages that are ready to send from the queue
 */
async function fetchQueuedMessages() {
  const now = new Date();

  return await db
    .select({
      id: message_log.id,
      campaignId: message_log.campaignId,
      recipientId: message_log.recipientId,
      recipientEmail: message_log.recipientEmail,
      recipientPhone: message_log.recipientPhone,
      channel: message_log.channel,
      subject: message_log.subject,
      body: message_log.body,
      variables: message_log.variables,
      retryCount: message_log.retryCount,
      scheduledAt: message_log.scheduledAt,
    })
    .from(message_log)
    .where(
      and(
        eq(message_log.status, 'queued'),
        lte(message_log.scheduledAt, now) // Only messages scheduled for now or earlier
      )
    )
    .orderBy(message_log.scheduledAt)
    .limit(BATCH_SIZE * 10); // Fetch multiple batches worth
}

/**
 * Process a batch of messages
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processBatch(messages: any[]): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const emailService = getEmailService();
  const smsService = getSMSService();

  for (const message of messages) {
    stats.processed++;

    try {
      // Check if recipient has opted out of this channel
      const shouldSkip = await shouldSkipMessage(message);
      if (shouldSkip) {
        await updateMessageStatus(message.id, 'skipped', 'Recipient opted out or quiet hours');
        stats.skipped++;
        continue;
      }

      // Send message based on channel
      let _success = false;
      let externalId: string | null = null;

      if (message.channel === 'email') {
        // Process variables/template substitution in body if needed
        let processedBody = message.body;
        if (message.variables && typeof message.variables === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          processedBody = substituteVariables(message.body, message.variables as Record<string, any>);
        }
        
        const messageId = await emailService.send({
          to: message.recipientEmail,
          subject: message.subject,
          body: processedBody,
        });
        _success = true;
        externalId = messageId || null;
      } else if (message.channel === 'sms') {
        // Process variables/template substitution in body if needed
        let processedBody = message.body;
        if (message.variables && typeof message.variables === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          processedBody = substituteVariables(message.body, message.variables as Record<string, any>);
        }
        
        const messageId = await smsService.send({
          to: message.recipientPhone,
          body: processedBody,
        });
        _success = true;
        externalId = messageId || null;
      } else {
        throw new Error(`Unsupported channel: ${message.channel}`);
      }

      // Update message status to sent
      await updateMessageStatus(message.id, 'sent', null, externalId);
      
      // Update campaign stats
      await incrementCampaignStat(message.campaignId, 'sent');
      
      stats.sent++;

      // Rate limiting within batch
      await sleep(1000 / RATE_LIMIT_PER_SECOND);

    } catch (error) {
      logger.error('Failed to send message', error, { messageId: message.id });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      stats.errors.push(`Message ${message.id}: ${errorMessage}`);

      // Determine if we should retry
      const retryCount = message.retryCount || 0;
      
      if (retryCount < MAX_RETRIES) {
        // Schedule retry
        const nextRetryAt = new Date(Date.now() + RETRY_DELAYS[retryCount]);
        await scheduleRetry(message.id, retryCount + 1, nextRetryAt, errorMessage);
        logger.info('Scheduled message retry', { 
          messageId: message.id, 
          retryCount: retryCount + 1, 
          nextRetryAt 
        });
      } else {
        // Max retries reached, mark as failed
        await updateMessageStatus(message.id, 'failed', errorMessage);
        await incrementCampaignStat(message.campaignId, 'failed');
        stats.failed++;
      }
    }
  }

  return stats;
}

/**
 * Check if message should be skipped (quiet hours, opt-out, etc.)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function shouldSkipMessage(message: any): Promise<boolean> {
  if (!message.recipientId) return false;

  try {
    // Fetch recipient preferences
    const [prefs] = await db
      .select()
      .from(communicationPreferences)
      .where(eq(communicationPreferences.userId, message.recipientId))
      .limit(1);

    if (!prefs) return false;

    // Check if channel is disabled (emailOptIn/smsOptIn are strings: 'true' or 'false')
    if (message.channel === 'email' && prefs.emailOptIn !== 'true') return true;
    if (message.channel === 'sms' && prefs.smsOptIn !== 'true') return true;

    // Check quiet hours (only for non-urgent messages)
    // Note: Campaign type checking removed as schema doesn&apos;t have a type field
    // Quiet hours apply to all messages unless they need immediate delivery
    if (prefs.quietHoursStart && prefs.quietHoursEnd) {
      const now = new Date();
      const isQuietHour = checkQuietHours(now, prefs.quietHoursStart, prefs.quietHoursEnd);
      if (isQuietHour) {
        // Reschedule for after quiet hours
        const nextAvailableTime = calculateNextAvailableTime(now, prefs.quietHoursStart, prefs.quietHoursEnd);
        await db
          .update(message_log)
          .set({ scheduledAt: nextAvailableTime })
          .where(eq(message_log.id, message.id));
        return true; // Skip for now, will process later
      }
    }

    return false;
  } catch (error) {
    logger.error('Error checking if should skip', error);
    return false; // Don&apos;t skip on error
  }
}

/**
 * Check if current time falls within quiet hours
 */
function checkQuietHours(now: Date, quietHoursStart: string, quietHoursEnd: string): boolean {
  if (!quietHoursStart || !quietHoursEnd) return false;

  // Parse time strings (format: "HH:MM")
  const [startHour, startMinute] = quietHoursStart.split(':').map(Number);
  const [endHour, endMinute] = quietHoursEnd.split(':').map(Number);

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = endHour * 60 + endMinute;

  // Handle overnight quiet hours (e.g., 22:00 to 08:00)
  if (startMinutes > endMinutes) {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  } else {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  }
}

/**
 * Calculate next available time after quiet hours
 */
function calculateNextAvailableTime(now: Date, quietHoursStart: string, quietHoursEnd: string): Date {
  const [endHour, endMinute] = quietHoursEnd.split(':').map(Number);
  
  const nextAvailable = new Date(now);
  nextAvailable.setHours(endHour, endMinute, 0, 0);

  // If end time is earlier than current time, it means quiet hours end tomorrow
  if (nextAvailable <= now) {
    nextAvailable.setDate(nextAvailable.getDate() + 1);
  }

  return nextAvailable;
}

/**
 * Update message status in database
 */
async function updateMessageStatus(
  messageId: string,
  status: string,
  errorMessage: string | null = null,
  externalId: string | null = null
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates: any = {
    status,
    updatedAt: new Date(),
  };

  if (status === 'sent') {
    updates.sentAt = new Date();
  }

  if (errorMessage) {
    updates.errorMessage = errorMessage;
  }

  if (externalId) {
    updates.externalMessageId = externalId;
  }

  await db
    .update(message_log)
    .set(updates)
    .where(eq(message_log.id, messageId));
}

/**
 * Schedule message retry
 */
async function scheduleRetry(
  messageId: string,
  retryCount: number,
  nextRetryAt: Date,
  errorMessage: string
) {
  await db
    .update(message_log)
    .set({
      retryCount,
      scheduledAt: nextRetryAt,
      errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(message_log.id, messageId));
}

/**
 * Increment campaign statistic
 */
async function incrementCampaignStat(campaignId: string, stat: 'sent' | 'failed') {
  if (stat === 'sent') {
    await db
      .update(campaigns)
      .set({
        sentCount: sql`COALESCE(${campaigns.sentCount}, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));
  } else {
    await db
      .update(campaigns)
      .set({
        failedCount: sql`COALESCE(${campaigns.failedCount}, 0) + 1`,
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, campaignId));
  }
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Process a single campaign's messages (for immediate send)
 */
export async function processCampaignMessages(campaignId: string): Promise<ProcessingStats> {
  const stats: ProcessingStats = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    logger.info('Processing campaign', { campaignId });

    // Fetch all queued messages for this campaign
    const messages = await db
      .select()
      .from(message_log)
      .where(
        and(
          eq(message_log.campaignId, campaignId),
          eq(message_log.status, 'queued')
        )
      )
      .orderBy(message_log.createdAt);

    if (messages.length === 0) {
      logger.info('No queued messages for campaign', { campaignId });
      return stats;
    }

    // Process in batches
    for (let i = 0; i < messages.length; i += BATCH_SIZE) {
      const batch = messages.slice(i, i + BATCH_SIZE);
      const batchStats = await processBatch(batch);
      
      stats.processed += batchStats.processed;
      stats.sent += batchStats.sent;
      stats.failed += batchStats.failed;
      stats.skipped += batchStats.skipped;
      stats.errors.push(...batchStats.errors);

      // Update campaign status after each batch
      if (stats.sent > 0) {
        await db
          .update(campaigns)
          .set({
            status: 'sending',
            startedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, campaignId));
      }

      // Rate limiting
      if (i + BATCH_SIZE < messages.length) {
        await sleep((BATCH_SIZE / RATE_LIMIT_PER_SECOND) * 1000);
      }
    }

    // Mark campaign as complete if all processed
    const remainingQueued = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(message_log)
      .where(
        and(
          eq(message_log.campaignId, campaignId),
          eq(message_log.status, 'queued')
        )
      );

    if (remainingQueued[0].count === 0) {
      await db
        .update(campaigns)
        .set({
          status: 'sent',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(campaigns.id, campaignId));
      
      logger.info('Campaign completed', { campaignId });
    }

    return stats;
  } catch (error) {
    logger.error('Error processing campaign', error, { campaignId });
    stats.errors.push(`Campaign error: ${error instanceof Error ? error.message : 'Unknown'}`);
    return stats;
  }
}

/**
 * Health check - returns queue status
 */
export async function getQueueStatus() {
  const now = new Date();

  const [queuedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(message_log)
    .where(eq(message_log.status, 'queued'));

  const [readyCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(message_log)
    .where(
      and(
        eq(message_log.status, 'queued'),
        lte(message_log.scheduledAt, now)
      )
    );

  const [failedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(message_log)
    .where(eq(message_log.status, 'failed'));

  return {
    queued: queuedCount.count,
    ready: readyCount.count,
    failed: failedCount.count,
    timestamp: now,
  };
}

/**
 * Substitute variables in message template
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function substituteVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // Support both {{variable}} and {variable} syntax
    result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    result = result.replace(new RegExp(`{${key}}`, 'g'), String(value));
  }
  return result;
}
