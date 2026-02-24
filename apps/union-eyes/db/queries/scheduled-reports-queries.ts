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
  scheduleType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  scheduleConfig: {
    time?: string; // HH:MM format
    dayOfWeek?: number; // 0-6 for weekly
    dayOfMonth?: number; // 1-31 for monthly
    cronExpression?: string; // For custom schedules
    timezone?: string;
  };
  deliveryMethod: 'email' | 'dashboard' | 'storage' | 'webhook';
  recipients: string[]; // Email addresses or user IDs
  exportFormat: 'pdf' | 'excel' | 'csv' | 'json';
  isActive: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  lastRunStatus: 'success' | 'failed' | 'pending' | null;
  runCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduledReportParams {
  reportId: string;
  scheduleType: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scheduleConfig: Record<string, any>;
  deliveryMethod: 'email' | 'dashboard' | 'storage' | 'webhook';
  recipients: string[];
  exportFormat: 'pdf' | 'excel' | 'csv' | 'json';
  isActive?: boolean;
}

export interface UpdateScheduledReportParams {
  scheduleType?: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scheduleConfig?: Record<string, any>;
  deliveryMethod?: 'email' | 'dashboard' | 'storage' | 'webhook';
  recipients?: string[];
  exportFormat?: 'pdf' | 'excel' | 'csv' | 'json';
  isActive?: boolean;
}

// ============================================================================
// Query Functions
// ============================================================================

/**
 * Get all scheduled reports for a tenant
 */
export async function getScheduledReports(
  organizationId: string,
  filters?: {
    reportId?: string;
    isActive?: boolean;
    scheduleType?: string;
  }
): Promise<ScheduledReport[]> {
  const tenantId = organizationId;
  const conditions = [sql`rs.tenant_id = ${tenantId}`];

  if (filters?.reportId) {
    conditions.push(sql`rs.report_id = ${filters.reportId}`);
  }

  if (filters?.isActive !== undefined) {
    conditions.push(sql`rs.is_active = ${filters.isActive}`);
  }

  if (filters?.scheduleType) {
    conditions.push(sql`rs.schedule_type = ${filters.scheduleType}`);
  }

  const whereClause = sql.join(conditions, sql` AND `);

  const result = await db.execute(sql`
    SELECT 
      rs.*,
      r.name as report_name,
      r.description as report_description,
      r.category as report_category
    FROM report_schedules rs
    JOIN reports r ON rs.report_id = r.id
    WHERE ${whereClause}
    ORDER BY rs.next_run_at ASC NULLS LAST, rs.created_at DESC
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
  const tenantId = organizationId;
  const result = await db.execute(sql`
    SELECT 
      rs.*,
      r.name as report_name,
      r.description as report_description,
      r.config as report_config
    FROM report_schedules rs
    JOIN reports r ON rs.report_id = r.id
    WHERE rs.id = ${id} AND rs.tenant_id = ${tenantId}
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
  const tenantId = organizationId;
  const nextRunAt = calculateNextRunAt(data.scheduleType, data.scheduleConfig);
  const isActive = data.isActive ?? true;

  const result = await db.execute(sql`
    INSERT INTO report_schedules (
      report_id,
      tenant_id,
      schedule_type,
      schedule_config,
      delivery_method,
      recipients,
      export_format,
      is_active,
      next_run_at
    ) VALUES (
      ${data.reportId},
      ${tenantId},
      ${data.scheduleType},
      ${JSON.stringify(data.scheduleConfig)},
      ${data.deliveryMethod},
      ${JSON.stringify(data.recipients)},
      ${data.exportFormat},
      ${isActive},
      ${nextRunAt}
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
  const tenantId = organizationId;
  // Get existing schedule first
  const existing = await getScheduledReportById(id, tenantId);
  if (!existing) {
    throw new Error('Scheduled report not found');
  }

  // Build update object with all fields (existing + updates)
  const scheduleType = data.scheduleType ?? existing.scheduleType;
  const scheduleConfig = data.scheduleConfig ?? existing.scheduleConfig;
  const deliveryMethod = data.deliveryMethod ?? existing.deliveryMethod;
  const recipients = data.recipients ?? existing.recipients;
  const exportFormat = data.exportFormat ?? existing.exportFormat;
  const isActive = data.isActive ?? existing.isActive;

  // Recalculate next run time if schedule changed
  let nextRunAt = existing.nextRunAt;
  if (data.scheduleType || data.scheduleConfig) {
    nextRunAt = calculateNextRunAt(scheduleType, scheduleConfig);
  }

  const result = await db.execute(sql`
    UPDATE report_schedules
    SET 
      schedule_type = ${scheduleType},
      schedule_config = ${JSON.stringify(scheduleConfig)},
      delivery_method = ${deliveryMethod},
      recipients = ${JSON.stringify(recipients)},
      export_format = ${exportFormat},
      is_active = ${isActive},
      next_run_at = ${nextRunAt},
      updated_at = NOW()
    WHERE id = ${id} AND tenant_id = ${tenantId}
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
  const tenantId = organizationId;
  await db.execute(sql`
    DELETE FROM report_schedules
    WHERE id = ${id} AND tenant_id = ${tenantId}
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
    FROM report_schedules rs
    JOIN reports r ON rs.report_id = r.id
    WHERE rs.is_active = true
      AND rs.next_run_at IS NOT NULL
      AND rs.next_run_at <= NOW()
    ORDER BY rs.next_run_at ASC
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
    SELECT * FROM report_schedules WHERE id = ${id}
  `);
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scheduleRows = scheduleResult as any[];
  if (scheduleRows.length === 0) return;

  const scheduleData = scheduleRows[0];
  const nextRunAt = calculateNextRunAt(
    scheduleData.schedule_type,
    scheduleData.schedule_config
  );

  const status = success ? 'success' : 'failed';

  await db.execute(sql`
    UPDATE report_schedules
    SET 
      last_run_at = NOW(),
      last_run_status = ${status},
      next_run_at = ${nextRunAt},
      run_count = run_count + 1,
      failure_count = CASE WHEN ${status} = 'failed' THEN failure_count + 1 ELSE failure_count END,
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
  const tenantId = organizationId;
  const result = await db.execute(sql`
    SELECT *
    FROM export_jobs
    WHERE schedule_id = ${scheduleId}
      AND tenant_id = ${tenantId}
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
  const tenantId = organizationId;
  await updateScheduledReport(id, tenantId, { isActive: false });
}

/**
 * Resume a scheduled report
 */
export async function resumeSchedule(
  id: string,
  organizationId: string
): Promise<void> {
  const tenantId = organizationId;
  await updateScheduledReport(id, tenantId, { isActive: true });
}

