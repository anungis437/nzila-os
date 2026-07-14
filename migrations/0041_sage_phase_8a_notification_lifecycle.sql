-- SAGE Phase 8A.1 – executable notification lifecycle
-- Add retry scheduling and an explicit terminal dead-letter state without
-- mutating encrypted invitation material.

alter table sage_notification_outbox
  add column if not exists next_attempt_at timestamp with time zone,
  add column if not exists dead_lettered_at timestamp with time zone;

-- The initial checkpoint used `failed`; normalize it before restricting the
-- lifecycle. `dead_letter` is terminal and represents a safely recorded
-- operational failure, not an invitation that can be silently retried.
update sage_notification_outbox
  set status = 'dead_letter',
      dead_lettered_at = coalesce(dead_lettered_at, now())
  where status = 'failed';

alter table sage_notification_outbox
  drop constraint if exists valid_status;
alter table sage_notification_outbox
  add constraint valid_status check (status in ('pending', 'dispatching', 'dispatched', 'dead_letter'));

alter table sage_notification_outbox
  drop constraint if exists lease_guard;
alter table sage_notification_outbox
  add constraint lease_guard check (
    (status = 'pending' and dispatch_owner is null and lease_expires_at is null)
    or (status = 'dispatching' and dispatch_owner is not null and lease_expires_at is not null)
    or (status in ('dispatched', 'dead_letter') and dispatch_owner is not null and lease_expires_at is not null)
  );

create index if not exists idx_sage_notification_outbox_ready
  on sage_notification_outbox (next_attempt_at, created_at, id)
  where status = 'pending';

-- Allow only operational lifecycle fields to change after the immutable insert.
-- The trigger function itself is shared and accepts the permitted column list.
drop trigger if exists trg_sage_notification_outbox_immutable on sage_notification_outbox;
create trigger trg_sage_notification_outbox_immutable
  before update on sage_notification_outbox
  for each row
  execute function assert_immutable_except(
    'status', 'dispatch_owner', 'lease_expires_at', 'attempt_count',
    'provider_message_id', 'provider_request_id', 'last_error_code',
    'last_error_message', 'next_attempt_at', 'dead_lettered_at',
    'dispatched_at', 'payload_destroyed_at'
  );
