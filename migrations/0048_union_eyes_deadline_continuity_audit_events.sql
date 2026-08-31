-- ============================================================================
-- Migration 0048: Deadline engine — continuity audit event types
--
-- Adds two new deadline_audit_events.event_type values needed by the
-- deadline-continuity remediation (fix/deadline-continuity):
--   - reminder.recipients_refreshed  — a grievance reassignment refreshed
--     the recipient set for an active deadline's reminders (cancel old
--     recipient's pending rows, schedule the successor's).
--   - reminder.superseded_at_dispatch — the worker revalidated a claimed
--     reminder immediately before dispatch and found it no longer
--     eligible (deadline completed/cancelled, or the recipient no longer
--     matches the current grievance assignment) and suppressed delivery.
--
-- Postgres CHECK constraints cannot be altered in place; drop and recreate
-- with the extended value list. No data migration needed — existing rows
-- keep their original event_type values, which remain valid.
-- ============================================================================

alter table deadline_audit_events
  drop constraint if exists deadline_audit_events_event_type_check;

alter table deadline_audit_events
  add constraint deadline_audit_events_event_type_check check (event_type in (
    -- Deadline lifecycle
    'deadline.created',
    'deadline.rescheduled',
    'deadline.completed',
    'deadline.cancelled',
    'deadline.extension_requested',
    'deadline.extension_approved',
    'deadline.escalation_triggered',
    -- Reminder lifecycle
    'reminder.scheduled',
    'reminder.cancelled_reschedule',
    'reminder.claimed',
    'reminder.sent',
    'reminder.failed_transient',
    'reminder.failed_permanent',
    'reminder.dead_lettered',
    'reminder.replayed',
    'reminder.lease_recovered',
    'reminder.recipients_refreshed',
    'reminder.superseded_at_dispatch',
    -- Overdue processor
    'overdue.detected',
    'overdue.processed'
  ));
