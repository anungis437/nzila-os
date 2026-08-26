-- Union Eyes staging proof controls
-- Durable replay protection and append-only evidence for the temporary,
-- staging-only deadline lifecycle proof harness.

create table if not exists staging_proof_nonce_uses (
  nonce text primary key,
  proof_run_id uuid not null,
  expires_at timestamptz not null,
  used_at timestamptz not null default now(),
  constraint staging_proof_nonce_format check (nonce ~ '^[A-Za-z0-9_-]{24,128}$')
);

create index if not exists staging_proof_nonce_expiry_idx
  on staging_proof_nonce_uses (expires_at);

create table if not exists staging_proof_run_events (
  id uuid primary key default gen_random_uuid(),
  proof_run_id uuid not null,
  scenario text not null check (scenario in ('schedule-basic', 'reschedule', 'cancel')),
  event_type text not null check (event_type in ('started', 'completed', 'failed', 'cleanup_failed')),
  correlation_id text not null,
  staging_revision text,
  build_commit text,
  created_identifiers jsonb not null default '{}'::jsonb,
  expected_outcome jsonb not null default '{}'::jsonb,
  actual_outcome jsonb not null default '{}'::jsonb,
  cleanup_passed boolean,
  occurred_at timestamptz not null default now(),
  constraint staging_proof_run_events_no_secrets check (
    not (created_identifiers ? 'email')
    and not (actual_outcome ? 'credential')
    and not (actual_outcome ? 'database_url')
  )
);

create index if not exists staging_proof_run_events_run_idx
  on staging_proof_run_events (proof_run_id, occurred_at);

drop trigger if exists trg_staging_proof_run_events_immutable on staging_proof_run_events;
create trigger trg_staging_proof_run_events_immutable
  before update or delete on staging_proof_run_events
  for each row
  execute function ue_reject_mutation();

alter table staging_proof_run_events enable row level security;

drop policy if exists staging_proof_run_events_system_only on staging_proof_run_events;
create policy staging_proof_run_events_system_only on staging_proof_run_events
  using (current_setting('app.current_org_id', true) = '')
  with check (current_setting('app.current_org_id', true) = '');