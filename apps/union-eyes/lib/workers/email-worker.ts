/**
 * Email Worker - Processes email jobs from the queue
 * 
 * Handles all email sending with template rendering,
 * retry logic, and delivery tracking
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

import { sendEmail } from '../email-service';
import { render } from '@react-email/render';
import { db } from '../../db/db';
import { notificationHistory, userNotificationPreferences, inAppNotifications } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '@/lib/logger';

// Email templates
import WelcomeEmail from '../../emails/WelcomeEmail';
import PasswordResetEmail from '../../emails/PasswordResetEmail';
import DigestEmail from '../../emails/DigestEmail';
import ReportReadyEmail from '../../emails/ReportReadyEmail';
import DeadlineAlertEmail from '../../emails/DeadlineAlertEmail';
import NotificationEmail from '../../emails/NotificationEmail';

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Template renderers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const templateRenderers: Record<string, (data: any) => Promise<string>> = {
  'welcome': (data) => render(WelcomeEmail(data)),
  'password-reset': (data) => render(PasswordResetEmail(data)),
  'digest': (data) => render(DigestEmail(data)),
  'report-ready': (data) => render(ReportReadyEmail(data)),
  'deadline-alert': (data) => render(DeadlineAlertEmail(data)),
  'notification': (data) => render(NotificationEmail(data)),
  'raw-html': async (data) => data.html || '',
  
  // Report templates (all use ReportReadyEmail)
  'claims-report': (data) => render(ReportReadyEmail({ 
    reportType: 'Claims',
    reportUrl: data.reportUrl,
    expiresAt: data.expiresAt,
  })),
  'members-report': (data) => render(ReportReadyEmail({ 
    reportType: 'Members',
    reportUrl: data.reportUrl,
    expiresAt: data.expiresAt,
  })),
  'grievances-report': (data) => render(ReportReadyEmail({ 
    reportType: 'Grievances',
    reportUrl: data.reportUrl,
    expiresAt: data.expiresAt,
  })),
  'usage-report': (data) => render(ReportReadyEmail({ 
    reportType: 'Usage',
    reportUrl: data.reportUrl,
    expiresAt: data.expiresAt,
  })),
};

/**
 * Check if user wants email notifications
 */
async function checkUserPreferences(email: string): Promise<boolean> {
  try {
    const preferences = await db.query.userNotificationPreferences.findFirst({
      where: eq(userNotificationPreferences.email, email),
    });

    return preferences?.emailEnabled ?? true; // Default to enabled
  } catch (error) {
    logger.error('Error checking user preferences', error instanceof Error ? error : new Error(String(error)));
    return true; // Default to enabled on error
  }
}

/**
 * Log notification to history
 */
async function logNotification(
  userId: string | null,
  email: string,
  subject: string,
  template: string,
  status: 'sent' | 'failed',
  error?: string
) {
  try {
    await db.insert(notificationHistory).values({
      userId,
      channel: 'email',
      recipient: email,
      subject,
      template,
      status,
      error,
      sentAt: new Date(),
    });
  } catch (err) {
    logger.error('Error logging notification', err instanceof Error ? err : new Error(String(err)));
  }
}

