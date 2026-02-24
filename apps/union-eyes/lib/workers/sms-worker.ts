/**
 * SMS Worker - Processes SMS jobs from the queue
 * 
 * Handles SMS sending via Twilio with delivery tracking
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

import { db } from '../../db/db';
import { notificationHistory, userNotificationPreferences } from '../../db/schema';
import { eq } from 'drizzle-orm';
// eslint-disable-next-line no-restricted-imports -- TODO(platform-migration): migrate to @nzila/ wrapper
import twilio from 'twilio';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

/**
 * Validate Twilio environment variables at startup
 */
function validateTwilioConfig(): { valid: boolean; error?: string } {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    return { valid: false, error: 'TWILIO_ACCOUNT_SID not configured' };
  }
  if (!process.env.TWILIO_AUTH_TOKEN) {
    return { valid: false, error: 'TWILIO_AUTH_TOKEN not configured' };
  }
  if (!process.env.TWILIO_PHONE_NUMBER) {
    return { valid: false, error: 'TWILIO_PHONE_NUMBER not configured' };
  }
  return { valid: true };
}

// Initialize Twilio client with proper validation
const twilioConfig = validateTwilioConfig();
const twilioClient = twilioConfig.valid
  ? twilio(process.env.TWILIO_ACCOUNT_SID!, process.env.TWILIO_AUTH_TOKEN!)
  : null;

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

// Log Twilio configuration status
if (twilioClient) {
} else {
}

/**
 * Check if user wants SMS notifications
 */
async function checkUserPreferences(phone: string): Promise<boolean> {
  try {
    const preferences = await db.query.userNotificationPreferences.findFirst({
      where: eq(userNotificationPreferences.phone, phone),
    });

    return preferences?.smsEnabled ?? false; // Default to disabled
  } catch (_error) {
return false;
  }
}

/**
 * Log SMS to history
 */
async function logSms(
  userId: string | null,
  phone: string,
  message: string,
  status: 'sent' | 'failed',
  error?: string,
  twilioSid?: string
) {
  try {
    await db.insert(notificationHistory).values({
      userId,
      channel: 'sms',
      recipient: phone,
      subject: message.substring(0, 100),
      template: 'sms',
      status,
      error,
      sentAt: new Date(),
      metadata: { twilioSid },
    });
  } catch (_err) {
}
}

/**
 * Format phone number to E.164 format
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Add country code if not present (assume US)
  if (digits.length === 10) {
    return `+1${digits}`;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Already has country code
  return `+${digits}`;
}

/**
 * Process SMS job
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processSmsJob(job: any) {
  const { to, message, priority } = job.data;
// Check if Twilio is configured
  if (!twilioClient || !TWILIO_PHONE_NUMBER) {
await logSms(null, to, message, 'failed', 'Twilio not configured');
    return { success: false, error: 'Twilio not configured' };
  }

  await job.updateProgress(10);

  // Format phone number
  const formattedPhone = formatPhoneNumber(to);

  // Check if user wants SMS (skip for critical priority)
  if (priority !== 1) {
    const wantsSms = await checkUserPreferences(formattedPhone);
    if (!wantsSms) {
await logSms(null, formattedPhone, message, 'sent', 'Skipped by user preference');
      return { success: true, skipped: true };
    }
  }

  await job.updateProgress(30);

  // Send SMS via Twilio
  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: formattedPhone,
    });

    await job.updateProgress(80);

    await logSms(null, formattedPhone, message, 'sent', undefined, result.sid);

    // Log without exposing full phone number
    const _maskedPhone = formattedPhone.replace(/(\+\d{1,3})(\d+)(\d{4})/, '$1****$3');
await job.updateProgress(100);

    return {
      success: true,
      sid: result.sid,
      status: result.status,
    };
  } catch (error) {
const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logSms(null, formattedPhone, message, 'failed', errorMessage);

    throw error;
  }
}

// Create worker
export const smsWorker = new Worker(
  'sms',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (job: any) => {
    return await processSmsJob(job);
  },
  {
    connection,
    concurrency: 3, // Process 3 SMS concurrently
    limiter: {
      max: 10, // Max 10 SMS
      duration: 1000, // Per second (Twilio rate limit)
    },
  }
);

// Event handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
smsWorker.on('completed', (_job: any) => {
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
smsWorker.on('failed', (_job: any, _err: any) => {
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
smsWorker.on('error', (_err: any) => {
});

// Graceful shutdown
async function shutdown() {
await smsWorker.close();
  await connection.quit();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

