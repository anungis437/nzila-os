/**
 * Deadline dashboard query.
 *
 * The one query of the deadline stack that anything runs (GET /api/deadlines/dashboard). The rule, extension, alert and compliance queries that stood beside it,
 * and the service that wrapped them, read and wrote deadline extension and alert tables, views and SQL functions in a shape the database never received, and
 * nothing called them: they were removed in the mismatch census (UE-CONV-H-017). Deadline reminders are scheduled by lib/deadline-engine.
 */

import { withRLSContext } from '@/lib/db/with-rls-context';
import { sql } from 'drizzle-orm';

/**
 * Get deadline summary for all claims (dashboard widget).
 *
 * Overdue and due-soon are read from due_date and the clock: claim_deadlines.is_overdue, days_until_due and days_overdue are stored columns that no writer
 * maintains (Django and the application both leave them at their defaults), so a count over them is always zero.
 */
export async function getDeadlineDashboardSummary(organizationId: string): Promise<{
  activeDeadlines: number;
  overdueCount: number;
  dueSoonCount: number;
  criticalCount: number;
  avgDaysOverdue: number;
  onTimePercentage: number;
}> {
  const result = await withRLSContext(async (tx) => tx.execute(sql`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'pending') as active_deadlines,
      COUNT(*) FILTER (WHERE status = 'pending' AND due_date < now()) as overdue_count,
      COUNT(*) FILTER (WHERE status = 'pending' AND due_date >= now() AND due_date < now() + interval '3 days') as due_soon_count,
      COUNT(*) FILTER (WHERE priority = 'critical' AND status = 'pending') as critical_count,
      ROUND((AVG(EXTRACT(EPOCH FROM (now() - due_date)) / 86400.0) FILTER (WHERE status = 'pending' AND due_date < now()))::numeric, 1) as avg_days_overdue,
      COUNT(*) FILTER (WHERE status = 'completed' AND completed_at <= due_date) as on_time_completed,
      COUNT(*) FILTER (WHERE status IN ('completed', 'missed')) as total_completed
    FROM claim_deadlines
    WHERE organization_id = ${organizationId}
  `));
  
  const row = result[0] as Record<string, string>;
  const totalCompleted = Number(row.total_completed) || 0;
  return {
    activeDeadlines: parseInt(row.active_deadlines) || 0,
    overdueCount: parseInt(row.overdue_count) || 0,
    dueSoonCount: parseInt(row.due_soon_count) || 0,
    criticalCount: parseInt(row.critical_count) || 0,
    avgDaysOverdue: parseFloat(row.avg_days_overdue) || 0,
    onTimePercentage: totalCompleted > 0 
      ? Math.round((Number(row.on_time_completed) / totalCompleted) * 100)
      : 100,
  };
}
