/**
 * Education Reminders Cron Job
 * 
 * Protected by withApi cron auth (Phase 7 — Workflow Realignment).
 * - System-wide cron job uses withSystemContext() for unrestricted access
 * - Runs daily to send session reminders and certification expiry warnings
 */

import { withSystemContext } from '@/lib/db/with-rls-context';
import { db } from '@/db';
import { expiryWarningQuery, rowsOf, sessionReminderQuery, toExpiryWarning, toSessionReminder } from '@/lib/education/reminder-queries';
import { logger } from "@/lib/logger";
import { withApi } from '@/lib/api/framework';
import { jobResponse, type JobFailure } from '@/lib/operations/job-result';
import {
  batchSendSessionReminders,
  batchSendExpiryWarnings,
} from "@/lib/email/training-notifications";

export const dynamic = "force-dynamic";

// One run sends sequentially (with a pause between messages) inside a bounded request, so each kind is capped; the rest is reported as
// not processed rather than left to run past the job timeout.
const MAX_RECIPIENTS_PER_KIND = 300;
export const runtime = "nodejs";

/**
 * POST /api/cron/education-reminders
 * Automated job to send:
 * - Session reminders (7, 3, 1 day before)
 * - Certification expiry warnings (90, 30 days before)
 * 
 * Runs daily at 6 AM via Vercel Cron
 */
export const POST = withApi(
  {
    auth: { cron: true },
    openapi: { tags: ['Cron'], summary: 'Send education reminders and certification expiry warnings' },
  },
  async () => {

    const results = {
      sessionReminders: { sent: 0, failed: 0, errors: [] as string[] },
      expiryWarnings: { sent: 0, failed: 0, errors: [] as string[] },
      truncated: { sessionReminders: 0, expiryWarnings: 0 },
      timestamp: new Date().toISOString(),
    };

    // ========================================
    // 1. SESSION REMINDERS (7, 3, 1 day before)
    // ========================================
    
    // Use withSystemContext for system-wide cron job access
    const allSessionReminders = await withSystemContext(async () => {
      return rowsOf(await db.execute(sessionReminderQuery));
    });
    const sessionReminders = allSessionReminders.slice(0, MAX_RECIPIENTS_PER_KIND);
    // Query returns at most 301 rows, with the full cardinality in a window count.
    // Do not describe an unknown number of unprocessed recipients as zero.
    results.truncated.sessionReminders = Math.max(0, Number(allSessionReminders[0]?.total_due ?? allSessionReminders.length) - sessionReminders.length);

    if (sessionReminders.length > 0) {
      logger.info("Processing session reminders", {
        count: sessionReminders.length,
      });

      const reminderData = sessionReminders.map(toSessionReminder);

            results.sessionReminders = await batchSendSessionReminders(reminderData);
      
      logger.info("Session reminders completed", {
        sent: results.sessionReminders.sent,
        failed: results.sessionReminders.failed,
      });
    } else {
      logger.info("No session reminders to send today");
    }

    // ========================================
    // 2. CERTIFICATION EXPIRY WARNINGS (90, 30 days)
    // ========================================
    
    const allExpiryWarnings = await withSystemContext(async () => {
      return rowsOf(await db.execute(expiryWarningQuery));
    });
    const expiryWarnings = allExpiryWarnings.slice(0, MAX_RECIPIENTS_PER_KIND);
    results.truncated.expiryWarnings = Math.max(0, Number(allExpiryWarnings[0]?.total_due ?? allExpiryWarnings.length) - expiryWarnings.length);

    if (expiryWarnings.length > 0) {
      logger.info("Processing expiry warnings", {
        count: expiryWarnings.length,
      });

      const warningData = expiryWarnings.map(toExpiryWarning);

            results.expiryWarnings = await batchSendExpiryWarnings(warningData);
      
      logger.info("Expiry warnings completed", {
        sent: results.expiryWarnings.sent,
        failed: results.expiryWarnings.failed,
      });
    } else {
      logger.info("No expiry warnings to send today");
    }

    if (results.truncated.sessionReminders + results.truncated.expiryWarnings > 0) {
      logger.warn('Education reminders were capped for this run', results.truncated);
    }

    const failures: JobFailure[] = [];
    if (results.sessionReminders.failed > 0 || results.truncated.sessionReminders > 0) {
      failures.push({ scope: 'session-reminders', reason: `${results.sessionReminders.failed} send(s) failed; ${results.truncated.sessionReminders} recipient(s) unprocessed` });
    }
    if (results.expiryWarnings.failed > 0 || results.truncated.expiryWarnings > 0) {
      failures.push({ scope: 'expiry-warnings', reason: `${results.expiryWarnings.failed} send(s) failed; ${results.truncated.expiryWarnings} recipient(s) unprocessed` });
    }

    return jobResponse({
      job: 'education-reminders',
      attempted: 2,
      succeeded: 2 - failures.length,
      failures,
      details: {
        results,
        message: failures.length === 0
          ? "Education reminders processed successfully"
          : "Education reminders incomplete: failed sends or unprocessed recipients",
      },
    });
  },
);

