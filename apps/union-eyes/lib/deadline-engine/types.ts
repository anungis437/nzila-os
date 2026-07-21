/**
 * Union Eyes Deadline Engine — public types + Zod schemas
 *
 * These types describe the SERVICE-LAYER contract (inputs to
 * scheduleDeadlineReminders, worker outputs, audit metadata shape).
 * DB-shape types live in `db/schema/deadline-engine-schema.ts`.
 */
import { z } from 'zod';
import type {
  DeadlineReminder,
  DeadlineReminderExecution,
  DeadlineReminderKind,
  DeadlineReminderRecipientRole,
  DeadlineReminderStatus,
} from '@/db/schema/deadline-engine-schema';

export type {
  DeadlineReminder,
  DeadlineReminderExecution,
  DeadlineReminderKind,
  DeadlineReminderRecipientRole,
  DeadlineReminderStatus,
};

// ---------------------------------------------------------------------------
// Recipient snapshot
// ---------------------------------------------------------------------------
export const RecipientSnapshotSchema = z.object({
  userId: z.string().min(1).max(255).nullable(),
  role: z.enum(['grievor', 'assigned_officer', 'assigned_steward', 'org_admin']),
  email: z.string().email().max(320),
  locale: z.string().min(2).max(16).default('en'),
});
export type RecipientSnapshot = z.infer<typeof RecipientSnapshotSchema>;

// ---------------------------------------------------------------------------
// Scheduling input
// ---------------------------------------------------------------------------
export const ScheduleRemindersInputSchema = z.object({
  sourceTable: z.enum(['grievance_deadlines', 'claim_deadlines']),
  sourceDeadlineId: z.string().uuid(),
  organizationId: z.string().uuid(),
  dueDate: z.date(),
  timezone: z.string().min(3).max(64).default('UTC'),
  reminderOffsetsInDays: z.array(z.number().int().min(0).max(365)).min(1),
  recipients: z.array(RecipientSnapshotSchema).min(1),
  correlationId: z.string().min(1).max(128),
  actor: z
    .object({
      type: z.enum(['user', 'system', 'worker']),
      id: z.string().max(255).nullable(),
    })
    .default({ type: 'system', id: null }),
});
export type ScheduleRemindersInput = z.infer<typeof ScheduleRemindersInputSchema>;

// ---------------------------------------------------------------------------
// Worker output — structured (never a boolean)
// ---------------------------------------------------------------------------
export const WorkerRunResultSchema = z.object({
  runId: z.string(),
  workerInstance: z.string(),
  correlationId: z.string(),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  durationMs: z.number().int().min(0),
  examined: z.number().int().min(0),
  claimed: z.number().int().min(0),
  sent: z.number().int().min(0),
  transientFailures: z.number().int().min(0),
  permanentFailures: z.number().int().min(0),
  deadLettered: z.number().int().min(0),
  leasesRecovered: z.number().int().min(0),
  cancelledSkipped: z.number().int().min(0),
});
export type WorkerRunResult = z.infer<typeof WorkerRunResultSchema>;

// ---------------------------------------------------------------------------
// Audit metadata schemas (structured — no PII, no message content)
// ---------------------------------------------------------------------------
export const AuditMetadataSchema = z
  .record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .refine(
    (m) =>
      !('message_body' in m) &&
      !('recipient_email' in m) &&
      !('api_key' in m) &&
      !('authorization' in m),
    { message: 'Audit metadata must not contain PII, message content, or secrets' },
  );
export type AuditMetadata = z.infer<typeof AuditMetadataSchema>;
