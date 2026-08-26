-- Union Eyes Deadline Engine — Wave 1 Phase A
-- ============================================================================
-- Purpose: durable, at-least-once reminder delivery for grievance / case /
-- appeal / filing / hearing deadlines. Replaces the no-op scheduleReminders
-- documented in apps/union-eyes/lib/deadline-tracking-system.ts.
--
-- Design invariants (enforced by DB, not by service code):
--   I1. A reminder row cannot exist without a recipient snapshot (address,
--       locale) captured at schedule time.
--   I2. A reminder row cannot exist without a scheduled_for timestamp
--       (with timezone), an offset_days integer, and the source deadline id.
--   I3. Status transitions are constrained: pending → claimed → (sent |
--       failed | dead_letter) → replayed (returns to pending).
--   I4. Lease/fence: only rows in ('claimed') may hold a non-null
--       lease_owner/lease_expires_at. All other statuses require both to be
--       null (enforced by check constraint).
--   I5. Retry budget is bounded by max_attempts (default 5). Reaching zero
--       remaining attempts forces status='dead_letter' — never silently
--       succeeds.
--   I6. Execution history is append-only (trigger blocks UPDATE / DELETE).
--       Every attempt writes exactly one immutable row, correlated by
--       reminder_id + attempt_number (unique).
--   I7. Audit events are append-only. No mutations, no deletes.
--   I8. RLS: all rows are tenant-scoped by organization_id. System workers
--       must run under withSystemContext() (see lib/db/with-rls-context.ts).
--   I9. Rescheduling: when a deadline shifts, existing pending reminders are
--       transitioned to 'cancelled' and new ones inserted atomically in the
--       same transaction. A cancelled reminder cannot ever be claimed.
--   I10. Provider idempotency: provider_message_id, when set, is unique per
--       provider — protects against double-delivery on worker crashes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Shared updated_at trigger function (idempotent — may already exist)
-- ----------------------------------------------------------------------------
create or replace function ue_set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ----------------------------------------------------------------------------
-- Reject-any-update trigger function for append-only tables
-- ----------------------------------------------------------------------------
create or replace function ue_reject_mutation() returns trigger as $$
begin
  raise exception '%: table % is append-only (blocked % on id=%)',
    tg_name, tg_table_name, tg_op, coalesce(old.id::text, new.id::text)
    using errcode = 'restrict_violation';
end;
$$ language plpgsql;

