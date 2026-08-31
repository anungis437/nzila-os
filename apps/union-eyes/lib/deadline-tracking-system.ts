// ============================================================================
// DEADLINE TRACKING SYSTEM
// ============================================================================
// Description: Automatic deadline calculation, calendar integration, reminders,
//              escalation handling, and dashboard views
// Created: 2025-12-06
// ============================================================================

import { db } from "@/db/db";
import { eq, and, asc, lte } from "drizzle-orm";
import {
  grievanceDeadlines,
  grievances,
  notifications,
  type GrievanceDeadline,
} from "@/db/schema";
import { addDays, addBusinessDays, differenceInDays } from "date-fns";
import { createLogger } from "@nzila/os-core/telemetry";
import { scheduleGrievanceDeadlineReminders, cancelGrievanceDeadlineReminders } from "@/lib/deadline-engine";

const logger = createLogger("union-eyes.deadline-tracking-system");

// ============================================================================
// TYPES
// ============================================================================

export type DeadlineType =
  | "filing_deadline"
  | "response_required"
  | "hearing_date"
  | "appeal_deadline"
  | "arbitration_deadline"
  | "settlement_deadline"
  | "document_submission"
  | "investigation_completion"
  | "step_1_response"
  | "step_2_response"
  | "step_3_response"
  | "custom";

export type DeadlineCalculationRule = {
  type: DeadlineType;
  basedOn: "incident_date" | "filing_date" | "previous_step" | "hearing_date" | "custom_date";
  businessDays: number;
  calendarDays?: number;
  description: string;
  priority: "critical" | "high" | "medium" | "low";
  reminderSchedule: number[]; // Days before deadline to send reminders
};

export type DeadlineStatus = "upcoming" | "warning" | "overdue" | "completed" | "extended";

export type DeadlineAlert = {
  deadlineId: string;
  grievanceId: string;
  deadlineType: DeadlineType;
  dueDate: Date;
  daysRemaining: number;
  status: DeadlineStatus;
  priority: string;
  assignedTo?: string;
  description: string;
};

export type DeadlineExtensionRequest = {
  deadlineId: string;
  requestedBy: string;
  newDate: Date;
  reason: string;
  requiresApproval: boolean;
};

// ============================================================================
// PREDEFINED DEADLINE RULES (Based on common CBA timelines)
// ============================================================================

export const DEFAULT_DEADLINE_RULES: DeadlineCalculationRule[] = [
  {
    type: "filing_deadline",
    basedOn: "incident_date",
    businessDays: 30,
    description: "File grievance within 30 days of incident",
    priority: "critical",
    reminderSchedule: [7, 3, 1], // 7 days, 3 days, 1 day before
  },
  {
    type: "step_1_response",
    basedOn: "filing_date",
    businessDays: 10,
    description: "Management response to Step 1 grievance",
    priority: "high",
    reminderSchedule: [5, 2, 1],
  },
  {
    type: "step_2_response",
    basedOn: "previous_step",
    businessDays: 15,
    description: "Management response to Step 2 grievance",
    priority: "high",
    reminderSchedule: [7, 3, 1],
  },
  {
    type: "step_3_response",
    basedOn: "previous_step",
    businessDays: 20,
    description: "Management response to Step 3 grievance",
    priority: "high",
    reminderSchedule: [7, 3, 1],
  },
  {
    type: "appeal_deadline",
    basedOn: "previous_step",
    businessDays: 10,
    description: "Appeal decision to next step",
    priority: "critical",
    reminderSchedule: [5, 2, 1],
  },
  {
    type: "arbitration_deadline",
    basedOn: "previous_step",
    businessDays: 30,
    description: "File for arbitration",
    priority: "critical",
    reminderSchedule: [14, 7, 3, 1],
  },
  {
    type: "document_submission",
    basedOn: "hearing_date",
    businessDays: 7,
    description: "Submit required documents before hearing",
    priority: "high",
    reminderSchedule: [5, 2],
  },
  {
    type: "investigation_completion",
    basedOn: "filing_date",
    businessDays: 15,
    description: "Complete internal investigation",
    priority: "medium",
    reminderSchedule: [7, 3],
  },
];

// ============================================================================
// DEADLINE CREATION & CALCULATION
// ============================================================================

/**
 * Create deadline with automatic date calculation
 */
