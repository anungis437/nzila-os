-- Union Eyes staging proof-run ledger
-- Extends 0046 with an immutable run record so nonce claim, run creation,
-- and start evidence can be committed atomically by the proof harness.

create table if not exists staging_proof_runs (
  id uuid primary key,
  nonce text not null unique references staging_proof_nonce_uses (nonce) on delete restrict,
  scenario text not null check (scenario in ('schedule-basic', 'reschedule', 'cancel')),
  correlation_id text not null,
  status text not null check (status in ('started', 'completed', 'failed', 'cleanup_failed')),
  cleanup_passed boolean,
  created_at timestamptz not null default now(),
  finalized_at timestamptz,
  constraint staging_proof_runs_finalization check (
    (status = 'started' and finalized_at is null and cleanup_passed is null)
    or (status <> 'started' and finalized_at is not null and cleanup_passed is not null)
  )
);

create index if not exists staging_proof_runs_created_idx
  on staging_proof_runs (created_at desc);

alter table staging_proof_run_events
  add constraint staging_proof_run_events_run_fk
  foreign key (proof_run_id) references staging_proof_runs (id) on delete restrict;

alter table staging_proof_runs enable row level security;

drop policy if exists staging_proof_runs_system_only on staging_proof_runs;
create policy staging_proof_runs_system_only on staging_proof_runs
  using (current_setting('app.current_org_id', true) = '')
  with check (current_setting('app.current_org_id', true) = '');

drop trigger if exists trg_staging_proof_runs_immutable on staging_proof_runs;
create trigger trg_staging_proof_runs_immutable
  before delete on staging_proof_runs
  for each row
  execute function ue_reject_mutation();

create or replace function ue_staging_proof_run_finalize_guard() returns trigger as $$
begin
  if old.status <> 'started' then
    raise exception 'staging proof run % is finalized and immutable', old.id
      using errcode = 'restrict_violation';
  end if;
  if new.status = 'started' or new.finalized_at is null or new.cleanup_passed is null then
    raise exception 'staging proof run % must finalize atomically', old.id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_staging_proof_runs_finalize_guard on staging_proof_runs;
create trigger trg_staging_proof_runs_finalize_guard
  before update on staging_proof_runs
  for each row
  execute function ue_staging_proof_run_finalize_guard();