/**
 * Process email job
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processEmailJob(job: any) {
  const { to, subject, template, data, priority } = job.data;

  logger.info('Processing email job', { jobId: job.id, template, recipientCount: Array.isArray(to) ? to.length : 1 });

  // Update progress
  await job.updateProgress(10);

  // Normalize recipients
  const recipients = Array.isArray(to) ? to : [to];

  // Check preferences and send to each recipient
  const results = await Promise.allSettled(
    recipients.map(async (email) => {
      // Check if user wants emails
      const wantsEmail = await checkUserPreferences(email);
      
      if (!wantsEmail && priority !== 1) {
        // Skip non-critical emails if user disabled
        logger.info('Skipping email (disabled by user)', { email });
        await logNotification(null, email, subject, template, 'sent', 'Skipped by user preference');
        return { email, skipped: true };
      }

      await job.updateProgress(30);

      // Render template
      let html: string;
      let text: string | undefined;
      try {
        const renderer = templateRenderers[template];
        if (!renderer) {
          throw new Error(`Unknown template: ${template}`);
        }
        html = await renderer(data);
        if (template === 'raw-html' && typeof data.text === 'string') {
          text = data.text;
        }
      } catch (error) {
        logger.error('Error rendering template', error instanceof Error ? error : new Error(String(error)), { template });
        throw error;
      }

      await job.updateProgress(60);

      // Send email
      try {
        const attachments = Array.isArray(data.attachments)
          ? data.attachments
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .filter((attachment: any) => attachment?.filename && attachment?.content)
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .map((attachment: any) => {
                if (attachment.encoding === 'base64' && typeof attachment.content === 'string') {
                  return {
                    filename: attachment.filename,
                    content: Buffer.from(attachment.content, 'base64'),
                  };
                }
                return {
                  filename: attachment.filename,
                  content: attachment.content,
                };
              })
          : undefined;

        await sendEmail({
          to: [{ email, name: data.userName || email }],
          subject,
          html,
          text,
          attachments,
        });

        await logNotification(data.userId || null, email, subject, template, 'sent');

        logger.info('Email sent successfully', { email });
        return { email, sent: true };
      } catch (error) {
        logger.error('Error sending email', error instanceof Error ? error : new Error(String(error)), { email });
        await logNotification(
          data.userId || null,
          email,
          subject,
          template,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
        throw error;
      }
    })
  );

  await job.updateProgress(100);

  // Check for failures
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const failures = results.filter((r: any) => r.status === 'rejected');
  if (failures.length > 0) {
    throw new Error(
      `Failed to send ${failures.length}/${recipients.length} emails`
    );
  }

  return {
    success: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sent: results.filter((r: any) => r.status === 'fulfilled').length,
    total: recipients.length,
  };
}

/**
 * Process digest email job
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function processDigestJob(job: any) {
  const { data: jobData } = job;
  const { frequency } = jobData.data;

  logger.info('Processing digest job', { jobId: job.id, frequency });

  // Get users who want digest emails
  const users = await db.query.userNotificationPreferences.findMany({
    where: and(
      eq(userNotificationPreferences.emailEnabled, true),
      eq(userNotificationPreferences.digestFrequency, frequency)
    ),
  });

  if (users.length === 0) {
    logger.info('No users want digest emails', { frequency });
    return { success: true, sent: 0, total: 0 };
  }

  logger.info('Sending digest emails', { frequency, userCount: users.length });

  // Send digest to each user
  let sent = 0;
  for (const user of users) {
    try {
      // Fetch unread in-app notifications for this user
      const unreadNotifications = await db
        .select({
          id: inAppNotifications.id,
          title: inAppNotifications.title,
          message: inAppNotifications.message,
          type: inAppNotifications.type,
          actionUrl: inAppNotifications.actionUrl,
          createdAt: inAppNotifications.createdAt,
        })
        .from(inAppNotifications)
        .where(
          and(
            eq(inAppNotifications.userId, user.userId!),
            eq(inAppNotifications.read, false)
          )
        )
        .orderBy(desc(inAppNotifications.createdAt))
        .limit(20);

      // Gather user's notifications from the past period
      const digestData = {
        userId: user.userId!,
        email: user.email,
        frequency,
        notifications: unreadNotifications,
      };

      const html = await render(DigestEmail(digestData));

      await sendEmail({
        to: [{ email: user.email, name: user.email }],
        subject: `Your ${frequency === 'daily' ? 'Daily' : 'Weekly'} Union Claims Digest`,
        html,
      });

      await logNotification(user.userId!, user.email, 'Digest', 'digest', 'sent');

      sent++;
    } catch (error) {
      logger.error('Error sending digest', error instanceof Error ? error : new Error(String(error)), { email: user.email });
    }
  }

  return { success: true, sent, total: users.length };
}

// Create worker
export const emailWorker = new Worker(
  'email',
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async (job: any) => {
    // Handle different job types
    if (job.name === 'email-digest') {
      return await processDigestJob(job);
    }

    return await processEmailJob(job);
  },
  {
    connection,
    concurrency: 5, // Process 5 emails concurrently
    limiter: {
      max: 100, // Max 100 emails
      duration: 60000, // Per minute
    },
  }
);

// Event handlers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
emailWorker.on('completed', (job: any) => {
  logger.info('Email job completed', { jobId: job.id });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
emailWorker.on('failed', (job: any, err: any) => {
  logger.error('Email job failed', err instanceof Error ? err : new Error(String(err)), { jobId: job?.id });
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
emailWorker.on('error', (err: any) => {
  logger.error('Email worker error', err instanceof Error ? err : new Error(String(err)));
});

// Graceful shutdown
async function shutdown() {
  logger.info('Shutting down email worker');
  await emailWorker.close();
  await connection.quit();
  logger.info('Email worker stopped');
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