export async function createDeadline(
  grievanceId: string,
  deadlineType: DeadlineType,
  options: {
    referenceDate?: Date;
    customDays?: number;
    description?: string;
    priority?: "critical" | "high" | "medium" | "low";
    assignedTo?: string;
    useBusinessDays?: boolean;
  } = {}
): Promise<{ success: boolean; deadlineId?: string; dueDate?: Date; error?: string }> {
  try {
    // Validate grievance exists
    const grievance = await db.query.grievances.findFirst({
      where: eq(grievances.id, grievanceId),
    });

    if (!grievance) {
      return { success: false, error: "Grievance not found" };
    }

    // Get deadline rule
    const rule = DEFAULT_DEADLINE_RULES.find((r) => r.type === deadlineType);
    if (!rule && !options.customDays) {
      return {
        success: false,
        error: "No rule found for deadline type and no custom days provided",
      };
    }

    // Calculate due date
    let dueDate: Date;
    const referenceDate = options.referenceDate || new Date();
    const daysToAdd = options.customDays || rule!.businessDays;
    const useBusinessDays = options.useBusinessDays ?? true;

    if (useBusinessDays) {
      dueDate = addBusinessDays(referenceDate, daysToAdd);
    } else {
      dueDate = addDays(referenceDate, daysToAdd);
    }

    // Create deadline
    const [deadline] = await db
      .insert(grievanceDeadlines)
      .values({
        grievanceId,
        deadlineType,
        dueDate,
        description: options.description || rule?.description || `${deadlineType} deadline`,
        status: "pending",
        reminderDays: rule?.reminderSchedule || [7, 3, 1],
      })
      .returning();

    // Schedule reminders
    await scheduleReminders(deadline.id, dueDate, rule?.reminderSchedule || [7, 3, 1]);

    return {
      success: true,
      deadlineId: deadline.id,
      dueDate,
    };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create deadline",
    };
  }
}

/**
 * Create deadlines for all grievance steps automatically
 */
export async function createGrievanceStepDeadlines(
  grievanceId: string,
  filingDate: Date,
  _incidentDate: Date
): Promise<{ success: boolean; deadlineIds: string[]; error?: string }> {
    const deadlineIds: string[] = [];

    // Step 1 Response deadline (from filing date)
    const step1Result = await createDeadline(grievanceId, "step_1_response", {
      referenceDate: filingDate,
    });
    if (step1Result.deadlineId) deadlineIds.push(step1Result.deadlineId);

    // Appeal deadline (10 days after Step 1 expected response)
    if (step1Result.dueDate) {
      const appealResult = await createDeadline(grievanceId, "appeal_deadline", {
        referenceDate: step1Result.dueDate,
      });
      if (appealResult.deadlineId) deadlineIds.push(appealResult.deadlineId);
    }

    // Investigation completion deadline
    const investigationResult = await createDeadline(
      grievanceId,
      "investigation_completion",
      {
        referenceDate: filingDate,
      }
    );
    if (investigationResult.deadlineId) deadlineIds.push(investigationResult.deadlineId);

    return { success: true, deadlineIds };
}

/**
 * Mark deadline as completed
 *
 * Tenant-scoped: ownership is proven through the parent grievance's
 * organizationId (grievance_deadlines has no organizationId column of its
 * own). Cancels reminders in BOTH the legacy notifications queue and the
 * durable deadline-engine outbox so a completed deadline can never fire a
 * queued reminder afterward.
 */
export async function completeDeadline(
  deadlineId: string,
  organizationId: string,
  completedBy: string,
  notes?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const [owned] = await db
      .select({ id: grievanceDeadlines.id })
      .from(grievanceDeadlines)
      .innerJoin(grievances, eq(grievanceDeadlines.grievanceId, grievances.id))
      .where(
        and(
          eq(grievanceDeadlines.id, deadlineId),
          eq(grievances.organizationId, organizationId)
        )
      );

    if (!owned) {
      return { success: false, error: "Deadline not found" };
    }

    const completionNote = notes ? `Completed by ${completedBy}: ${notes}` : `Completed by ${completedBy}`;

    await db
      .update(grievanceDeadlines)
      .set({
        status: "completed",
        completedAt: new Date(),
        notes: completionNote,
      })
      .where(
        eq(grievanceDeadlines.id, deadlineId)
      );

    // Cancel any pending reminder notifications (legacy queue)
    await cancelDeadlineReminders(deadlineId);

    // Cancel any pending reminders in the durable deadline-engine outbox —
    // without this, a completed deadline can still fire an already-scheduled
    // reminder from the new outbox.
    await cancelGrievanceDeadlineReminders({
      sourceDeadlineId: deadlineId,
      organizationId,
      reason: "completed",
      actor: { type: "user", id: completedBy },
    });

    return { success: true };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to complete deadline",
    };
  }
}

/**
 * Request deadline extension
 */
