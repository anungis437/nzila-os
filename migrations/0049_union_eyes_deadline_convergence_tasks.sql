-- ============================================================================
-- Migration 0049: Deadline engine — durable assignment convergence tasks
--
-- Closes the partial-handoff risk in the deadline-continuity remediation
-- (fix/deadline-continuity): a grievance reassignment used to trigger an
-- in-request loop that rescheduled reminders for every active deadline with
-- no durable record of the attempt. If deadline N of M failed to reschedule,
-- the route returned 500 with no way to know which grievances still needed
-- convergence, and no automatic retry — a plain in-memory failure, not a
-- convergence mechanism.
--
-- deadline_reassignment_convergence is the durable work item: the row is
-- inserted in the SAME transaction as the grievances.union_rep_id update
-- (see assignment-sync.ts / app/api/grievances/[id]/assign/route.ts), so an
-- assignment change can never commit without a corresponding convergence
-- task existing. The task is then processed (immediately, and on retry by
-- the reminder worker's convergence sweep) until every active deadline's
-- reminders have been rescheduled against the new assignment — status
-- stays 'pending' (never a terminal 'failed') across attempts so retries
-- keep converging it, and re-running is idempotent (scheduleGrievance-
-- DeadlineReminders' cancel-then-insert is safe to repeat).
-- ============================================================================

create table if not exists deadline_reassignment_convergence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  grievance_id uuid not null,
  previous_assignee_id varchar(255),
  new_assignee_id varchar(255) not null,
  status text not null default 'pending'
    check (status in ('pending', 'converged')),
  attempt_count integer not null default 0,
  last_error text,
  correlation_id text not null,
  requested_at timestamptz not null default now(),
  last_attempted_at timestamptz,
  converged_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint deadline_reassignment_convergence_terminal check (
    (status = 'converged' and converged_at is not null)
    or (status = 'pending' and converged_at is null)
  )
);

create index if not exists deadline_reassignment_convergence_pending_idx
  on deadline_reassignment_convergence (grievance_id)
  where status = 'pending';
create index if not exists deadline_reassignment_convergence_org_idx
  on deadline_reassignment_convergence (organization_id, status);

drop trigger if exists trg_deadline_reassignment_convergence_touch on deadline_reassignment_convergence;
create trigger trg_deadline_reassignment_convergence_touch
  before update on deadline_reassignment_convergence
  for each row
  execute function ue_set_updated_at();

alter table deadline_reassignment_convergence enable row level security;

drop policy if exists deadline_reassignment_convergence_tenant_isolation on deadline_reassignment_convergence;
create policy deadline_reassignment_convergence_tenant_isolation on deadline_reassignment_convergence
  using (
    coalesce(nullif(current_setting('app.current_org_id', true), ''), organization_id::text) = organization_id::text
  )
  with check (
    coalesce(nullif(current_setting('app.current_org_id', true), ''), organization_id::text) = organization_id::text
  );