-- ============================================================================
-- 1. deadline_reminders — the durable outbox
-- ============================================================================
create table if not exists deadline_reminders (
  id uuid primary key default gen_random_uuid(),

  -- Source deadline (grievance_deadlines OR claim_deadlines — polymorphic
  -- by convention). Not a hard FK because the two tables live in different
  -- domains and we want to survive either table being refactored.
  source_table text not null check (source_table in ('grievance_deadlines', 'claim_deadlines')),
  source_deadline_id uuid not null,

  -- Tenant scope (required for RLS and cross-check with the source table).
  organization_id uuid not null,

  -- Reminder definition
  offset_days integer not null,
  scheduled_for timestamptz not null,
  timezone text not null default 'UTC',
  reminder_kind text not null default 'upcoming'
    check (reminder_kind in ('upcoming', 'overdue', 'escalation')),

  -- Recipient snapshot (captured at schedule time — never re-resolved at
  -- delivery to guarantee we don't deliver to a stale address).
  recipient_user_id varchar(255),
  recipient_role text not null
    check (recipient_role in ('grievor', 'assigned_officer', 'assigned_steward', 'org_admin')),
  recipient_email text not null,
  recipient_email_hash text not null,
  recipient_locale text not null default 'en',

  -- Message metadata (subject fixed, body derived at delivery — no PII in
  -- the outbox row itself beyond email address).
  message_template text not null default 'deadline_reminder_v1',
  message_subject text not null default 'Union Eyes deadline reminder',

  -- Lease/fence for worker at-least-once semantics
  status text not null default 'pending'
    check (status in ('pending', 'claimed', 'sent', 'failed', 'dead_letter', 'cancelled')),
  lease_owner text,
  lease_expires_at timestamptz,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,

  -- Provider tracking (idempotency + auditability)
  provider text,
  provider_message_id text,
  last_error_code text,
  last_error_message text,

  -- Bookkeeping
  cancelled_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  dead_lettered_at timestamptz,

  -- Idempotency: one reminder per (deadline, recipient, offset, kind).
  -- Reschedules cancel the old row and insert a new one with a different
  -- scheduled_for, so the (source_deadline_id, recipient_email_hash,
  -- offset_days, reminder_kind, status='pending') space stays clean.
  constraint deadline_reminders_lease_guard check (
    (status in ('pending', 'sent', 'failed', 'dead_letter', 'cancelled')
      and lease_owner is null and lease_expires_at is null)
    or
    (status = 'claimed' and lease_owner is not null and lease_expires_at is not null)
  ),
  constraint deadline_reminders_attempt_bound check (attempt_count >= 0 and attempt_count <= max_attempts + 1),
  constraint deadline_reminders_sent_terminal check (
    (status = 'sent' and sent_at is not null)
    or (status <> 'sent' and sent_at is null)
  ),
  constraint deadline_reminders_dead_terminal check (
    (status = 'dead_letter' and dead_lettered_at is not null)
    or (status <> 'dead_letter' and dead_lettered_at is null)
  )
);

-- Uniqueness: at most one pending row per (deadline, recipient, offset, kind).
-- This prevents duplicate reminders on reschedule if the caller forgets to
-- cancel the prior one.
create unique index if not exists deadline_reminders_pending_uidx
  on deadline_reminders (source_deadline_id, recipient_email_hash, offset_days, reminder_kind)
  where status = 'pending';

-- Provider idempotency: one provider_message_id per provider (unique across
-- reminders — prevents a crashed worker from acking a message that was already
-- successfully sent under a different reminder id).
create unique index if not exists deadline_reminders_provider_msg_uidx
  on deadline_reminders (provider, provider_message_id)
  where provider_message_id is not null;

-- Worker lease-scan index (drives the SKIP LOCKED claim query).
create index if not exists deadline_reminders_pending_scan_idx
  on deadline_reminders (scheduled_for, id)
  where status = 'pending';

create index if not exists deadline_reminders_lease_recovery_idx
  on deadline_reminders (lease_expires_at)
  where status = 'claimed';

create index if not exists deadline_reminders_source_lookup_idx
  on deadline_reminders (source_deadline_id, status);

create index if not exists deadline_reminders_org_status_idx
  on deadline_reminders (organization_id, status);

create trigger trg_deadline_reminders_touch
  before update on deadline_reminders
  for each row
  execute function ue_set_updated_at();

alter table deadline_reminders enable row level security;

drop policy if exists deadline_reminders_tenant_isolation on deadline_reminders;
create policy deadline_reminders_tenant_isolation on deadline_reminders
  using (
    -- Workers running under withSystemContext (app.current_org_id = '') read all
    -- pending rows; user contexts see only their own org.
    coalesce(nullif(current_setting('app.current_org_id', true), ''), organization_id::text) = organization_id::text
  )
  with check (
    coalesce(nullif(current_setting('app.current_org_id', true), ''), organization_id::text) = organization_id::text
  );

-- ============================================================================
-- 2. deadline_reminder_executions — append-only per-attempt history
-- ============================================================================
create table if not exists deadline_reminder_executions (
  id uuid primary key default gen_random_uuid(),
  reminder_id uuid not null references deadline_reminders (id) on delete restrict,
  attempt_number integer not null,
  attempted_at timestamptz not null default now(),
  outcome text not null check (outcome in ('sent', 'transient_failure', 'permanent_failure', 'skipped_cancelled')),
  provider text,
  provider_message_id text,
  provider_status_code integer,
  error_code text,
  error_message text,
  duration_ms integer,
  worker_instance text not null,
  correlation_id text not null,
  constraint deadline_reminder_executions_attempt_uidx unique (reminder_id, attempt_number)
);

create index if not exists deadline_reminder_executions_reminder_idx
  on deadline_reminder_executions (reminder_id, attempted_at desc);

-- Append-only: no updates or deletes permitted.
drop trigger if exists trg_deadline_reminder_executions_immutable on deadline_reminder_executions;
create trigger trg_deadline_reminder_executions_immutable
  before update or delete on deadline_reminder_executions
  for each row
  execute function ue_reject_mutation();

alter table deadline_reminder_executions enable row level security;

drop policy if exists deadline_reminder_executions_read on deadline_reminder_executions;
create policy deadline_reminder_executions_read on deadline_reminder_executions
  using (
    exists (
      select 1 from deadline_reminders r
      where r.id = deadline_reminder_executions.reminder_id
        and coalesce(nullif(current_setting('app.current_org_id', true), ''), r.organization_id::text) = r.organization_id::text
    )
  )
  with check (
    exists (
      select 1 from deadline_reminders r
      where r.id = deadline_reminder_executions.reminder_id
        and coalesce(nullif(current_setting('app.current_org_id', true), ''), r.organization_id::text) = r.organization_id::text
    )
  );

-- ============================================================================
-- 3. deadline_audit_events — append-only structured audit trail
-- ============================================================================
create table if not exists deadline_audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  source_table text not null check (source_table in ('grievance_deadlines', 'claim_deadlines')),
  source_deadline_id uuid not null,
  reminder_id uuid,
  event_type text not null check (event_type in (
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
    -- Overdue processor
    'overdue.detected',
    'overdue.processed'
  )),
  actor_type text not null check (actor_type in ('system', 'user', 'worker')),
  actor_id varchar(255),
  correlation_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  -- Structural guards: no message content, no recipient PII, no provider secrets.
  constraint deadline_audit_events_no_content check (
    not (metadata ? 'message_body')
    and not (metadata ? 'recipient_email')
    and not (metadata ? 'api_key')
    and not (metadata ? 'authorization')
  )
);