export async function requestDeadlineExtension(
  request: DeadlineExtensionRequest
): Promise<{ success: boolean; error?: string }> {
  try {
    const deadline = await db.query.grievanceDeadlines.findFirst({
      where: eq(grievanceDeadlines.id, request.deadlineId),
    });

    if (!deadline) {
      return { success: false, error: "Deadline not found" };
    }

    // If no approval required, apply extension immediately
    if (!request.requiresApproval) {
      await db
        .update(grievanceDeadlines)
        .set({
          newDeadline: request.newDate,
          extensionGranted: true,
          status: "extended",
          notes: `Extended: ${request.reason}`,
        })
        .where(eq(grievanceDeadlines.id, request.deadlineId));

      // Reschedule reminders
      await scheduleReminders(
        request.deadlineId,
        request.newDate,
        deadline.reminderDays || [7, 3, 1]
      );
    } else {
      // Just save a note for the extension request
      await db
        .update(grievanceDeadlines)
        .set({ 
          notes: `Extension requested by ${request.requestedBy}: ${request.reason}. New date: ${request.newDate.toISOString()}`
        })
        .where(eq(grievanceDeadlines.id, request.deadlineId));
    }

    return { success: true };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to request extension",
    };
  }
}

/**
 * Approve deadline extension
 */
export async function approveDeadlineExtension(
  deadlineId: string,
  approvedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const deadline = await db.query.grievanceDeadlines.findFirst({
      where: eq(grievanceDeadlines.id, deadlineId),
    });

    if (!deadline) {
      return { success: false, error: "Deadline not found" };
    }

    // Check if there&apos;s a pending extension in notes
    if (!deadline.notes || !deadline.notes.includes("Extension requested")) {
      return { success: false, error: "No pending extension request found" };
    }

    // Apply extension using newDeadline field
    const newDate = deadline.newDeadline ? new Date(deadline.newDeadline) : new Date();

    await db
      .update(grievanceDeadlines)
      .set({
        dueDate: newDate,
        extensionGranted: true,
        status: "extended",
        notes: `${deadline.notes}\n\nExtension approved by ${approvedBy} on ${new Date().toISOString()}`,
      })
      .where(eq(grievanceDeadlines.id, deadlineId));

    // Reschedule reminders
    await scheduleReminders(deadlineId, newDate, deadline.reminderDays || [7, 3, 1]);

    return { success: true };
  } catch (error) {
return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to approve extension",
    };
  }
}

// ============================================================================
// DEADLINE MONITORING & ALERTS
// ============================================================================

/**
 * Get upcoming deadlines for an organization
 *
 * Tenant-scoped through an inner join on grievances — grievance_deadlines
 * has no organizationId column of its own, so ownership must be proven via
 * the grievanceId FK rather than a direct column filter.
 */
export async function getUpcomingDeadlines(
  organizationId: string,
  daysAhead: number = 30
): Promise<DeadlineAlert[]> {
  try {
    const today = new Date();
    const futureDate = addDays(today, daysAhead);

    const rows = await db
      .select({ deadline: grievanceDeadlines })
      .from(grievanceDeadlines)
      .innerJoin(grievances, eq(grievanceDeadlines.grievanceId, grievances.id))
      .where(
        and(
          eq(grievances.organizationId, organizationId),
          eq(grievanceDeadlines.status, "pending"),
          lte(grievanceDeadlines.dueDate, futureDate)
        )
      )
      .orderBy(asc(grievanceDeadlines.dueDate));

    return rows.map((r) => createDeadlineAlert(r.deadline));
  } catch (_error) {
return [];
  }
}

/**
 * Get overdue deadlines for an organization
 *
 * Tenant-scoped through an inner join on grievances (see getUpcomingDeadlines).
 */
export async function getOverdueDeadlines(organizationId: string): Promise<DeadlineAlert[]> {
  try {
    const today = new Date();

    const rows = await db
      .select({ deadline: grievanceDeadlines })
      .from(grievanceDeadlines)
      .innerJoin(grievances, eq(grievanceDeadlines.grievanceId, grievances.id))
      .where(
        and(
          eq(grievances.organizationId, organizationId),
          eq(grievanceDeadlines.status, "pending"),
          lte(grievanceDeadlines.dueDate, today)
        )
      )
      .orderBy(asc(grievanceDeadlines.dueDate));

    return rows.map((r) => createDeadlineAlert(r.deadline));
  } catch (_error) {
return [];
  }
}

/**
 * Get all deadlines for a specific grievance
 */
