/**
 * Scheduled Reports Database Queries
 * 
 * Handles all database operations for automated report scheduling
 * Created: December 5, 2025
 * Part of: Phase 2.4 - Scheduled Reports System
 */

import { db } from '@/db';
import { sql } from 'drizzle-orm';

// ============================================================================
// Types
// ============================================================================

export interface ScheduledReport {
  id: string;
  reportId: string;
  organizationId: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  timeOfDay: string | null;
  timezone: string | null;
  format: 'pdf' | 'excel' | 'csv' | 'json';
  recipients: string[];
  parameters: Record<string, unknown> | null;
  isActive: boolean;
  lastExecutedAt: Date | null;
  nextExecutionAt: Date | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduledReportParams {
  reportId: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay?: string;
  timezone?: string;
  format: 'pdf' | 'excel' | 'csv' | 'json';
  recipients: string[];
  isActive?: boolean;
}

export interface UpdateScheduledReportParams {
  name?: string;
  frequency?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  dayOfWeek?: number;
  dayOfMonth?: number;
  timeOfDay?: string;
  timezone?: string;
  format?: 'pdf' | 'excel' | 'csv' | 'json';
  recipients?: string[];
  isActive?: boolean;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all scheduled reports for an org
 */
export async function getScheduledReports(
  organizationId: string,
  filters?: {
    reportId?: string;
    isActive?: boolean;
    frequency?: string;
  }
): Promise<ScheduledReport[]> {
  const conditions = [sql`rs.organization_id = ${organizationId}`];

  if (filters?.reportId) {
    conditions.push(sql`rs.report_id = ${filters.reportId}`);
  }

  if (filters?.isActive !== undefined) {
    conditions.push(sql`rs.is_active = ${filters.isActive}`);
  }

  if (filters?.frequency) {
    conditions.push(sql`rs.frequency = ${filters.frequency}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const result = await db.execute(sql`
    SELECT 
      rs.*,
      r.name as report_name,
      r.description as report_description,
      r.category as report_category
    FROM scheduled_reports rs
    JOIN reports r ON rs.report_id = r.id
    WHERE ${whereClause}
    ORDER BY rs.next_execution_at ASC NULLS LAST, rs.created_at DESC
  `);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Get a single scheduled report by ID
 */
export async function getScheduledReportById(
  id: string,
  organizationId: string
): Promise<ScheduledReport | null> {
  const result = await db.execute(sql`
    SELECT 
      rs.*,
      r.name as report_name,
      r.description as report_description,
      r.config as report_config
    FROM scheduled_reports rs
    JOIN reports r ON rs.report_id = r.id
    WHERE rs.id = ${id} AND rs.organization_id = ${organizationId}
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = result as any[];
  return rows[0] || null;
}

/**
 * Create a new scheduled report
 */
export async function createScheduledReport(
  organizationId: string,
  data: CreateScheduledReportParams
): Promise<ScheduledReport> {
  const nextExecutionAt = calculateNextRunAt(data.frequency, {
    time: data.timeOfDay,
    dayOfWeek: data.dayOfWeek,
    dayOfMonth: data.dayOfMonth,
  });
  const isActive = data.isActive ?? true;

  const result = await db.execute(sql`
    INSERT INTO scheduled_reports (
      report_id,
      organization_id,
      name,
      frequency,
      day_of_week,
      day_of_month,
      time_of_day,
      timezone,
      format,
      recipients,
      is_active,
      next_execution_at
    ) VALUES (
      ${data.reportId},
      ${organizationId},
      ${data.name},
      ${data.frequency},
      ${data.dayOfWeek ?? null},
      ${data.dayOfMonth ?? null},
      ${data.timeOfDay ?? '09:00'},
      ${data.timezone ?? 'UTC'},
      ${data.format},
      ${JSON.stringify(data.recipients)},
      ${isActive},
      ${nextExecutionAt}
    )
    RETURNING *
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = result as any[];
  return rows[0];
}

/**
 * Update a scheduled report
 */
export async function updateScheduledReport(
  id: string,
  organizationId: string,
  data: UpdateScheduledReportParams
): Promise<ScheduledReport> {
  // Get existing schedule first
  const existing = await getScheduledReportById(id, organizationId);
  if (!existing) {
    throw new Error('Scheduled report not found');
  }

  // Build update object with all fields (existing + updates)
  const frequency = data.frequency ?? existing.frequency;
  const dayOfWeek = data.dayOfWeek ?? existing.dayOfWeek;
  const dayOfMonth = data.dayOfMonth ?? existing.dayOfMonth;
  const timeOfDay = data.timeOfDay ?? existing.timeOfDay ?? '09:00';
  const timezone = data.timezone ?? existing.timezone ?? 'UTC';
  const format = data.format ?? existing.format;
  const recipients = data.recipients ?? existing.recipients;
  const isActive = data.isActive ?? existing.isActive;
  const name = data.name ?? existing.name;

  // Recalculate next execution time if schedule changed
  let nextExecutionAt = existing.nextExecutionAt;
  if (data.frequency || data.dayOfWeek !== undefined || data.dayOfMonth !== undefined || data.timeOfDay) {
    nextExecutionAt = calculateNextRunAt(frequency, {
      time: timeOfDay,
      dayOfWeek,
      dayOfMonth,
    });
  }

  const result = await db.execute(sql`
    UPDATE scheduled_reports
    SET 
      name = ${name},
      frequency = ${frequency},
      day_of_week = ${dayOfWeek},
      day_of_month = ${dayOfMonth},
      time_of_day = ${timeOfDay},
      timezone = ${timezone},
      format = ${format},
      recipients = ${JSON.stringify(recipients)},
      is_active = ${isActive},
      next_execution_at = ${nextExecutionAt},
      updated_at = NOW()
    WHERE id = ${id} AND organization_id = ${organizationId}
    RETURNING *
  `);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = result as any[];
  if (rows.length === 0) {
    throw new Error('Scheduled report not found');
  }

  return rows[0];
}

/**
 * Delete a scheduled report
 */
export async function deleteScheduledReport(
  id: string,
  organizationId: string
): Promise<void> {
  await db.execute(sql`
    DELETE FROM scheduled_reports
    WHERE id = ${id} AND organization_id = ${organizationId}
  `);
}

/**
 * Get schedules that are due to run
 */
export async function getDueSchedules(): Promise<ScheduledReport[]> {
  const result = await db.execute(sql`
    SELECT 
      rs.*,
      r.name as report_name,
      r.config as report_config
    FROM scheduled_reports rs
    JOIN reports r ON rs.report_id = r.id
    WHERE rs.is_active = true
      AND rs.next_execution_at IS NOT NULL
      AND rs.next_execution_at <= NOW()
    ORDER BY rs.next_execution_at ASC
    LIMIT 100
  `);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

/**
 * Update schedule after execution
 */
export async function updateScheduleAfterRun(
  id: string,
  success: boolean,
  _errorMessage?: string
): Promise<void> {
  // Get the schedule to calculate next run
  const scheduleResult = await db.execute(sql`
    SELECT * FROM scheduled_reports WHERE id = ${id}
  `);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scheduleRows = scheduleResult as any[];
  if (scheduleRows.length === 0) return;

  const scheduleData = scheduleRows[0];
  const nextExecutionAt = calculateNextRunAt(
    scheduleData.frequency,
    {
      time: scheduleData.time_of_day,
      dayOfWeek: scheduleData.day_of_week,
      dayOfMonth: scheduleData.day_of_month,
    }
  );

  // Deactivate schedule on failure to prevent repeated failures
  const isActive = success ? scheduleData.is_active : false;

  await db.execute(sql`
    UPDATE scheduled_reports
    SET 
      last_executed_at = NOW(),
      next_execution_at = ${nextExecutionAt},
      is_active = ${isActive},
      updated_at = NOW()
    WHERE id = ${id}
  `);
}

/**
 * Get execution history for a scheduled report
 */
export async function getScheduleExecutionHistory(
  scheduleId: string,
  organizationId: string,
  limit = 50
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const result = await db.execute(sql`
    SELECT *
    FROM export_jobs
    WHERE schedule_id = ${scheduleId}
      AND organization_id = ${organizationId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return result as any[];
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate the next run time for a schedule
 */
function calculateNextRunAt(
  scheduleType: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: Record<string, any>
): Date {
  const now = new Date();
  const next = new Date(now);
  
  // Default time if not specified (9 AM)
  const [hour, minute] = (config.time || '09:00').split(':').map(Number);

  switch (scheduleType) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(hour, minute, 0, 0);
      break;

    case 'weekly':
      const targetDay = config.dayOfWeek || 1; // Default to Monday
      const currentDay = next.getDay();
      const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
      next.setDate(next.getDate() + daysUntilTarget);
      next.setHours(hour, minute, 0, 0);
      break;

    case 'monthly':
      const targetDate = config.dayOfMonth || 1; // Default to 1st
      next.setMonth(next.getMonth() + 1);
      next.setDate(Math.min(targetDate, new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()));
      next.setHours(hour, minute, 0, 0);
      break;

    case 'quarterly':
      next.setMonth(next.getMonth() + 3);
      next.setDate(1);
      next.setHours(hour, minute, 0, 0);
      break;

    case 'custom':
      // For custom, use cron expression parser (simplified)
      // In production, use a proper cron parser library
      next.setDate(next.getDate() + 1);
      next.setHours(hour, minute, 0, 0);
      break;

    default:
      next.setDate(next.getDate() + 1);
      next.setHours(hour, minute, 0, 0);
  }

  // If calculated time is in the past, move to next occurrence
  if (next <= now) {
    return calculateNextRunAt(scheduleType, config);
  }

  return next;
}

/**
 * Pause a scheduled report
 */
export async function pauseSchedule(
  id: string,
  organizationId: string
): Promise<void> {
  await updateScheduledReport(id, organizationId, { isActive: false });
}

/**
 * Resume a scheduled report
 */
export async function resumeSchedule(
  id: string,
  organizationId: string
): Promise<void> {
  await updateScheduledReport(id, organizationId, { isActive: true });
}