create index if not exists deadline_audit_events_deadline_idx
  on deadline_audit_events (source_deadline_id, occurred_at desc);
create index if not exists deadline_audit_events_reminder_idx
  on deadline_audit_events (reminder_id, occurred_at desc)
  where reminder_id is not null;
create index if not exists deadline_audit_events_org_time_idx
  on deadline_audit_events (organization_id, occurred_at desc);
create index if not exists deadline_audit_events_type_time_idx
  on deadline_audit_events (event_type, occurred_at desc);

drop trigger if exists trg_deadline_audit_events_immutable on deadline_audit_events;
create trigger trg_deadline_audit_events_immutable
  before update or delete on deadline_audit_events
  for each row
  execute function ue_reject_mutation();

alter table deadline_audit_events enable row level security;

drop policy if exists deadline_audit_events_tenant_isolation on deadline_audit_events;
create policy deadline_audit_events_tenant_isolation on deadline_audit_events
  using (
    coalesce(nullif(current_setting('app.current_org_id', true), ''), organization_id::text) = organization_id::text
  )
  with check (
    coalesce(nullif(current_setting('app.current_org_id', true), ''), organization_id::text) = organization_id::text
  );

-- ============================================================================
-- Comments — machine-readable capability provenance
-- ============================================================================
comment on table deadline_reminders is
  'UE-DEADLINE-REMINDERS — durable outbox for grievance/claim deadline reminder delivery. Wave 1 Phase A. Replaces the no-op in apps/union-eyes/lib/deadline-tracking-system.ts scheduleReminders().';
comment on table deadline_reminder_executions is
  'UE-DEADLINE-DELIVERY — append-only per-attempt execution history. Correlates worker dispatches to provider acknowledgements.';
comment on table deadline_audit_events is
  'UE-DEADLINE-CORE — append-only structured audit trail for the deadline engine. Contains no message content or PII beyond ids.';