export async function getGrievanceDeadlines(
  grievanceId: string
): Promise<GrievanceDeadline[]> {
  try {
    const deadlines = await db.query.grievanceDeadlines.findMany({
      where: eq(grievanceDeadlines.grievanceId, grievanceId),
      orderBy: [asc(grievanceDeadlines.dueDate)],
    });

    return deadlines;
  } catch (_error) {
return [];
  }
}

/**
 * Check and escalate missed deadlines
 */
export async function escalateMissedDeadlines(organizationId: string): Promise<number> {
  try {
    const overdueDeadlines = await getOverdueDeadlines(organizationId);
    let escalatedCount = 0;

    for (const alert of overdueDeadlines) {
      // Mark as overdue and add escalation note
      await db
        .update(grievanceDeadlines)
        .set({
          status: "overdue",
          notes: `Escalated on ${new Date().toISOString()} - ${Math.abs(alert.daysRemaining)} days overdue`,
        })
        .where(eq(grievanceDeadlines.id, alert.deadlineId));

      // Send escalation notification
      await sendEscalationNotification(alert);
      escalatedCount++;
    }

    return escalatedCount;
  } catch (_error) {
return 0;
  }
}

/**
 * Create deadline alert from deadline record
 */
function createDeadlineAlert(deadline: GrievanceDeadline): DeadlineAlert {
  const dueDate = deadline.dueDate ? new Date(deadline.dueDate) : new Date();
  const today = new Date();
  const daysRemaining = differenceInDays(dueDate, today);
  
  let status: DeadlineStatus;
  if (daysRemaining < 0) {
    status = "overdue";
  } else if (daysRemaining <= 3) {
    status = "warning";
  } else {
    status = "upcoming";
  }

  return {
    deadlineId: deadline.id,
    grievanceId: deadline.grievanceId,
    deadlineType: deadline.deadlineType as DeadlineType,
    dueDate,
    daysRemaining,
    status,
    priority: "medium",
    description: deadline.description || "",
  };
}

// ============================================================================
// REMINDER SYSTEM
// ============================================================================

/**
 * Schedule reminder notifications for deadline via the durable deadline
 * engine outbox (`deadline_reminders`). Wave 1 Phase A replaces the prior
 * no-op with a real at-least-once scheduler + worker pipeline.
 */
async function scheduleReminders(
  deadlineId: string,
  dueDate: Date,
  reminderSchedule: number[]
): Promise<void> {
  const deadline = await db.query.grievanceDeadlines.findFirst({
    where: eq(grievanceDeadlines.id, deadlineId),
  });

  if (!deadline) return;

  // Cancel legacy `notifications`-table reminders (belt-and-suspenders during
  // the transitional period). The new outbox owns its own cancel semantics
  // via scheduleGrievanceDeadlineReminders().
  await cancelDeadlineReminders(deadlineId);

  try {
    const result = await scheduleGrievanceDeadlineReminders({
      sourceDeadlineId: deadlineId,
      grievanceId: deadline.grievanceId,
      dueDate,
      reminderOffsetsInDays: reminderSchedule,
      actor: { type: 'system', id: 'deadline-tracking-system' },
    });

    logger.info('deadline-tracking: reminders scheduled via deadline engine', {
      deadlineId,
      correlationId: result.correlationId,
      scheduledCount: result.scheduled.length,
      cancelledForReschedule: result.cancelledForReschedule.length,
      skippedRecipients: result.skipped.length,
      skippedInPast: result.skippedInPast.length,
    });
  } catch (error) {
    logger.error('deadline-tracking: scheduleGrievanceDeadlineReminders failed', {
      deadlineId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Cancel all pending reminders for a deadline
 */
async function cancelDeadlineReminders(deadlineId: string): Promise<void> {
  try {
    await db
      .update(notifications)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(notifications.relatedEntityId, deadlineId),
          eq(notifications.type, "deadline_reminder"),
          eq(notifications.status, "scheduled")
        )
      );
  } catch (_error) {
}
}

/**
 * Send escalation notification for missed deadline
 */
async function sendEscalationNotification(alert: DeadlineAlert): Promise<void> {
  try {
    const deadline = await db.query.grievanceDeadlines.findFirst({
      where: eq(grievanceDeadlines.id, alert.deadlineId),
    });

    if (!deadline) return;

    // Note: Sending notifications would require looking up the related grievance
    // to get organizationId and assigned users. This is a simplified version.
    // In a complete implementation, you would:
    // 1. Query the grievance by deadline.grievanceId
    // 2. Get the organizationId and assignedTo from the grievance
    // 3. Create notifications for relevant users
  } catch (_error) {
}
}

