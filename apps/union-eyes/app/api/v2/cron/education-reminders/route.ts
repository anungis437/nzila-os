/**
 * GET /api/cron/education-reminders
 * Migrated to withApi() framework
 */
import { db } from "@/db";
import { sql } from 'drizzle-orm';
import { timingSafeEqual } from 'crypto';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { logger } from "@/lib/logger";
import { withApi, ApiError } from '@/lib/api/framework';
 
 
 
 
 
 
import {
  batchSendSessionReminders,
  batchSendExpiryWarnings,
} from "@/lib/email/training-notifications";

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cron'],
      summary: 'GET education-reminders',
    },
  },
  async ({ request, userId: _userId, organizationId: _organizationId, user: _user, body: _body, query: _query, params: _params }) => {

        // Verify cron secret for security (timing-safe comparison)
        const authHeader = request.headers.get("authorization");
        const secret = authHeader?.replace('Bearer ', '') ?? '';
        const cronSecret = process.env.CRON_SECRET ?? '';
        const secretBuf = Buffer.from(secret);
        const expectedBuf = Buffer.from(cronSecret);
        if (cronSecret && (secretBuf.length !== expectedBuf.length || !timingSafeEqual(secretBuf, expectedBuf))) {
          logger.warn("Unauthorized cron job attempt", {
            authHeader: authHeader?.substring(0, 20),
          });
          throw ApiError.unauthorized('Unauthorized'
        );
        }
        const results = {
          sessionReminders: { sent: 0, failed: 0, errors: [] as string[] },
          expiryWarnings: { sent: 0, failed: 0, errors: [] as string[] },
          timestamp: new Date().toISOString(),
        };
        // ========================================
        // 1. SESSION REMINDERS (7, 3, 1 day before)
        // ========================================
        // Use withSystemContext for system-wide cron job access
        const sessionReminders = await withSystemContext(async () => {
          return await db.execute(sql`
            SELECT 
              m.email,
              m.first_name,
              m.last_name,
              c.course_name,
              cs.session_date,
              cs.session_time,
              cs.location,
              cs.duration_hours,
              i.first_name as instructor_first_name,
              i.last_name as instructor_last_name,
              EXTRACT(DAY FROM (cs.session_date - CURRENT_DATE))::int as days_until
            FROM course_registrations cr
            JOIN members m ON m.id = cr.member_id
            JOIN training_courses c ON c.id = cr.course_id
            JOIN course_sessions cs ON cs.id = cr.session_id
            LEFT JOIN members i ON i.id = cs.lead_instructor_id
            WHERE 
              cr.registration_status = 'registered'
              AND cs.session_status = 'scheduled'
              AND cs.session_date::date IN (
                CURRENT_DATE + INTERVAL '7 days',
                CURRENT_DATE + INTERVAL '3 days',
                CURRENT_DATE + INTERVAL '1 day'
              )
              AND m.email IS NOT NULL
              AND m.email != ''
            ORDER BY cs.session_date, m.email
          `) as Record<string, unknown>[];
        });
        if (sessionReminders.length > 0) {
          logger.info("Processing session reminders", {
            count: sessionReminders.length,
          });
          const reminderData = sessionReminders.map((row: Record<string, unknown>) => ({
            toEmail: row.email as string,
            memberName: `${row.first_name} ${row.last_name}`,
            courseName: row.course_name as string,
            sessionDate: new Date(row.session_date as string).toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            sessionTime: (row.session_time as string) || "TBD",
            daysUntilSession: row.days_until as number,
            location: (row.location as string | null) ?? undefined,
            instructorName: row.instructor_first_name
              ? `${row.instructor_first_name} ${row.instructor_last_name}`
              : undefined,
            sessionDuration: (row.duration_hours as number | null) ?? undefined,
          }));
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
        const expiryWarnings = await withSystemContext(async () => {
          return await db.execute(sql`
            SELECT 
              m.email,
              m.first_name,
              m.last_name,
              mc.certification_name,
              mc.certificate_number,
              mc.expiry_date,
              EXTRACT(DAY FROM (mc.expiry_date - CURRENT_DATE))::int as days_until_expiry,
              c.continuing_education_hours
            FROM member_certifications mc
            JOIN members m ON m.id = mc.member_id
            LEFT JOIN training_courses c ON c.provides_certification = mc.certification_name
            WHERE 
              mc.certification_status = 'active'
              AND mc.expiry_date::date IN (
                CURRENT_DATE + INTERVAL '90 days',
                CURRENT_DATE + INTERVAL '30 days'
              )
              AND m.email IS NOT NULL
              AND m.email != ''
            ORDER BY mc.expiry_date, m.email
          `) as Record<string, unknown>[];
        });
        if (expiryWarnings.length > 0) {
          logger.info("Processing expiry warnings", {
            count: expiryWarnings.length,
          });
          const warningData = expiryWarnings.map((row: Record<string, unknown>) => ({
            toEmail: row.email as string,
            memberName: `${row.first_name} ${row.last_name}`,
            certificationName: row.certification_name as string,
            certificateNumber: row.certificate_number as string,
            expiryDate: new Date(row.expiry_date as string).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            }),
            daysUntilExpiry: row.days_until_expiry as number,
            continuingEducationHours: (row.continuing_education_hours as number | null) ?? undefined,
          }));
          results.expiryWarnings = await batchSendExpiryWarnings(warningData);
          logger.info("Expiry warnings completed", {
            sent: results.expiryWarnings.sent,
            failed: results.expiryWarnings.failed,
          });
        } else {
          logger.info("No expiry warnings to send today");
        }
        // Return summary
        return { results,
          message: "Education reminders processed successfully", };
  },
);
