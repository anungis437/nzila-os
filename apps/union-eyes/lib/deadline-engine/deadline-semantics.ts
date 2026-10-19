/**
 * Canonical grievance-deadline semantics (Phase 3A).
 *
 * `grievance_deadlines` carries the effective due date in `due_date`; `override_due_date` is the confirmed date when a
 * human overrode the calculation and `calculated_due_date` is the original system calculation. Status is `pending`,
 * `extended`, `completed`, `cancelled`, ... and every reader (reminder worker dispatch revalidation, overdue cron,
 * assignment convergence, overdue sweep) must agree on which statuses are terminal.
 *
 * Invariants (also enforced in the database by grievances.0007 as CHECK constraints, so a writer that forgets one
 * fails closed instead of leaving a stale duplicate):
 *   I1  override_due_date IS NOT NULL  =>  due_date = override_due_date
 *   I2  superseded_at IS NOT NULL      =>  status IN ('completed', 'cancelled')
 */
export const TERMINAL_DEADLINE_STATUSES = ['completed', 'cancelled'] as const;

export function isTerminalDeadlineStatus(status: string | null | undefined): boolean {
  return status === 'completed' || status === 'cancelled';
}

/**
 * Columns to write when the effective due date moves (extension granted or approved). Keeps I1: an override in force
 * moves with the due date instead of going stale.
 */
export function effectiveDueDateUpdate(
  current: { overrideDueDate?: Date | null },
  newDueDate: Date,
): { dueDate: Date; overrideDueDate?: Date } {
  return current.overrideDueDate ? { dueDate: newDueDate, overrideDueDate: newDueDate } : { dueDate: newDueDate };
}